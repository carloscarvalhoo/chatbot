"use client";

import { useCallback, useRef, useState } from "react";
import { sendChatMessage, sendRating } from "@/features/chat/services/chatClient";

const PREFERRED_MODEL_KEY = "chat.preferredModel";

function readStoredModel() {
  if (typeof window === "undefined") return "auto";
  try {
    return localStorage.getItem(PREFERRED_MODEL_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function useChat() {
  const conversationId = useRef(crypto.randomUUID());

  const [messages, setMessages] = useState([]);
  const [bufferHistory, setBufferHistory] = useState([]);
  const [longMemory, setLongMemory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preferredModel, setPreferredModelState] = useState(readStoredModel);

  const setPreferredModel = useCallback((value) => {
    setPreferredModelState(value || "auto");
    try {
      localStorage.setItem(PREFERRED_MODEL_KEY, value || "auto");
    } catch {
      /* ignore */
    }
  }, []);

  const sendMessage = useCallback(
    async (messageText) => {
      const cleanMessage = String(messageText || "").trim();
      if (!cleanMessage || loading) return;

      const userMessage = { id: crypto.randomUUID(), role: "user", text: cleanMessage };
      const botId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: botId, role: "model", text: "", pending: true },
      ]);
      setLoading(true);
      setError("");

      const patchBot = (patch) =>
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)));

      try {
        const result = await sendChatMessage(
          {
            message: cleanMessage,
            bufferHistory,
            longMemory,
            conversationId: conversationId.current,
            preferredModel,
          },
          { onDelta: (text) => patchBot({ text, pending: false }) },
        );

        patchBot({
          text: result.text || "",
          pending: false,
          modelUsed: result.modelUsed || null,
          providerUsed: result.providerUsed || null,
          usedFallback: Boolean(result.usedFallback),
          sources: Array.isArray(result.sources) ? result.sources : [],
          sourcesStale: Boolean(result.sourcesStale),
        });
        if (result.bufferHistory) setBufferHistory(result.bufferHistory);
        setLongMemory(result.longMemory || null);
      } catch (err) {
        const friendlyMessage =
          err?.message || "Tive um problema técnico. Tente novamente em alguns instantes.";

        if (err?.retryAfterMs) {
          // Cota/limite estourado — vira "fila de espera" com contador.
          patchBot({
            pending: false,
            isQueued: true,
            text: "",
            queuedUntil: Date.now() + err.retryAfterMs,
            queuedMs: err.retryAfterMs,
            queuedReason: err.reason || "quota",
          });
        } else {
          setError(friendlyMessage);
          patchBot({ text: friendlyMessage, isError: true, pending: false });
        }
      } finally {
        setLoading(false);
      }
    },
    [bufferHistory, loading, longMemory, preferredModel],
  );

  const rateMessage = useCallback(async ({ messageId, rating, messageText }) => {
    try {
      await sendRating({ messageId, conversationId: conversationId.current, rating, messageText });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, rating } : m)));
    } catch (err) {
      console.error("Erro ao avaliar:", err);
    }
  }, []);

  const startNewChat = useCallback(() => {
    conversationId.current = crypto.randomUUID();
    setMessages([]);
    setBufferHistory([]);
    setLongMemory(null);
    setError("");
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    rateMessage,
    startNewChat,
    preferredModel,
    setPreferredModel,
  };
}
