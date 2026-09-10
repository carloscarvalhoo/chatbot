import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicialização preguiçosa: nada acontece no import. O SDK só é criado no
// primeiro uso real (no navegador). Assim o `next build` consegue analisar e
// pré-renderizar as páginas mesmo que as variáveis não estejam presentes
// naquele momento (elas são injetadas no bundle em tempo de build).
let cachedApp = null;
let cachedAuth = null;
let cachedDb = null;
let cachedStorage = null;

export function getFirebaseApp() {
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  }
  return cachedApp;
}

export function getFirebaseAuth() {
  if (!cachedAuth) cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

export function getFirebaseDb() {
  if (!cachedDb) cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}

export function getFirebaseStorage() {
  if (!cachedStorage) cachedStorage = getStorage(getFirebaseApp());
  return cachedStorage;
}
