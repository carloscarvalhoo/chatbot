export async function sendChatMessage(
  { message, bufferHistory, longMemory, conversationId, preferredModel },
  { onDelta } = {},
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, bufferHistory, longMemory, conversationId, preferredModel }),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data?.error || "Erro ao enviar mensagem.");
    err.retryAfterMs = data?.retryAfterMs || null;
    err.reason = data?.reason || null;
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = null;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (event.type === "delta") {
      // O usuário não quer travessão / meia-risca — normaliza para hífen.
      text += String(event.value).replace(/\s[—–]\s/g, " - ");
      onDelta?.(text);
    } else if (event.type === "done") {
      done = { ...event, text: String(event.text || text).replace(/\s[—–]\s/g, " - ") };
    } else if (event.type === "error") {
      const err = new Error(event.error || "Erro ao responder.");
      err.retryAfterMs = event.retryAfterMs || null;
      err.reason = event.reason || null;
      throw err;
    }
  };

  for (;;) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }
  if (buffer) handleLine(buffer);

  if (!done) {
    // stream terminou sem "done" — devolve o que tiver
    return { text };
  }
  return done;
}

export async function sendRating({ messageId, conversationId, rating, messageText, userName }) {
  const response = await fetch("/api/chat/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, conversationId, rating, messageText, userName }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error || "Erro ao enviar avaliação.");
  }

  return response.json();
}
