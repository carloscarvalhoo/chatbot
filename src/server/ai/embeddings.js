/**
 * @file Geração de embeddings com o Gemini (um a um e em lote).
 *
 * Suporta VÁRIAS chaves de API (`GEMINI_API_KEYS` separadas por vírgula, ou
 * `GEMINI_API_KEY` sozinha). Como todas usam o MESMO modelo, os vetores ficam
 * no mesmo espaço e o índice continua válido — o efeito é multiplicar a cota
 * diária gratuita. Quando uma chave estoura (429), entra em cooldown e a
 * próxima assume; só quando TODAS estão em cooldown a busca cai pra
 * palavra-chave.
 * @module server/ai/embeddings
 */

import { withRetry, withTimeout } from "@/server/ai/retry";
import { classifyProviderError, RETRYABLE_SAME_MODEL } from "@/server/ai/errors";
import { logger } from "@/server/utils/logger";

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION) || 768;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_TIMEOUT_MS = Number(process.env.EMBED_TIMEOUT_MS) || 20000;
// gemini-embedding-001 aceita até 100 textos por chamada em batchEmbedContents.
const BATCH_SIZE = Number(process.env.EMBED_BATCH_SIZE) || 100;
// Pausa entre lotes para respeitar o rate limit do free tier.
const BATCH_PAUSE_MS = Number(process.env.EMBED_BATCH_PAUSE_MS) || 1200;

// Quando uma chave estoura a cota (429), fica em cooldown por alguns minutos.
const QUOTA_COOLDOWN_MS = Number(process.env.EMBED_QUOTA_COOLDOWN_MS) || 5 * 60 * 1000;

/** Todas as chaves de embedding configuradas, na ordem. */
function getApiKeys() {
  const fromList = (process.env.GEMINI_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const single = process.env.GEMINI_API_KEY?.trim();
  const all = [...fromList];
  if (single && !all.includes(single)) all.unshift(single);
  return all;
}

// cooldown por chave: Map<chave, timestamp até quando ela está de fora>
const keyCooldown = new Map();

function keyAvailable(key) {
  return (keyCooldown.get(key) || 0) <= Date.now();
}

function noteKeyExhausted(key) {
  keyCooldown.set(key, Date.now() + QUOTA_COOLDOWN_MS);
  const total = getApiKeys().length;
  const down = getApiKeys().filter((k) => !keyAvailable(k)).length;
  logger.warn(
    `⚠️ Chave de embedding esgotada (${down}/${total} em cooldown por ~${Math.round(
      QUOTA_COOLDOWN_MS / 60000,
    )}min).`,
  );
}

/** true só quando NENHUMA chave está disponível. */
export function embeddingQuotaLikelyExhausted() {
  const keys = getApiKeys();
  return keys.length > 0 && keys.every((k) => !keyAvailable(k));
}

function requireKeys() {
  const keys = getApiKeys();
  if (!keys.length) {
    throw new Error("Nenhuma chave de embedding configurada (GEMINI_API_KEY / GEMINI_API_KEYS).");
  }
  return keys;
}

function normalizeInputText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getEmbeddingModelName() {
  return EMBEDDING_MODEL;
}

export function getEmbeddingDimension() {
  return EMBEDDING_DIMENSION;
}

// IMPORTANTE: na API REST v1beta os parâmetros vão no NÍVEL RAIZ do request.
// Aninhar em `embedContentConfig` (formato do SDK JS) faz a API IGNORAR
// `outputDimensionality` e devolver 3072 dimensões em vez de 768.
function buildRequest(text, { taskType, title }) {
  const request = {
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSION,
  };
  if (title && taskType === "RETRIEVAL_DOCUMENT") {
    request.title = title;
  }
  return request;
}

/** Faz a chamada com UMA chave específica. Erros transitórios têm retry. */
function postJsonWithKey(url, body, key) {
  return withRetry(
    async () => {
      const response = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(body),
        }),
        EMBED_TIMEOUT_MS,
        "embeddings",
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data?.error?.message || "Erro ao gerar embedding com Gemini.");
        error.status = response.status;
        error.statusCode = response.status;
        throw error;
      }

      return data;
    },
    {
      retries: 3,
      baseDelayMs: 800,
      shouldRetry: (error) => RETRYABLE_SAME_MODEL.has(classifyProviderError(error)),
    },
  );
}

/**
 * Tenta a chamada percorrendo as chaves disponíveis. Uma chave que devolve 429
 * (cota) entra em cooldown e a próxima assume.
 */
async function postJson(url, body) {
  const keys = requireKeys().filter(keyAvailable);
  if (!keys.length) {
    const error = new Error("Todas as chaves de embedding estão em cooldown.");
    error.statusCode = 429;
    throw error;
  }

  let lastError;
  for (const key of keys) {
    try {
      return await postJsonWithKey(url, body, key);
    } catch (error) {
      lastError = error;
      if (error?.status === 429) {
        noteKeyExhausted(key);
        continue; // tenta a próxima chave
      }
      throw error; // erro que não é de cota: não adianta trocar de chave
    }
  }
  throw lastError;
}

/**
 * Gera o embedding de UM texto.
 * @param {string} text
 * @param {{ taskType?: string, title?: string }} [options]
 * @returns {Promise<number[]>}
 */
export async function generateEmbedding(
  text,
  { taskType = "RETRIEVAL_DOCUMENT", title = "" } = {},
) {
  if (embeddingQuotaLikelyExhausted()) {
    const error = new Error("Cota de embedding esgotada (cooldown).");
    error.statusCode = 429;
    throw error;
  }

  const cleanText = normalizeInputText(text);
  if (!cleanText) {
    throw new Error("Texto vazio para gerar embedding.");
  }

  const data = await postJson(
    `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent`,
    buildRequest(cleanText, { taskType, title }),
  );

  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("A API retornou um embedding vazio.");
  }
  return values;
}

/**
 * Gera embeddings de VÁRIOS textos em lotes (batchEmbedContents), com pausa
 * entre lotes para não estourar o rate limit gratuito.
 *
 * @param {string[]} texts
 * @param {{ taskType?: string, title?: string, onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<number[][]>}  embeddings na mesma ordem de `texts`
 */
export async function generateEmbeddingsBatch(
  texts,
  { taskType = "RETRIEVAL_DOCUMENT", title = "", onProgress } = {},
) {
  const cleaned = texts.map(normalizeInputText);
  if (cleaned.some((t) => !t)) {
    throw new Error("Um dos textos para embedding está vazio.");
  }

  const out = [];

  for (let start = 0; start < cleaned.length; start += BATCH_SIZE) {
    const slice = cleaned.slice(start, start + BATCH_SIZE);

    const data = await postJson(`${API_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
      requests: slice.map((text) => buildRequest(text, { taskType, title })),
    });

    const embeddings = data?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== slice.length) {
      throw new Error("batchEmbedContents devolveu quantidade inesperada de vetores.");
    }

    for (const item of embeddings) {
      const values = item?.values;
      if (!Array.isArray(values) || !values.length) {
        throw new Error("batchEmbedContents devolveu um vetor vazio.");
      }
      out.push(values);
    }

    onProgress?.(out.length, cleaned.length);
    logger.debug(`🧠 embeddings ${out.length}/${cleaned.length}`);

    if (start + BATCH_SIZE < cleaned.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }

  return out;
}
