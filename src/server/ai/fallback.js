/**
 * @file Percorre a cadeia de provedores aplicando circuit breaker, timeout, retry em erros transitórios e queda para o próximo provedor em erros definitivos. Versões streaming e não-streaming.
 * @module server/ai/fallback
 */

import { getChain, createProviderFromSpec, buildChainFromSpecs } from "@/server/ai/chain";
import { classifyProviderError, RETRYABLE_SAME_MODEL } from "@/server/ai/errors";
import { estimateRetry } from "@/server/ai/quota";
import { withRetry, withTimeout } from "@/server/ai/retry";
import * as breaker from "@/server/ai/circuitBreaker";
import { logger } from "@/server/utils/logger";

const ATTEMPT_TIMEOUT_MS = Number(process.env.AI_ATTEMPT_TIMEOUT_MS) || 25000;
const SAME_MODEL_RETRIES = Number(process.env.AI_SAME_MODEL_RETRIES) || 2;

/**
 * Percorre a cadeia de provedores aplicando: circuit breaker, timeout por
 * tentativa, retry com backoff em erros transitórios (503/500/timeout) e
 * queda para o próximo provedor em erros definitivos (429/404/401).
 *
 * @param {(provider: import("./providers/types").Provider) => Promise<{ text: string }>} operation
 * @param {string} label
 */
/**
 * Monta a cadeia efetiva: se o usuário indicou um modelo preferido (e ele é
 * válido/configurado), ele vai na frente — mas a cadeia inteira continua como
 * fallback. É preferência, não trava.
 * @param {string} [preferredSpec]
 */
function resolveChain(preferredSpec, chainSpecs) {
  let base;
  if (Array.isArray(chainSpecs) && chainSpecs.length) {
    try {
      base = buildChainFromSpecs(chainSpecs);
    } catch (error) {
      logger.warn(`⚠️ Cadeia do painel inválida (${error?.message}). Usando a cadeia do ambiente.`);
      base = getChain();
    }
  } else {
    base = getChain();
  }

  if (!preferredSpec || preferredSpec === "auto") return base;

  const known = new Set(base.map((p) => `${p.id}:${p.model}`));
  try {
    const preferred = createProviderFromSpec(preferredSpec);
    const key = `${preferred.id}:${preferred.model}`;
    if (known.has(key)) {
      return [preferred, ...base.filter((p) => `${p.id}:${p.model}` !== key)];
    }
    // modelo preferido fora da cadeia atual: ainda tenta ele primeiro
    return [preferred, ...base];
  } catch {
    return base;
  }
}

async function runAcrossChain(operation, label, preferredSpec, chainSpecs) {
  const chain = resolveChain(preferredSpec, chainSpecs);
  const errors = [];

  for (let index = 0; index < chain.length; index++) {
    const provider = chain[index];
    const key = `${provider.id}:${provider.model}`;

    if (breaker.isOpen(key)) {
      logger.warn(`⏭️ [${label}] ${key} em cooldown (circuit breaker). Pulando.`);
      errors.push({ model: key, kind: "circuit_open" });
      continue;
    }

    try {
      const result = await withRetry(
        () => withTimeout(operation(provider), ATTEMPT_TIMEOUT_MS, key),
        {
          retries: SAME_MODEL_RETRIES,
          baseDelayMs: 600,
          shouldRetry: (error) => RETRYABLE_SAME_MODEL.has(classifyProviderError(error)),
        },
      );

      return {
        ...result,
        providerUsed: provider.id,
        modelUsed: provider.model,
        usedFallback: index > 0,
        attempts: index + 1,
      };
    } catch (error) {
      const kind = classifyProviderError(error);
      logger.warn(`⚠️ [${label}] ${key} falhou (${kind}): ${error?.message}`);
      errors.push({ model: key, kind, error: error?.message });

      // Cota estourada: não adianta insistir nesse modelo pelos próximos minutos.
      if (kind === "quota") {
        breaker.trip(key);
      }
    }
  }

  logger.error(`❌ [${label}] todos os provedores falharam:`, errors);
  const { retryAfterMs, reason } = estimateRetry(errors);
  const finalError = new Error(
    "Sistema temporariamente sobrecarregado. Tente novamente em alguns instantes.",
  );
  finalError.statusCode = 503;
  finalError.details = errors;
  finalError.retryAfterMs = retryAfterMs;
  finalError.reason = reason;
  throw finalError;
}

/**
 * @param {{ systemPrompt: string, bufferHistory: import("./providers/types").ChatTurn[], currentMessageText: string }} params
 */
export function sendChatWithFallback({
  systemPrompt,
  bufferHistory,
  currentMessageText,
  preferredModel,
  chainSpecs,
}) {
  return runAcrossChain(
    (provider) =>
      provider.sendChat({
        systemPrompt,
        history: bufferHistory || [],
        message: currentMessageText,
      }),
    "chat",
    preferredModel,
    chainSpecs,
  );
}

/**
 * Geração simples de texto (ex: resumo de memória de conversa).
 * @param {string} prompt
 */
export function generateTextWithFallback(prompt) {
  return runAcrossChain((provider) => provider.generateText({ prompt }), "text");
}

/**
 * Versão streaming. Percorre a cadeia; só troca de provedor se a falha
 * acontecer ANTES do primeiro token (depois disso não dá pra trocar limpo).
 *
 * Emite: { type: "meta", providerUsed, modelUsed, usedFallback }
 *        { type: "delta", value }
 *        { type: "error", message }   (só se nenhum provedor entregou nada)
 */
export async function* streamChatWithFallback({
  systemPrompt,
  bufferHistory,
  currentMessageText,
  preferredModel,
  chainSpecs,
}) {
  const chain = resolveChain(preferredModel, chainSpecs);
  const errors = [];

  for (let index = 0; index < chain.length; index++) {
    const provider = chain[index];
    const key = `${provider.id}:${provider.model}`;

    if (breaker.isOpen(key) || typeof provider.streamChat !== "function") {
      errors.push({ model: key, kind: breaker.isOpen(key) ? "circuit_open" : "no_stream" });
      continue;
    }

    let started = false;
    try {
      const iterator = provider.streamChat({
        systemPrompt,
        history: bufferHistory || [],
        message: currentMessageText,
      });

      for await (const delta of iterator) {
        if (!started) {
          started = true;
          yield {
            type: "meta",
            providerUsed: provider.id,
            modelUsed: provider.model,
            usedFallback: index > 0,
          };
        }
        yield { type: "delta", value: delta };
      }

      if (started) return;
      errors.push({ model: key, kind: "empty" });
    } catch (error) {
      const kind = classifyProviderError(error);
      logger.warn(`⚠️ [stream] ${key} falhou (${kind}): ${error?.message}`);
      errors.push({ model: key, kind, error: error?.message });
      if (kind === "quota") breaker.trip(key);
      if (started) return; // já emitiu tokens — não dá pra trocar
    }
  }

  logger.error("❌ [stream] todos os provedores falharam:", errors);
  const { retryAfterMs, reason } = estimateRetry(errors);
  yield {
    type: "error",
    message: "Não consegui responder agora. Tente novamente em alguns instantes.",
    retryAfterMs,
    reason,
  };
}
