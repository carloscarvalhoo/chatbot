// Utilitários de resiliência: timeout e retry com backoff exponencial.

/**
 * Corre `promise` contra um timeout. Se estourar, rejeita com um erro AbortError.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = "operação") {
  let timer;

  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Timeout de ${ms}ms em ${label}.`);
      error.name = "AbortError";
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Executa `fn`, retentando com backoff exponencial enquanto `shouldRetry` permitir.
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @param {{ retries?: number, baseDelayMs?: number, shouldRetry?: (error: unknown) => boolean }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(
  fn,
  { retries = 2, baseDelayMs = 500, shouldRetry = () => true } = {},
) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
