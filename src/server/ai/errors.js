// Classificação de erros de provedores de IA para decidir a estratégia de fallback.

/**
 * @typedef {"quota"|"overloaded"|"server"|"not_found"|"auth"|"timeout"|"content_filter"|"unknown"} ProviderErrorKind
 */

/**
 * @param {unknown} error
 * @returns {ProviderErrorKind}
 */
export function classifyProviderError(error) {
  const status =
    error?.status ?? error?.statusCode ?? error?.response?.status ?? error?.cause?.status ?? null;

  const message = String(error?.message || "").toLowerCase();

  if (
    status === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "quota";
  }

  if (
    status === 503 ||
    message.includes("overloaded") ||
    message.includes("high demand") ||
    message.includes("service unavailable") ||
    message.includes("unavailable")
  ) {
    return "overloaded";
  }

  if (status === 500 || status === 502 || status === 504) {
    return "server";
  }

  if (
    status === 404 ||
    message.includes("not found") ||
    message.includes("no longer available") ||
    message.includes("is not supported")
  ) {
    return "not_found";
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes("api key") ||
    message.includes("api_key") ||
    message.includes("permission denied") ||
    message.includes("unauthenticated")
  ) {
    return "auth";
  }

  if (
    error?.name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("etimedout")
  ) {
    return "timeout";
  }

  if (
    message.includes("safety") ||
    message.includes("blocked") ||
    message.includes("content filter") ||
    message.includes("recitation")
  ) {
    return "content_filter";
  }

  return "unknown";
}

// Erros em que vale retentar o MESMO modelo (com backoff) antes de cair pro próximo.
export const RETRYABLE_SAME_MODEL = new Set(["overloaded", "server", "timeout"]);
