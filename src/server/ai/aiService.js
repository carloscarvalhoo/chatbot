import {
  formatKnowledgeContext,
  getSourcesWithFreshness,
  searchKnowledgeChunks,
} from "@/server/knowledge/searchKnowledge";
import { sendChatWithFallback, streamChatWithFallback } from "@/server/ai/fallback";
import { getSystemPrompt } from "@/server/ai/prompts";
import { normalizeBufferHistory, updateMemoryIfNeeded } from "@/server/ai/memory";
import { getSettings } from "@/server/settings/getSettings";
import { logger } from "@/server/utils/logger";

function preview(text, maxLength = 700) {
  const value = String(text || "");
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...(truncado)`;
}

function createTurn(role, text) {
  return { role, text: String(text || "").trim() };
}

const STALE_CAVEAT =
  "⚠️ ATENÇÃO: uma ou mais fontes abaixo estão marcadas como possivelmente " +
  "desatualizadas (passaram da data de revisão). Ao responder, avise o usuário " +
  "de forma gentil que essa informação pode ter mudado e que ele deve confirmar " +
  "nos canais oficiais da instituição.\n\n";

// Só quando a busca traz algo bem fraco (nada claramente relacionado). Aviso
// discreto pra o modelo não "completar" o que falta. Threshold baixo de
// propósito: a maioria das perguntas boas tem score bem acima disso.
const LOW_CONFIDENCE_SCORE = Number(process.env.SEARCH_LOW_CONFIDENCE_SCORE) || 0.45;

const LOW_CONFIDENCE_CAVEAT =
  "Observação: os trechos abaixo têm baixa relação com a pergunta. Se algum " +
  "responder de forma direta, use; se nenhum responder, diga com gentileza que " +
  "você não tem essa informação e oriente aos canais oficiais. Não preencha o " +
  "que falta com conhecimento geral.\n\n";

/**
 * Busca + settings + frescor das fontes + system prompt, tudo junto.
 */
async function prepareContext(currentMessageText, longMemory, settingsPromise) {
  const [settings, knowledgeChunks] = await Promise.all([
    settingsPromise,
    searchKnowledgeChunks(currentMessageText),
  ]);

  const sourcesInfo = await getSourcesWithFreshness(knowledgeChunks);

  let knowledgeContext = formatKnowledgeContext(knowledgeChunks);

  const topChunk = knowledgeChunks[0];
  const topIsSemantic = topChunk?.searchType === "vector" || topChunk?.searchType === "embedding";
  // Busca por palavra-chave = modo degradado (embedding indisponível): o
  // contexto é menos confiável, então sempre avisa.
  const isKeywordFallback = Boolean(knowledgeContext) && topChunk?.searchType === "keyword";
  const lowConfidence =
    (Boolean(knowledgeContext) && topIsSemantic && (topChunk?.score ?? 0) < LOW_CONFIDENCE_SCORE) ||
    isKeywordFallback;

  if (knowledgeContext && sourcesInfo.hasExpired) {
    knowledgeContext = STALE_CAVEAT + knowledgeContext;
  }
  if (lowConfidence) {
    knowledgeContext = LOW_CONFIDENCE_CAVEAT + knowledgeContext;
  }

  const systemPrompt = getSystemPrompt(
    longMemory,
    knowledgeContext,
    settings.institutionName,
    settings.botName,
  );

  return {
    knowledgeChunks,
    sourcesInfo,
    systemPrompt,
    chainSpecs: chainSpecsFromSettings(settings),
  };
}

/** Ordem de modelos definida no painel (Configurações). Vazio = usa AI_CHAIN. */
function chainSpecsFromSettings(settings) {
  if (!Array.isArray(settings?.aiChain)) return [];
  return settings.aiChain
    .filter((item) => item && item.enabled !== false && item.spec)
    .map((item) => String(item.spec).trim())
    .filter(Boolean);
}

export const aiService = {
  async sendMessage(
    currentMessage,
    bufferHistory = [],
    longMemory = null,
    conversationId = null,
    preferredModel = null,
  ) {
    const currentMessageText = String(currentMessage || "").trim();

    if (!currentMessageText) {
      return {
        text: "Digite uma mensagem para começar.",
        bufferHistory: normalizeBufferHistory(bufferHistory),
        longMemory,
        didSummarize: false,
      };
    }

    const normalizedBufferHistory = normalizeBufferHistory(bufferHistory);

    logger.debug(`\n🧩 bufferHistory | msgs=${normalizedBufferHistory.length}`);
    logger.debug("➡️ mensagem:", currentMessageText);
    logger.debug("📌 longMemory:", preview(longMemory || "", 500));

    const { knowledgeChunks, sourcesInfo, systemPrompt, chainSpecs } = await prepareContext(
      currentMessageText,
      longMemory,
      getSettings(),
    );
    logger.debug(`\n📚 chunks encontrados: ${knowledgeChunks.length}`);

    const response = await sendChatWithFallback({
      systemPrompt,
      bufferHistory: normalizedBufferHistory,
      currentMessageText,
      preferredModel,
      chainSpecs,
    });

    const nextBuffer = [
      ...normalizedBufferHistory,
      createTurn("user", currentMessageText),
      createTurn("model", response.text),
    ];

    const memoryResult = await updateMemoryIfNeeded({
      currentBufferHistory: nextBuffer,
      longMemory,
    });

    logger.debug(`\n⬅️ resposta (${response.modelUsed}):`, preview(response.text, 900));
    logger.debug(`🧩 buffer final | msgs=${memoryResult.bufferHistory.length}`);

    return {
      text: response.text,
      bufferHistory: memoryResult.bufferHistory,
      longMemory: memoryResult.longMemory,
      didSummarize: memoryResult.didSummarize,
      modelUsed: response.modelUsed,
      providerUsed: response.providerUsed,
      usedFallback: response.usedFallback,
      sources: sourcesInfo.sources,
      sourcesStale: sourcesInfo.hasExpired,
    };
  },

  /**
   * Igual ao sendMessage, mas em streaming.
   * Emite: { type: "delta", value }
   *        { type: "done", text, bufferHistory, longMemory, didSummarize,
   *                 modelUsed, providerUsed, usedFallback, sources }
   *        { type: "error", error }
   */
  async *sendMessageStream(
    currentMessage,
    bufferHistory = [],
    longMemory = null,
    conversationId = null,
    preferredModel = null,
  ) {
    const currentMessageText = String(currentMessage || "").trim();
    const normalizedBufferHistory = normalizeBufferHistory(bufferHistory);

    if (!currentMessageText) {
      yield {
        type: "done",
        text: "Digite uma mensagem para começar.",
        bufferHistory: normalizedBufferHistory,
        longMemory,
        didSummarize: false,
        sources: [],
      };
      return;
    }

    const { knowledgeChunks, sourcesInfo, systemPrompt, chainSpecs } = await prepareContext(
      currentMessageText,
      longMemory,
      getSettings(),
    );

    let fullText = "";
    let meta = { modelUsed: null, providerUsed: null, usedFallback: false };
    let failed = false;

    for await (const event of streamChatWithFallback({
      systemPrompt,
      bufferHistory: normalizedBufferHistory,
      currentMessageText,
      preferredModel,
      chainSpecs,
    })) {
      if (event.type === "meta") {
        meta = {
          modelUsed: event.modelUsed,
          providerUsed: event.providerUsed,
          usedFallback: event.usedFallback,
        };
      } else if (event.type === "delta") {
        fullText += event.value;
        yield { type: "delta", value: event.value };
      } else if (event.type === "error") {
        failed = true;
        yield {
          type: "error",
          error: event.message,
          retryAfterMs: event.retryAfterMs || null,
          reason: event.reason || null,
        };
      }
    }

    if (failed || !fullText) return;

    const nextBuffer = [
      ...normalizedBufferHistory,
      createTurn("user", currentMessageText),
      createTurn("model", fullText),
    ];

    const memoryResult = await updateMemoryIfNeeded({
      currentBufferHistory: nextBuffer,
      longMemory,
    });

    yield {
      type: "done",
      text: fullText,
      bufferHistory: memoryResult.bufferHistory,
      longMemory: memoryResult.longMemory,
      didSummarize: memoryResult.didSummarize,
      modelUsed: meta.modelUsed,
      providerUsed: meta.providerUsed,
      usedFallback: meta.usedFallback,
      sources: sourcesInfo.sources,
      sourcesStale: sourcesInfo.hasExpired,
    };
  },
};

/**
 * Monta o system prompt exatamente como o chat monta, para inspeção no painel.
 * Se `question` for vazio, usa um placeholder no lugar da base de conhecimento.
 */
export async function inspectSystemPrompt(question = "") {
  const q = String(question || "").trim();
  if (!q) {
    const settings = await getSettings();
    return {
      question: "",
      systemPrompt: getSystemPrompt(
        null,
        "(Aqui entram os trechos da base de conhecimento encontrados para a pergunta do usuário. Varia a cada pergunta.)",
        settings.institutionName,
        settings.botName,
      ),
      chunksFound: null,
      topScore: null,
      lowConfidence: null,
    };
  }

  const { knowledgeChunks, systemPrompt } = await prepareContext(q, null, getSettings());
  const topChunk = knowledgeChunks[0];
  return {
    question: q,
    systemPrompt,
    chunksFound: knowledgeChunks.length,
    topScore: typeof topChunk?.score === "number" ? topChunk.score : null,
    lowConfidence:
      knowledgeChunks.length > 0 &&
      (topChunk?.searchType === "vector" || topChunk?.searchType === "embedding") &&
      (topChunk?.score ?? 0) < LOW_CONFIDENCE_SCORE,
  };
}
