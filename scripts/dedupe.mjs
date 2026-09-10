#!/usr/bin/env node
/**
 * Remove documentos duplicados da base (mesma sourceUrl indexada mais de uma
 * vez — acontecia antes do dedupe por URL da Fase 3). Mantém o mais recente.
 *
 *   node --env-file=.env.local scripts/dedupe.mjs [--dry]
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY = process.argv.includes("--dry");

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

function normUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(url || "")
      .trim()
      .toLowerCase();
  }
}

function ts(v) {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

async function deleteDoc(ref) {
  for (const sub of ["chunks", "rawText"]) {
    const snap = await ref.collection(sub).get();
    for (let i = 0; i < snap.size; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await ref.delete();
}

(async () => {
  const snap = await db.collection("knowledgeFiles").get();

  const byUrl = new Map();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.sourceUrl) continue;
    const key = normUrl(data.sourceUrl);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(doc);
  }

  const dupes = [...byUrl.entries()].filter(([, docs]) => docs.length > 1);
  console.log(
    `${snap.size} docs · ${byUrl.size} URLs únicas · ${dupes.length} com duplicata${DRY ? "  (DRY RUN)" : ""}\n`,
  );

  let removed = 0;
  for (const [url, docs] of dupes) {
    docs.sort((a, b) => ts(b.data().updatedAt) - ts(a.data().updatedAt));
    const [keep, ...toRemove] = docs;
    console.log(`${url}\n  mantém ${keep.id} · remove ${toRemove.map((d) => d.id).join(", ")}`);
    if (!DRY) {
      for (const doc of toRemove) {
        await deleteDoc(doc.ref);
        removed += 1;
      }
    }
  }

  console.log(
    `\n${DRY ? "Removeria" : "Removidos"}: ${DRY ? dupes.reduce((s, [, d]) => s + d.length - 1, 0) : removed}`,
  );
  process.exit(0);
})();
