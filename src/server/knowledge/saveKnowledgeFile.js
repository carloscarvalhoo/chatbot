import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase/admin";
import {
  generateEmbeddingsBatch,
  getEmbeddingDimension,
  getEmbeddingModelName,
} from "@/server/ai/embeddings";
import { commitInBatches } from "@/server/firebase/commitInBatches";
import { parsePdfBuffer } from "@/server/pdf/parsePdf";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { saveRawText } from "@/server/knowledge/rawText";
import { deriveDocPolicy } from "@/server/knowledge/classify";
import { hashContent } from "@/server/utils/hash";
import { logger } from "@/server/utils/logger";
import { createHttpError } from "@/server/utils/errors";

const MAX_FILE_SIZE_MB = 10;
const MAX_CHUNKS_PER_FILE = Number(process.env.MAX_CHUNKS_PER_FILE) || 400;

function sanitizeFileName(fileName) {
  return String(fileName || "arquivo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function validatePdfFile(file) {
  if (!file) throw createHttpError("Nenhum arquivo enviado.", 400);

  const fileName = String(file.name || "").trim();
  if (!fileName) throw createHttpError("Nome do arquivo não informado.", 400);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw createHttpError("Formato inválido. Envie apenas arquivos PDF.", 400);
  }
  if (!file.size || file.size <= 0) {
    throw createHttpError("Arquivo vazio ou inválido.", 400);
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw createHttpError(`Arquivo muito grande. Envie um PDF de até ${MAX_FILE_SIZE_MB}MB.`, 400);
  }
  if (file.type && file.type !== "application/pdf") {
    throw createHttpError("Tipo de arquivo inválido. Envie apenas PDF.", 400);
  }
}

/**
 * Grava um documento de conhecimento + seus chunks (com embeddings em lote).
 * Reutilizável pelo upload e pelo reprocessamento.
 *
 * @param {{ fileId?: string, originalName: string, safeName: string, meta: object,
 *           extractedText: string, chunks: string[], now?: Date }} params
 */
export async function persistKnowledgeDocument({
  fileId = crypto.randomUUID(),
  originalName,
  safeName,
  meta = {},
  extractedText,
  chunks,
  now = new Date(),
}) {
  if (!chunks.length) {
    throw createHttpError("Não foi possível gerar trechos do conteúdo.", 400);
  }
  if (chunks.length > MAX_CHUNKS_PER_FILE) {
    throw createHttpError(
      `O conteúdo gerou ${chunks.length} trechos (limite ${MAX_CHUNKS_PER_FILE}). ` +
        "Envie um documento menor ou aumente MAX_CHUNKS_PER_FILE.",
      400,
    );
  }

  const fileRef = adminDb.collection("knowledgeFiles").doc(fileId);

  // Classificação automática: intervalo de revisão pelo tipo de página + data
  // mais recente citada no conteúdo. Nada é marcado à mão.
  const policy = deriveDocPolicy({ url: meta.sourceUrl, text: extractedText });
  const sourceDate = meta.sourceDate || policy.sourceDate || null;
  // A data "de referência" do conteúdo: a que o site declara (meta.sourceUpdatedAt,
  // ex. lastmod do sitemap) ou a mais recente citada no texto.
  const contentUpdatedAt = meta.sourceUpdatedAt || sourceDate || now;

  logger.debug(`🧠 Gerando ${chunks.length} embeddings em lote...`);
  const embeddings = await generateEmbeddingsBatch(chunks, {
    taskType: "RETRIEVAL_DOCUMENT",
    title: originalName,
  });

  // Remove chunks antigos (caso seja reprocessamento).
  const existingChunks = await fileRef.collection("chunks").get();
  const writeOperations = existingChunks.docs.map((doc) => ({ type: "delete", ref: doc.ref }));

  writeOperations.push({
    type: "set",
    ref: fileRef,
    data: {
      fileId,
      originalName,
      safeName,
      status: "processed",
      processingStatus: "processed",
      storageType: "firestore-only",
      chunksCount: chunks.length,
      totalCharacters: extractedText.length,
      contentHash: hashContent(extractedText),
      hasEmbeddings: true,
      embeddingModel: getEmbeddingModelName(),
      embeddingDimensions: getEmbeddingDimension(),
      chunkSize: Number(process.env.CHUNK_SIZE) || 500,
      isActive: true,
      uploadedAt: meta.uploadedAt || now,
      updatedAt: now,
      lastReviewedAt: now,
      // classificação automática
      docKind: policy.kind,
      reviewIntervalMonths: policy.reviewIntervalMonths,
      sourceDate: sourceDate,
      contentUpdatedAt,
      needsReview: false,
      ...meta,
    },
  });

  for (let index = 0; index < chunks.length; index++) {
    writeOperations.push({
      type: "set",
      ref: fileRef.collection("chunks").doc(String(index)),
      data: {
        fileId,
        index,
        text: chunks[index],
        charCount: chunks[index].length,
        sourceFileName: originalName,
        sourceUrl: meta.sourceUrl || null,
        sourceUpdatedAt: contentUpdatedAt,
        embedding: FieldValue.vector(embeddings[index]),
        embeddingModel: getEmbeddingModelName(),
        embeddingDimensions: getEmbeddingDimension(),
        createdAt: now,
      },
    });
  }

  await commitInBatches(writeOperations);
  await saveRawText(fileId, extractedText);

  return {
    success: true,
    id: fileId,
    fileId,
    originalName,
    chunksCount: chunks.length,
    totalCharacters: extractedText.length,
    hasEmbeddings: true,
  };
}

export async function saveKnowledgeFile(file) {
  validatePdfFile(file);

  const fileName = file.name || "documento.pdf";
  const buffer = Buffer.from(await file.arrayBuffer());

  const parsedPdf = await parsePdfBuffer(buffer);
  const extractedText = parsedPdf.text;

  if (!extractedText) {
    throw createHttpError(
      "Não foi possível extrair texto desse PDF. Ele pode estar escaneado como imagem.",
      400,
    );
  }

  const chunks = splitTextIntoChunks(extractedText);

  return persistKnowledgeDocument({
    originalName: fileName,
    safeName: sanitizeFileName(fileName),
    meta: {
      contentType: file.type || "application/pdf",
      size: file.size || buffer.length,
      totalPages: parsedPdf.totalPages,
    },
    extractedText,
    chunks,
  });
}
