/**
 * @file Busca na base de conhecimento: vetorial nativa do Firestore (findNearest) com queda para varredura + cosseno / palavra-chave em memória. Também monta a lista de fontes com frescor.
 * @module server/knowledge/searchKnowledge
 */

import { adminDb } from "@/server/firebase/admin";
import {
  generateEmbedding,
  getEmbeddingModelName,
  embeddingQuotaLikelyExhausted,
} from "@/server/ai/embeddings";
import { computeFreshness } from "@/server/knowledge/knowledgeMeta";
import { logger } from "@/server/utils/logger";

// Campos que a busca por palavra-chave precisa. Excluir `embedding` do fetch
// corta o payload em ~15x (cada embedding são ~6KB) e o tempo em ~3x.
const KEYWORD_FIELDS = ["text", "fileId", "sourceFileName", "sourceUrl", "sourceUpdatedAt"];

// Thresholds configuráveis por ambiente — recalibrar após reindexar (ver
// scripts/tune-search se existir, ou o comparador do painel).
const DEFAULT_TOP_K = Number(process.env.SEARCH_TOP_K) || 8;
const DEFAULT_MIN_SIMILARITY = Number(process.env.SEARCH_MIN_SIMILARITY) || 0.4;
const DEFAULT_MIN_KEYWORD_SCORE = Number(process.env.SEARCH_MIN_KEYWORD_SCORE) || 2;
// Similaridade mínima para CITAR uma fonte ao usuário. É mais alta que o
// mínimo de busca: um chunk fraco pode ajudar o modelo como contexto, mas não
// merece virar "referência" na tela (senão saudações mostram fontes aleatórias).
const SOURCE_DISPLAY_MIN_SCORE = Number(process.env.SEARCH_SOURCE_MIN_SCORE) || 0.45;
// Só usado no fallback em memória (quando o findNearest não está disponível).
const DEFAULT_MAX_CHUNKS_SCAN = Number(process.env.SEARCH_MAX_CHUNKS_SCAN) || 1500;

const STOP_WORDS = new Set([
  "a",
  "o",
  "os",
  "as",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "sem",
  "que",
  "qual",
  "quais",
  "como",
  "quando",
  "onde",
  "porque",
  "sobre",
  "isso",
  "esse",
  "essa",
  "este",
  "esta",
  "ele",
  "ela",
  "eu",
  "me",
  "minha",
  "meu",
]);

const CASUAL_MESSAGES = new Set([
  "oi",
  "oii",
  "oiii",
  "ola",
  "olá",
  "bom dia",
  "boa tarde",
  "boa noite",
  "tudo bem",
  "tudo bom",
  "e ai",
  "eai",
  "hello",
  "hey",
  "obrigado",
  "obrigada",
  "valeu",
  "muito obrigado",
  "muito obrigada",
  "agradeco",
  "de nada",
  "ok",
  "beleza",
  "entendi",
  "legal",
  "certo",
  "ate mais",
  "tchau",
  "adeus",
  "bom te ver",
]);

// Conversa fiada / perguntas sobre o próprio bot: não vale buscar na base.
const SMALLTALK_PATTERNS = [
  /^(e |entao |mas )?(como|quem) (voce|vc|tu) (esta|ta|vai|anda|se sente)/,
  /^(qual|quem|me diz|diz) .{0,12}(seu|teu) nome/,
  /\b(seu|teu) nome( e| eh| qual)?\??$/,
  /^(quem|o que|oque) (e|eh) (voce|vc|tu|voce e|o lumi)\b/,
  /^(voce|vc) (se chama|e o|eh o)\b/,
  /^quem (te|lhe|voce|o|a) (criou|fez|desenvolveu|programou|treinou)/,
  /^(o que|oque|que) (voce|vc|tu) (faz|pode fazer|sabe fazer|consegue fazer)/,
  /^(voce|vc|tu) (e|eh) (uma |um )?(ia|robo|bot|chatbot|inteligencia artificial|humano|pessoa|real)/,
  /^tudo (bem|bom)\b/,
  /(bom dia|boa tarde|boa noite)[ ,!]*(tudo bem|como vai|como voce esta|beleza)?[?!]*$/,
  /^(muito )?(obrigad|valeu|agradec|grato|grata)\b/,
  /^(voce|vc) (esta|ta) (ai|online|funcionando)/,
];

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !STOP_WORDS.has(word));
}

function isCasualMessage(question) {
  const normalized = normalizeText(question);
  if (!normalized) return true;
  if (CASUAL_MESSAGES.has(normalized)) return true;
  if (normalized.length <= 40 && SMALLTALK_PATTERNS.some((re) => re.test(normalized))) return true;

  const tokens = tokenize(question);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && normalized.length <= 8) return true;
  return false;
}

