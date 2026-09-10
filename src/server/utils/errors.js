/**
 * @file Helpers de erro HTTP compartilhados pelas rotas.
 * @module server/utils/errors
 */

/**
 * Cria um Error com um `statusCode` anexado, para as rotas devolverem o
 * código HTTP certo (400, 401, 429, ...).
 * @param {string} message  mensagem segura para o cliente
 * @param {number} [statusCode=500]
 * @returns {Error} um Error com a propriedade `statusCode` anexada
 */
export function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Loga o erro no servidor e devolve um objeto `{ error, status }` pronto para
 * virar resposta JSON, sem vazar detalhes internos.
 * @param {unknown} error
 * @param {string} fallbackMessage  mensagem usada se o erro não tiver uma
 * @returns {{ error: string, status: number }}
 */
export function handleRouteError(error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return {
    error: error?.message || fallbackMessage,
    status: error?.statusCode || 500,
  };
}
