import crypto from "node:crypto";

/**
 * Hash estável do conteúdo de texto — ignora diferenças de espaço em branco.
 * Usado para detectar se uma página raspada mudou desde a última verificação.
 * @param {string} text
 */
export function hashContent(text) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
