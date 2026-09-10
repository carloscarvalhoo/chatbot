/**
 * @file Guarda o texto extraído de cada documento em pedaços numa subcoleção, para permitir reprocessar sem re-upload.
 * @module server/knowledge/rawText
 */

import { adminDb } from "@/server/firebase/admin";
import { commitInBatches } from "@/server/firebase/commitInBatches";

// Limite prático por documento no Firestore é ~1 MiB. Guardamos o texto bruto
// extraído em pedaços de 700 KB numa subcoleção, para permitir reprocessar sem
// re-upload do arquivo.
const PART_SIZE = 700_000;

function partsRef(fileId) {
  return adminDb.collection("knowledgeFiles").doc(fileId).collection("rawText");
}

export async function saveRawText(fileId, text) {
  const value = String(text || "");
  const existing = await partsRef(fileId).get();
  const writeOperations = existing.docs.map((doc) => ({ type: "delete", ref: doc.ref }));

  for (let i = 0, part = 0; i < value.length; i += PART_SIZE, part++) {
    writeOperations.push({
      type: "set",
      ref: partsRef(fileId).doc(String(part).padStart(4, "0")),
      data: { part, text: value.slice(i, i + PART_SIZE) },
    });
  }

  if (writeOperations.length) await commitInBatches(writeOperations);
}

export async function loadRawText(fileId) {
  const snapshot = await partsRef(fileId).orderBy("part").get();
  if (snapshot.empty) return "";
  return snapshot.docs.map((doc) => doc.data().text || "").join("");
}
