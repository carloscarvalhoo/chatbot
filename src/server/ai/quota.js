// Estimativa de quando as cotas gratuitas voltam.
// - Limite por minuto (RPM): ~1 minuto.
// - Limite por dia (RPD): os provedores Gemini resetam à meia-noite no horário
//   do Pacífico (US). É a referência mais conservadora; Groq/OpenRouter costumam
//   resetar antes, então esperar até a meia-noite PT cobre todos.

const ONE_MINUTE = 60_000;

/** Milissegundos até a próxima meia-noite America/Los_Angeles. */
export function millisUntilPacificMidnight(from = new Date()) {
  // Componentes de data/hora "agora" em Los Angeles.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(from);

  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const h = get("hour") % 24;
  const m = get("minute");
  const s = get("second");

  const secondsIntoDay = h * 3600 + m * 60 + s;
  const secondsLeft = 86_400 - secondsIntoDay;
  return secondsLeft * 1000;
}

/**
 * Dado os erros coletados na cadeia de fallback, estima o tempo de espera.
 * @param {{ kind?: string }[]} errors
 * @returns {{ retryAfterMs: number, reason: "quota" | "overloaded" | "unknown" }}
 */
export function estimateRetry(errors = []) {
  const kinds = errors.map((e) => e.kind);

  if (kinds.includes("quota")) {
    // Só é "fim do dia" se TODOS os provedores estouraram cota.
    const allQuota =
      errors.length > 0 && errors.every((e) => e.kind === "quota" || e.kind === "circuit_open");
    return {
      retryAfterMs: allQuota ? millisUntilPacificMidnight() : 2 * ONE_MINUTE,
      reason: "quota",
    };
  }

  if (kinds.includes("overloaded") || kinds.includes("server") || kinds.includes("timeout")) {
    return { retryAfterMs: ONE_MINUTE, reason: "overloaded" };
  }

  return { retryAfterMs: ONE_MINUTE, reason: "unknown" };
}
