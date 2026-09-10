/**
 * @file Lista os documentos da base para o painel, já com o estado de frescor e datas serializadas.
 * @module server/knowledge/listKnowledgeFiles
 */

import { adminDb } from "@/server/firebase/admin";
import { computeFreshness } from "@/server/knowledge/knowledgeMeta";

function serializeDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export async function listKnowledgeFiles() {
  const snapshot = await adminDb.collection("knowledgeFiles").orderBy("uploadedAt", "desc").get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return {
      id: doc.id,
      ...data,
      uploadedAt: serializeDate(data.uploadedAt),
      updatedAt: serializeDate(data.updatedAt),
      lastReviewedAt: serializeDate(data.lastReviewedAt),
      sourceDate: serializeDate(data.sourceDate),
      expiresAt: serializeDate(data.expiresAt),
      freshness: computeFreshness(data),
    };
  });
}
