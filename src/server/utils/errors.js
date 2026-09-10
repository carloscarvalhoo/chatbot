export function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function handleRouteError(error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return {
    error: error?.message || fallbackMessage,
    status: error?.statusCode || 500,
  };
}
