const REQUIRED_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GEMINI_API_KEY",
  "GEMINI_EMBEDDING_MODEL",
  "GEMINI_EMBEDDING_DIMENSION",
];

let validated = false;

export function validateEnv() {
  if (validated) return;

  const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não configuradas: ${missing.join(", ")}`);
  }

  validated = true;
}
