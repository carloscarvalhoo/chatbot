#!/usr/bin/env node
/**
 * Preenche settings.institution.supportContacts com os contatos oficiais do
 * Campus Ivaiporã (fonte: https://ifpr.edu.br/ivaipora/fale-conosco/,
 * atualizado em 01/07/2026).
 *
 *   node --env-file=.env.local scripts/set-support-contacts.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

const CONTACTS = [
  { label: "Secretaria Acadêmica", value: "(43) 3126-9400" },
  { label: "Direção Administrativa (financeiro)", value: "(43) 3126-9408" },
  { label: "Seção Pedagógica e de Assuntos Estudantis", value: "(43) 3126-9405" },
  { label: "Direção de Ensino, Pesquisa e Extensão", value: "(43) 3126-9401" },
  { label: "Biblioteca", value: "(43) 3126-9407" },
  { label: "Gabinete", value: "(43) 3126-9410" },
  { label: "Fale conosco (site)", value: "https://ifpr.edu.br/ivaipora/fale-conosco/" },
];

await db.collection("settings").doc("institution").set(
  {
    supportContacts: CONTACTS,
    supportUrl: "https://ifpr.edu.br/ivaipora/fale-conosco/",
    updatedAt: new Date(),
  },
  { merge: true },
);

console.log(`✅ ${CONTACTS.length} contatos gravados em settings/institution.`);
CONTACTS.forEach((c) => console.log(`   ${c.label}: ${c.value}`));
