#!/usr/bin/env node
/**
 * Reindexa toda a base de conhecimento:
 *  - re-fragmenta com o chunk atual (500/80)
 *  - re-gera embeddings em 768 dimensões (o valor certo)
 *  - regrava cada chunk como Firestore Vector (FieldValue.vector)
 *
 * Para docs de URL: re-raspa a página. Para PDFs: usa o texto bruto salvo;
 * se não houver, reconstrói a partir dos chunks existentes (aproximado).
 *
 *   node --env-file=.env.local scripts/reindex.mjs [--only=<fileId>] [--dry]
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as cheerio from "cheerio";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const DRY = args.dry === "true";
const ONLY = args.only || null;

const DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION) || 768;
const EMB_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 500;
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP) || 80;
const API_KEY = process.env.GEMINI_API_KEY?.trim();

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

// ---------- chunking ----------
function normalize(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function splitChunks(text) {
  const clean = normalize(text);
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    const cand = cur ? `${cur} ${s}` : s;
    if (cand.length > CHUNK_SIZE && cur) {
      chunks.push(cur.trim());
      const words = cur.split(" ");
      const ov = [];
      let len = 0;
      for (let i = words.length - 1; i >= 0 && len < CHUNK_OVERLAP; i--) {
        ov.unshift(words[i]);
        len += words[i].length + 1;
      }
      cur = `${ov.join(" ")} ${s}`;
    } else {
      cur = cand;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  const HARD = CHUNK_SIZE * 2;
  return chunks.flatMap((c) => {
    if (c.length <= HARD) return [c];
    const out = [];
    for (let i = 0; i < c.length; i += CHUNK_SIZE) out.push(c.slice(i, i + CHUNK_SIZE));
    return out;
  });
}

// ---------- embeddings ----------
async function embedBatch(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const slice = texts.slice(i, i + 100);
    let attempt = 0;
    for (;;) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMB_MODEL}:batchEmbedContents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
          body: JSON.stringify({
            requests: slice.map((t) => ({
              model: `models/${EMB_MODEL}`,
              content: { parts: [{ text: t }] },
              taskType: "RETRIEVAL_DOCUMENT",
              outputDimensionality: DIMENSION,
            })),
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        for (const e of data.embeddings) out.push(e.values);
        break;
      }
      if ((res.status === 429 || res.status === 503) && attempt++ < 4) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw new Error(`embed ${res.status}: ${data?.error?.message}`);
    }
    process.stdout.write(`\r    embeddings ${out.length}/${texts.length}`);
    if (i + 100 < texts.length) await new Promise((r) => setTimeout(r, 1200));
  }
  process.stdout.write("\n");
  return out;
}

// ---------- scraping ----------
async function scrape(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 ChatbotIFPR/1.0" },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim() || "Página Web";
    $(
      "script, style, nav, footer, header, iframe, noscript, .menu, #sidebar, [role=navigation]",
    ).remove();
    const text = $("main, article, #content, .content, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    return text.length < 50 ? null : { title, text };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function loadRawText(fileRef) {
  const snap = await fileRef.collection("rawText").orderBy("part").get();
  if (!snap.empty) return snap.docs.map((d) => d.data().text || "").join("");
  // fallback: reconstrói dos chunks
  const chunks = await fileRef.collection("chunks").orderBy("index").get();
  if (chunks.empty) return "";
  return chunks.docs.map((d) => d.data().text || "").join(" ");
}

async function saveRawText(fileRef, text) {
  const PART = 700_000;
  const existing = await fileRef.collection("rawText").get();
  let batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  for (let i = 0, p = 0; i < text.length; i += PART, p++) {
    batch.set(fileRef.collection("rawText").doc(String(p).padStart(4, "0")), {
      part: p,
      text: text.slice(i, i + PART),
    });
  }
  await batch.commit();
}

// ---------- reprocess ----------
async function reprocess(doc) {
  const data = doc.data();
  const fileRef = doc.ref;
  const name = data.originalName || doc.id;
  const now = new Date();

  let text = "";
  let title = name;
  if (data.sourceUrl) {
    const s = await scrape(data.sourceUrl);
    if (!s) throw new Error(`scrape falhou: ${data.sourceUrl}`);
    text = s.text;
    title = s.title || name;
  } else {
    text = await loadRawText(fileRef);
    if (!text) throw new Error("sem texto bruto nem chunks — reenvie o PDF");
  }

  const chunks = splitChunks(text);
  if (!chunks.length) throw new Error("0 chunks");
  console.log(`  "${title.slice(0, 50)}" → ${chunks.length} chunks`);

  if (DRY) return { fileId: doc.id, chunks: chunks.length, dry: true };

  const embeddings = await embedBatch(chunks);

  const oldChunks = await fileRef.collection("chunks").get();
  const ops = [];
  oldChunks.docs.forEach((d) => ops.push({ type: "del", ref: d.ref }));
  chunks.forEach((ct, i) => {
    ops.push({
      type: "set",
      ref: fileRef.collection("chunks").doc(String(i)),
      data: {
        fileId: doc.id,
        index: i,
        text: ct,
        charCount: ct.length,
        sourceFileName: title,
        sourceUrl: data.sourceUrl || null,
        sourceUpdatedAt: now,
        embedding: FieldValue.vector(embeddings[i]),
        embeddingModel: EMB_MODEL,
        embeddingDimensions: DIMENSION,
        createdAt: now,
      },
    });
  });
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    ops
      .slice(i, i + 400)
      .forEach((o) => (o.type === "del" ? batch.delete(o.ref) : batch.set(o.ref, o.data)));
    await batch.commit();
  }

  await fileRef.set(
    {
      originalName: title,
      chunksCount: chunks.length,
      totalCharacters: text.length,
      embeddingDimensions: DIMENSION,
      embeddingModel: EMB_MODEL,
      chunkSize: CHUNK_SIZE,
      updatedAt: now,
      lastReviewedAt: now,
      ...(data.sourceUrl ? { lastCheckedAt: now } : {}),
    },
    { merge: true },
  );
  await saveRawText(fileRef, text);

  return { fileId: doc.id, chunks: chunks.length };
}

// ---------- main ----------
(async () => {
  if (!API_KEY) throw new Error("GEMINI_API_KEY ausente");
  console.log(
    `Reindex — chunk ${CHUNK_SIZE}/${CHUNK_OVERLAP}, ${DIMENSION}d${DRY ? "  (DRY RUN)" : ""}\n`,
  );

  const snap = ONLY
    ? await db
        .collection("knowledgeFiles")
        .where("__name__", "==", db.doc(`knowledgeFiles/${ONLY}`))
        .get()
    : await db.collection("knowledgeFiles").get();

  console.log(`${snap.size} documento(s)\n`);
  const ok = [];
  const fail = [];
  for (const doc of snap.docs) {
    try {
      ok.push(await reprocess(doc));
    } catch (e) {
      console.log(`  ❌ ${doc.data().originalName || doc.id}: ${e.message}`);
      fail.push({ fileId: doc.id, error: e.message });
    }
  }

  console.log(`\n✅ ${ok.length} ok · ❌ ${fail.length} falhou`);
  if (fail.length) console.log(JSON.stringify(fail, null, 2));
  process.exit(0);
})();
