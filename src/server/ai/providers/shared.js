/**
 * @file Helpers comuns aos provedores baseados em fetch: conversão de histórico, fetch com timeout e ponte de SSE para async generator.
 *
 * Helpers comuns aos provedores baseados em fetch (APIs compatíveis com OpenAI).
 * @module server/ai/providers/shared
 */

/**
 * Histórico interno ({role:"user"|"model", text}) → formato de chat padrão
 * ({role:"user"|"assistant", content}).
 * @param {import("./types").ChatTurn[]} history
 */
export function toAssistantStyleMessages(history = []) {
  return history
    .filter(
      (turn) =>
        turn &&
        ["user", "model"].includes(turn.role) &&
        typeof turn.text === "string" &&
        turn.text.trim(),
    )
    .map((turn) => ({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text.trim(),
    }));
}

/**
 * fetch com timeout via AbortController e erro tipado (status preservado
 * para o classifyProviderError).
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 */
export async function fetchJson(url, init, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Timeout de ${timeoutMs}ms na chamada ao provedor.`);
      timeoutError.name = "AbortError";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      data?.error ||
      `Provedor respondeu ${response.status}.`;
    const error = new Error(String(message));
    error.status = response.status;
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

/**
 * Adapta o callback do fetchSse para um async generator de deltas de texto.
 * `pickDelta(evt)` extrai o texto de cada evento SSE (ou "" para ignorar).
 */
export async function* streamViaSse(url, init, pickDelta, timeoutMs = 60000) {
  const queue = [];
  let notify = () => {};
  let wait = new Promise((resolve) => (notify = resolve));
  let finished = false;
  let failure = null;

  const pump = fetchSse(
    url,
    init,
    (evt) => {
      const delta = pickDelta(evt);
      if (delta) {
        queue.push(delta);
        notify();
        wait = new Promise((resolve) => (notify = resolve));
      }
    },
    timeoutMs,
  )
    .catch((error) => {
      failure = error;
    })
    .finally(() => {
      finished = true;
      notify();
    });

  while (!finished || queue.length) {
    if (!queue.length && !finished) await wait;
    while (queue.length) yield queue.shift();
  }

  await pump;
  if (failure) throw failure;
}

/**
 * POST que devolve um stream SSE. Chama `onEvent(obj)` para cada `data: {...}`.
 * Lança erro tipado (com status) se a resposta não for 2xx.
 */
export async function fetchSse(url, init, onEvent, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    clearTimeout(timer);
    if (error?.name === "AbortError") {
      const e = new Error(`Timeout de ${timeoutMs}ms no stream do provedor.`);
      e.name = "AbortError";
      throw e;
    }
    throw error;
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    const raw = await response.text().catch(() => "");
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const error = new Error(
      parsed?.error?.message || parsed?.message || raw || `Provedor respondeu ${response.status}.`,
    );
    error.status = response.status;
    error.statusCode = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          /* linha parcial / keep-alive */
        }
      }
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