function scoreKeywordChunk(question, questionTokens, chunkText) {
  const normalizedChunk = normalizeText(chunkText);
  const normalizedQuestion = normalizeText(question);
  if (!normalizedChunk) return 0;

  let score = 0;
  if (normalizedQuestion && normalizedChunk.includes(normalizedQuestion)) score += 20;

  for (const token of questionTokens) {
    if (normalizedChunk.includes(token)) {
      score += token.length >= 6 ? 3 : 1;
    }
  }
  return score;
}

function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) return 0;
  if (vectorA.length !== vectorB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vectorA.length; i++) {
    const a = Number(vectorA[i] || 0);
    const b = Number(vectorB[i] || 0);
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function mapChunkDoc(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    fileId: data.fileId || null,
    index: data.index ?? null,
    text: data.text || "",
    sourceFileName: data.sourceFileName || "documento",
    sourceUrl: data.sourceUrl || null,
    sourceUpdatedAt: serializeTimestamp(data.sourceUpdatedAt),
    embedding: data.embedding?.toArray?.() || data.embedding || null,
    embeddingModel: data.embeddingModel || null,
    embeddingDimensions: data.embeddingDimensions || null,
  };
}

/**
 * Busca vetorial NATIVA do Firestore. Lê só os top-K documentos (≈6) em vez de
 * varrer a coleção inteira. Requer índice vetorial no campo `chunks.embedding`.
 */
async function searchByFindNearest({ questionText, topK, minSimilarity }) {
  const queryEmbedding = await generateEmbedding(questionText, { taskType: "RETRIEVAL_QUERY" });

  const vectorQuery = adminDb.collectionGroup("chunks").findNearest({
    vectorField: "embedding",
    queryVector: queryEmbedding,
    limit: topK,
    distanceMeasure: "COSINE",
    distanceResultField: "_distance",
  });

  const snapshot = await vectorQuery.get();

  return snapshot.docs
    .map((docSnap) => {
      const chunk = mapChunkDoc(docSnap);
      const distance = docSnap.get("_distance");
      // distância COSINE ∈ [0,2]; similaridade = 1 - distância
      const similarity = typeof distance === "number" ? 1 - distance : null;
      return {
        ...chunk,
        score: similarity !== null ? Number(similarity.toFixed(4)) : 0,
        searchType: "vector",
      };
    })
    .filter((chunk) => chunk.score >= minSimilarity);
}

