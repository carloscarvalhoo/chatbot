// Tamanho do bloco em caracteres. Blocos menores = recuperação mais precisa e
// menos ruído no contexto, ao custo de mais chunks (mais embeddings, mais docs).
export const DEFAULT_CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 500;
export const DEFAULT_CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 80;

export function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Divide em sentenças para não cortar no meio de uma frase.
function splitIntoSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitTextIntoChunks(
  text,
  { chunkSize = DEFAULT_CHUNK_SIZE, chunkOverlap = DEFAULT_CHUNK_OVERLAP } = {},
) {
  const cleanText = normalizeText(text);
  const sentences = splitIntoSentences(cleanText);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > chunkSize && current) {
      chunks.push(current.trim());
      // overlap: começa o próximo chunk com as últimas palavras do anterior
      const words = current.split(" ");
      const overlapWords = [];
      let overlapLen = 0;
      for (let i = words.length - 1; i >= 0 && overlapLen < chunkOverlap; i--) {
        overlapWords.unshift(words[i]);
        overlapLen += words[i].length + 1;
      }
      current = `${overlapWords.join(" ")} ${sentence}`;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // Uma sentença sozinha pode passar de chunkSize; quebra em pedaços duros.
  const HARD_LIMIT = chunkSize * 2;
  return chunks.flatMap((chunk) => {
    if (chunk.length <= HARD_LIMIT) return [chunk];
    const pieces = [];
    for (let i = 0; i < chunk.length; i += chunkSize) {
      pieces.push(chunk.slice(i, i + chunkSize));
    }
    return pieces;
  });
}
