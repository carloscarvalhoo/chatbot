import { createRequire } from "node:module";
import { normalizeText } from "@/server/pdf/chunkText";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export async function parsePdfBuffer(buffer) {
  const pdfData = await pdfParse(buffer);

  return {
    text: normalizeText(pdfData.text),
    totalPages: pdfData.numpages || null,
    info: pdfData.info || null,
  };
}