/** Fallback: varre a coleção e calcula cosseno / palavra-chave em memória (caro). */
async function searchInMemory({
  questionText,
  questionTokens,
  topK,
  minSimilarity,
  minKeywordScore,
}) {
  // Tenta o embedding da consulta ANTES do fetch grande. Se a cota está
  // esgotada ou a chamada falha, o modo é palavra-chave e aí buscamos só os
  // campos de texto (sem o campo `embedding`, que domina o payload).
  let queryEmbedding = null;
  if (!embeddingQuotaLikelyExhausted()) {
    try {
      queryEmbedding = await generateEmbedding(questionText, { taskType: "RETRIEVAL_QUERY" });
    } catch (error) {
      logger.warn("⚠️ Embedding da consulta falhou, indo pra palavra-chave:", error?.message);
    }
  }

  let query = adminDb.collectionGroup("chunks").limit(DEFAULT_MAX_CHUNKS_SCAN);
  if (!queryEmbedding) query = query.select(...KEYWORD_FIELDS);
  const snapshot = await query.get();

  if (snapshot.size >= DEFAULT_MAX_CHUNKS_SCAN) {
    logger.warn(
      `⚠️ Busca em memória atingiu o teto de ${DEFAULT_MAX_CHUNKS_SCAN} chunks — ` +
        "alguns documentos podem estar sendo ignorados. Configure o índice vetorial (findNearest).",
    );
  }

  const chunks = snapshot.docs.map(mapChunkDoc);
  if (!chunks.length) return [];

  if (queryEmbedding) {
    const model = getEmbeddingModelName();
    const semantic = chunks
      .filter(
        (chunk) =>
          Array.isArray(chunk.embedding) &&
          chunk.embedding.length === queryEmbedding.length &&
          chunk.embeddingModel === model,
      )
      .map((chunk) => ({
        ...chunk,
        score: Number(cosineSimilarity(queryEmbedding, chunk.embedding).toFixed(4)),
        searchType: "embedding",
      }))
      .filter((chunk) => chunk.score >= minSimilarity)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (semantic.length > 0) return semantic;
  }

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreKeywordChunk(questionText, questionTokens, chunk.text),
      searchType: "keyword",
    }))
    .filter((chunk) => chunk.score >= minKeywordScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function searchKnowledgeChunks(
  question,
  {
    topK = DEFAULT_TOP_K,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
    minKeywordScore = DEFAULT_MIN_KEYWORD_SCORE,
  } = {},
) {
  const questionText = String(question || "").trim();
  if (!questionText) return [];
  if (isCasualMessage(questionText)) return [];

  const questionTokens = tokenize(questionText);
  if (!questionTokens.length) return [];

  // 1) Busca vetorial nativa (barata). Pula se a cota de embedding estourou —
  // sem embedding da consulta o findNearest não roda mesmo.
  if (!embeddingQuotaLikelyExhausted()) {
    try {
      const results = await searchByFindNearest({ questionText, topK, minSimilarity });
      if (results.length > 0) return results;
    } catch (error) {
      logger.warn(
        "⚠️ findNearest indisponível (índice vetorial não criado?). Caindo pra busca em memória:",
        error?.message,
      );
    }
  }

  // 2) Fallback: varredura + cosseno em memória.
  return searchInMemory({
    questionText,
    questionTokens,
    topK,
    minSimilarity,
    minKeywordScore,
  });
}

/**
 * Lista de fontes únicas dos chunks recuperados, para exibir ao usuário.
 * @param {object[]} [chunks]
 * @returns {Array<{name: string, url: (string|null), updatedAt: (string|null)}>}
 */
export function buildSources(chunks = []) {
  const seen = new Map();

  for (const chunk of chunks) {
    const key = chunk.fileId || chunk.sourceFileName || chunk.sourceUrl;
    if (!key || seen.has(key)) continue;

    let updatedAt = null;
    if (chunk.sourceUpdatedAt) {
      const date = new Date(chunk.sourceUpdatedAt);
      if (!Number.isNaN(date.getTime())) updatedAt = date.toISOString();
    }

    seen.set(key, {
      fileId: chunk.fileId || null,
      name: chunk.sourceFileName || "Documento",
      url: chunk.sourceUrl || null,
      updatedAt,
    });
  }

  return [...seen.values()];
}

/**
 * Lê os documentos-pai dos chunks recuperados (1 round-trip) e devolve as
 * fontes com o estado de frescor. Usado para avisar o usuário quando a
 * resposta se baseia em algo vencido.
 *
 * @param {any[]} chunks  resultado de searchKnowledgeChunks
 * @param {number} topN   quantos chunks do topo considerar (padrão 3)
 * @returns {Promise<{ sources: any[], hasExpired: boolean, hasDue: boolean }>}
 */
export async function getSourcesWithFreshness(chunks = [], topN = 3) {
  // Só cita fontes com similaridade decente. Chunks fracos continuam indo pro
  // modelo como contexto, mas não aparecem como "referência" pro usuário.
  const citable = chunks.filter((c) => {
    if (c.searchType === "keyword") return true;
    return (typeof c.score === "number" ? c.score : 0) >= SOURCE_DISPLAY_MIN_SCORE;
  });

  const base = buildSources(citable);
  if (!base.length) return { sources: [], hasExpired: false, hasDue: false };

  const topFileIds = [
    ...new Set(
      citable
        .slice(0, topN)
        .map((c) => c.fileId)
        .filter(Boolean),
    ),
  ];
  const allFileIds = [...new Set(citable.map((c) => c.fileId).filter(Boolean))];

  if (!allFileIds.length) return { sources: base, hasExpired: false, hasDue: false };

  let freshnessById = {};
  try {
    const refs = allFileIds.map((id) => adminDb.collection("knowledgeFiles").doc(id));
    const docs = await adminDb.getAll(...refs);
    for (const doc of docs) {
      if (doc.exists) freshnessById[doc.id] = computeFreshness(doc.data());
    }
  } catch (error) {
    logger.warn("⚠️ Falha ao ler frescor das fontes:", error?.message);
    return { sources: base, hasExpired: false, hasDue: false };
  }

  const sources = base.map((source) => ({
    ...source,
    freshness: source.fileId ? freshnessById[source.fileId] || null : null,
  }));

  const topFreshness = topFileIds.map((id) => freshnessById[id]);

  return {
    sources,
    hasExpired: topFreshness.includes("expired"),
    hasDue: topFreshness.includes("dueForReview"),
  };
}

export function formatKnowledgeContext(chunks = []) {
  if (!chunks.length) return "";

  return chunks
    .map((chunk, index) => {
      const parts = [`Fonte: ${chunk.sourceFileName}`];
      if (chunk.sourceUpdatedAt) {
        const date = new Date(chunk.sourceUpdatedAt);
        if (!Number.isNaN(date.getTime())) {
          parts.push(`atualizado em ${date.toLocaleDateString("pt-BR")}`);
        }
      }
      return `[${index + 1}] ${parts.join(" · ")}\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}
