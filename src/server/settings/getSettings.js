import { adminDb } from "@/server/firebase/admin";

const DEFAULT_SETTINGS = {
  institutionName: "Instituição",
  botName: "Assistente",
  welcomeMessage: "Como posso ajudar você hoje?",
  primaryColor: "#ffffff",
  suggestedQuestions: [],
  footerNote: "",
  supportUrl: "",
  supportLabel: "Falar com o setor responsável",
  // Ordem/ativação dos modelos de IA definida no painel. Vazio = usa AI_CHAIN do ambiente.
  // Formato: [{ spec: "groq:openai/gpt-oss-120b", enabled: true }, ...]
  aiChain: [],
};

let cachedSettings = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function getSettings() {
  const now = Date.now();

  if (cachedSettings && now < cacheExpiresAt) {
    return cachedSettings;
  }

  try {
    const doc = await adminDb.collection("settings").doc("institution").get();
    const raw = doc.exists ? doc.data() : {};

    // Serializa campos Timestamp do Firestore para string (evita erro em Client Components)
    const data = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value && typeof value.toDate === "function") {
        data[key] = value.toDate().toISOString();
      } else {
        data[key] = value;
      }
    }

    cachedSettings = { ...DEFAULT_SETTINGS, ...data };
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cachedSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function invalidateSettingsCache() {
  cachedSettings = null;
  cacheExpiresAt = 0;
}
