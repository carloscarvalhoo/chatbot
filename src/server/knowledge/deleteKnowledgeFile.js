/**
 * @file Apaga um documento da base e tudo que é dele (chunks, texto bruto).
 * @module server/knowledge/deleteKnowledgeFile
 */

import { adminDb } from "@/server/firebase/admin";
import { commitInBatches } from "@/server/firebase/commitInBatches";
import { createHttpError } from "@/server/utils/errors";

export async function deleteKnowledgeFile(id) {
  if (!id) {
    throw createHttpError("ID do arquivo não informado.", 400);
  }

  const fileRef = adminDb.collection("knowledgeFiles").doc(id);
  const [chunksSnapshot, rawTextSnapshot] = await Promise.all([
    fileRef.collection("chunks").get(),
    fileRef.collection("rawText").get(),
  ]);

  const writeOperations = [];

  for (const chunkDoc of chunksSnapshot.docs) {
    writeOperations.push({ type: "delete", ref: chunkDoc.ref });
  }
  for (const rawDoc of rawTextSnapshot.docs) {
    writeOperations.push({ type: "delete", ref: rawDoc.ref });
  }

  writeOperations.push({ type: "delete", ref: fileRef });

  await commitInBatches(writeOperations);

  return {
    success: true,
    message: "Arquivo removido com sucesso.",
  };
}
