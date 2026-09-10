import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getPrivateKey() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("FIREBASE_PRIVATE_KEY não configurada.");
  }

  return privateKey.replace(/\\n/g, "\n");
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID não configurada.");
  }

  if (!clientEmail) {
    throw new Error("FIREBASE_CLIENT_EMAIL não configurada.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: getPrivateKey() }),
  });
}

// Inicialização preguiçosa: o app só é criado no primeiro acesso a adminDb /
// adminAuth (em tempo de request), nunca no import do módulo. Isso evita que o
// `next build` (que carrega todo route module para analisar) quebre quando as
// variáveis do Firebase ainda não estão disponíveis.
let cachedApp = null;
let cachedDb = null;
let cachedAuth = null;

function app() {
  if (!cachedApp) cachedApp = getFirebaseAdminApp();
  return cachedApp;
}

function lazy(getInstance) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        const instance = getInstance();
        const value = instance[prop];
        return typeof value === "function" ? value.bind(instance) : value;
      },
    },
  );
}

export const adminDb = lazy(() => {
  if (!cachedDb) cachedDb = getFirestore(app());
  return cachedDb;
});

export const adminAuth = lazy(() => {
  if (!cachedAuth) cachedAuth = getAuth(app());
  return cachedAuth;
});
