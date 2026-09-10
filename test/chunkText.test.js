import { describe, it, expect } from "vitest";
import { splitTextIntoChunks, normalizeText } from "@/server/pdf/chunkText";

describe("normalizeText", () => {
  it("colapsa espaços e quebras excessivas", () => {
    expect(normalizeText("a  \t b\n\n\n\nc")).toBe("a b\n\nc");
  });
});

describe("splitTextIntoChunks", () => {
  it("não corta no meio de frase e respeita ~chunkSize", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Frase número ${i} aqui.`).join(" ");
    const chunks = splitTextIntoChunks(text, { chunkSize: 120, chunkOverlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      // com overlap pode passar um pouco, mas nunca o dobro
      expect(c.length).toBeLessThanOrEqual(240);
    }
  });

  it("quebra sentença gigante em pedaços duros", () => {
    const huge = "x".repeat(3000);
    const chunks = splitTextIntoChunks(huge, { chunkSize: 500, chunkOverlap: 50 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it("texto vazio → nenhum chunk", () => {
    expect(splitTextIntoChunks("")).toEqual([]);
  });
});
