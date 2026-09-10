/**
 * @file Circuit breaker simples, em memória do processo. Quando um modelo
 * estoura a cota, "abre" por alguns minutos para não perder tempo tentando de
 * novo.
 *
 * LIMITAÇÃO CONHECIDA: em ambiente serverless (Vercel) cada instância tem o seu
 * próprio estado e ele zera em cold start. Serve para poupar latência dentro de
 * uma mesma instância "quente".
 * @module server/ai/circuitBreaker
 */

const openUntil = new Map();

const DEFAULT_COOLDOWN_MS = Number(process.env.AI_BREAKER_COOLDOWN_MS) || 5 * 60 * 1000;

/** @param {string} key */
export function isOpen(key) {
  const until = openUntil.get(key);
  if (!until) return false;

  if (Date.now() >= until) {
    openUntil.delete(key);
    return false;
  }

  return true;
}

/**
 * @param {string} key
 * @param {number} [cooldownMs]
 */
export function trip(key, cooldownMs = DEFAULT_COOLDOWN_MS) {
  openUntil.set(key, Date.now() + cooldownMs);
}

/** @param {string} key */
export function reset(key) {
  openUntil.delete(key);
}

export function snapshot() {
  const now = Date.now();
  return [...openUntil.entries()]
    .filter(([, until]) => until > now)
    .map(([key, until]) => ({ key, reopensInMs: until - now }));
}
