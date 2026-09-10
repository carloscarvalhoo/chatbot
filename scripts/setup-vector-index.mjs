#!/usr/bin/env node
/**
 * Cria o índice vetorial do Firestore para o campo `chunks.embedding`,
 * usando as credenciais da service account que já estão no .env.local.
 *
 *   node --env-file=.env.local scripts/setup-vector-index.mjs
 *
 * Se der 403 (a service account não tem permissão de criar índice), crie
 * pelo console: Firestore → Índices → Adicionar índice → Vetorial.
 */

import { GoogleAuth } from "google-auth-library";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const DIMENSION = Number(process.env.GEMINI_EMBEDDING_DIMENSION) || 768;

if (!PROJECT_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error(
    "Faltam FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY no .env.local",
  );
  process.exit(1);
}

const auth = new GoogleAuth({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
  scopes: ["https://www.googleapis.com/auth/datastore"],
});

const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)`;

async function api(method, path, body) {
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

(async () => {
  console.log(`Projeto: ${PROJECT_ID}  |  dimensão: ${DIMENSION}\n`);

  // Já existe?
  const list = await api("GET", "/collectionGroups/chunks/indexes");
  if (list.ok) {
    const existing = (list.json.indexes || []).find((idx) =>
      (idx.fields || []).some((f) => f.fieldPath === "embedding" && f.vectorConfig),
    );
    if (existing) {
      console.log(`✅ Índice vetorial já existe: ${existing.name}`);
      console.log(`   estado: ${existing.state}`);
      return;
    }
  } else if (list.status === 403) {
    console.error("❌ 403 — a service account não pode listar/criar índices.");
    console.error("   Crie pelo console: Firestore → Índices → Adicionar → Vetorial");
    console.error(
      `   (collection group "chunks", campo "embedding", ${DIMENSION} dimensões, flat)`,
    );
    process.exit(1);
  }

  const create = await api("POST", "/collectionGroups/chunks/indexes", {
    queryScope: "COLLECTION_GROUP",
    fields: [{ fieldPath: "embedding", vectorConfig: { dimension: DIMENSION, flat: {} } }],
  });

  if (create.ok) {
    console.log("✅ Índice vetorial em criação.");
    console.log(`   operação: ${create.json.name}`);
    console.log("   Leva alguns minutos para ficar READY. Acompanhe em:");
    console.log(`   https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes`);
    return;
  }

  console.error(`❌ Falha (${create.status}):`);
  console.error(JSON.stringify(create.json, null, 2));
  if (create.status === 403) {
    console.error("\n→ Crie pelo console (Firestore → Índices → Adicionar → Vetorial).");
  }
  process.exit(1);
})();
