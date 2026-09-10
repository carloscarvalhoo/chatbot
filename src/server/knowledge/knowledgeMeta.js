/**
 * @file Operações de metadados de documentos: marcar como revisado, definir validade. Re-exporta computeFreshness.
 * @module server/knowledge/knowledgeMeta
 */

import { adminDb } from "@/server/firebase/admin";
import { createHttpError } from "@/server/utils/errors";
import { computeFreshness, DEFAULT_REVIEW_INTERVAL_MONTHS } from "@/server/knowledge/freshness";

function fileRef(id) {
  return adminDb.collection("knowledgeFiles").doc(id);
}

export async function markFileReviewed(id) {
  if (!id) throw createHttpError("ID não informado.", 400);
  await fileRef(id).set({ lastReviewedAt: new Date(), updatedAt: new Date() }, { merge: true });
}

export async function setFileValidity(id, { sourceDate, expiresAt, reviewIntervalMonths } = {}) {
  if (!id) throw createHttpError("ID não informado.", 400);

  const patch = { updatedAt: new Date() };
  if (sourceDate !== undefined) patch.sourceDate = sourceDate ? new Date(sourceDate) : null;
  if (expiresAt !== undefined) patch.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (reviewIntervalMonths !== undefined) {
    patch.reviewIntervalMonths = Number(reviewIntervalMonths) || DEFAULT_REVIEW_INTERVAL_MONTHS;
  }

  await fileRef(id).set(patch, { merge: true });
}

// Reexporta o cálculo puro (fica em freshness.js para ser testável sem Firestore).
export { computeFreshness };
