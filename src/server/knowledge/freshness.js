// Cálculo puro do estado de frescor de um documento — sem I/O, testável.

const DEFAULT_REVIEW_INTERVAL_MONTHS = Number(process.env.REVIEW_INTERVAL_MONTHS) || 12;

// Tipos de página cujo conteúdo "vence" quando o ano vira (edital do ano
// passado, calendário do ano passado, portaria substituída anualmente...).
const YEARLY_KINDS = new Set(["seletivo", "normativo", "calendario"]);

export function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {object} fileData  dados do doc knowledgeFiles
 * @returns {"fresh"|"dueForReview"|"expired"}
 */
export function computeFreshness(fileData = {}) {
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Validade explícita (raramente usada — o gestor pode marcar).
  const expiresAt = toDate(fileData.expiresAt);
  if (expiresAt && expiresAt.getTime() < nowMs) return "expired";

  // 2. Conteúdo de ano anterior em página que "vence" por ano.
  const sourceDate = toDate(fileData.sourceDate);
  if (
    sourceDate &&
    YEARLY_KINDS.has(fileData.docKind) &&
    sourceDate.getFullYear() < now.getFullYear()
  ) {
    return "expired";
  }

  // 3. Tempo desde a última verificação vs intervalo de revisão do tipo de página.
  const months = Number(fileData.reviewIntervalMonths);
  const interval = Number.isFinite(months) ? months : DEFAULT_REVIEW_INTERVAL_MONTHS;
  if (interval <= 0) return "fresh"; // notícias, etc. não precisam de revisão

  const lastReviewedAt =
    toDate(fileData.lastReviewedAt) ||
    toDate(fileData.lastCheckedAt) ||
    toDate(fileData.updatedAt) ||
    toDate(fileData.uploadedAt);
  if (!lastReviewedAt) return "dueForReview";

  const dueAt = new Date(lastReviewedAt);
  dueAt.setMonth(dueAt.getMonth() + interval);
  if (dueAt.getTime() < nowMs) return "dueForReview";

  return "fresh";
}

export { DEFAULT_REVIEW_INTERVAL_MONTHS };
