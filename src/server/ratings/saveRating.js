/**
 * @file Salva o 👍 / 👎 que o usuário deu numa resposta.
 * @module server/ratings/saveRating
 */

import { adminDb } from "@/server/firebase/admin";
import { createHttpError } from "@/server/utils/errors";

export async function saveRating({ messageId, conversationId, rating, messageText, userName }) {
  if (!messageId) throw createHttpError("messageId obrigatório.", 400);
  if (!["up", "down"].includes(rating))
    throw createHttpError("rating deve ser 'up' ou 'down'.", 400);

  const data = {
    messageId: String(messageId),
    conversationId: String(conversationId || ""),
    rating,
    messageText: String(messageText || "").slice(0, 500),
    userName: String(userName || "Anônimo").slice(0, 100),
    createdAt: new Date(),
  };

  await adminDb.collection("ratings").add(data);

  return { success: true };
}
