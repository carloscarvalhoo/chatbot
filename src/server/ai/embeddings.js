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

// Quando a cota diária de embedding estoura (429), não adianta insistir pelos
// próximos minutos. A busca usa isso pra pular direto pro modo palavra-chave em
// vez de gastar ~1s numa chamada que já sabemos que vai falhar.
const QUOTA_COOLDOWN_MS = Number(process.env.EMBED_QUOTA_COOLDOWN_MS) || 5 * 60 * 1000;
let quotaCooldownUntil = 0;

export function embeddingQuotaLikelyExhausted() {
  return Date.now() < quotaCooldownUntil;
}

function noteQuotaExhausted() {
  quotaCooldownUntil = Date.now() + QUOTA_COOLDOWN_MS;
  logger.warn(
    `⚠️ Cota de embedding esgotada. Busca vai usar só palavra-chave por ${Math.round(
      QUOTA_COOLDOWN_MS / 60000,
    )}min.`,
  );
}

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no .env.local.");
  }
  return apiKey;
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

async function postJson(url, body) {
  return withRetry(
    async () => {
      const response = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": getApiKey(),
          },
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
        if (response.status === 429) noteQuotaExhausted();
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
