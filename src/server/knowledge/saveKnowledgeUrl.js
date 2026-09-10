/**
 * @file Ingestão de uma página da web: raspa, deduplica por URL e persiste.
 * @module server/knowledge/saveKnowledgeUrl
 */

import { adminDb } from "@/server/firebase/admin";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { createHttpError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

function sanitizeName(name) {
  return String(name || "link")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return String(url || "").trim();
  }
}

/** Se já existe um documento para essa URL, devolve o id (para substituir). */
async function findExistingByUrl(url) {
  const snapshot = await adminDb
    .collection("knowledgeFiles")
    .where("sourceUrl", "==", url)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0].id;
}

/**
 * Indexa (ou reindexa) uma página. Se a URL já existe, substitui os chunks
 * em vez de criar um documento duplicado.
 */
export async function saveKnowledgeUrl(pageTitle, url, extractedText) {
  const text = String(extractedText || "").trim();
  if (!text) {
    throw createHttpError("Não há texto disponível para indexar esta URL.", 400);
  }

  const normalizedUrl = normalizeUrl(url);
  const chunks = splitTextIntoChunks(text);
  const existingId = await findExistingByUrl(normalizedUrl);

  if (existingId) {
    logger.debug(`♻️ URL já indexada, substituindo chunks: ${normalizedUrl}`);
  }

  return persistKnowledgeDocument({
    fileId: existingId || crypto.randomUUID(),
    originalName: pageTitle || normalizedUrl,
    safeName: sanitizeName(pageTitle || "link-site"),
    meta: {
      contentType: "text/html-url",
      sourceUrl: normalizedUrl,
      size: text.length,
      totalPages: 1,
      lastCheckedAt: new Date(),
    },
    extractedText: text,
    chunks,
  });
}
