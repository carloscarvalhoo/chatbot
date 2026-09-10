/**
 * @file Memória da conversa: mantém um buffer curto de mensagens e resume o excedente num texto de "memória longa".
 * @module server/ai/memory
 */

import { generateTextWithFallback } from "@/server/ai/fallback";
import { getMemorySummaryPrompt } from "@/server/ai/prompts";

const MAX_BUFFER_MESSAGES = 20;
const MAX_BUFFER_CHARS = 10000;
const KEEP_TAIL_MESSAGES = 8;

function getHistoryCharCount(history = []) {
  return history.reduce((total, message) => {
    return total + String(message?.text || "").length;
  }, 0);
}

function normalizeMessage(message) {
  if (!message) return null;

  const role = message.role === "model" ? "model" : "user";
  const text = String(message.text || "").trim();

  if (!text) return null;

  return {
    role,
    text,
  };
}

export function normalizeBufferHistory(bufferHistory = []) {
  if (!Array.isArray(bufferHistory)) return [];

  return bufferHistory.map(normalizeMessage).filter(Boolean);
}

function formatMessagesForSummary(messages = []) {
  return messages
    .map((message, index) => {
      const speaker = message.role === "user" ? "Usuário" : "ELO";
      return `${index + 1}. ${speaker}: ${message.text}`;
    })
    .join("\n");
}

export function shouldSummarizeHistory(bufferHistory = []) {
  const hitCountLimit = bufferHistory.length >= MAX_BUFFER_MESSAGES;
  const hitCharLimit = getHistoryCharCount(bufferHistory) >= MAX_BUFFER_CHARS;

  return {
    shouldSummarize: hitCountLimit || hitCharLimit,
    hitCountLimit,
    hitCharLimit,
    charCount: getHistoryCharCount(bufferHistory),
    messageCount: bufferHistory.length,
  };
}

export async function updateMemoryIfNeeded({ currentBufferHistory = [], longMemory = "" }) {
  const normalizedHistory = normalizeBufferHistory(currentBufferHistory);

  const summaryCheck = shouldSummarizeHistory(normalizedHistory);

  if (!summaryCheck.shouldSummarize) {
    return {
      bufferHistory: normalizedHistory,
      longMemory,
      didSummarize: false,
      summaryCheck,
    };
  }

  const messagesToSummarize = normalizedHistory.slice(
    0,
    Math.max(0, normalizedHistory.length - KEEP_TAIL_MESSAGES),
  );

  const tailMessages = normalizedHistory.slice(-KEEP_TAIL_MESSAGES);

  if (!messagesToSummarize.length) {
    return {
      bufferHistory: normalizedHistory,
      longMemory,
      didSummarize: false,
      summaryCheck,
    };
  }

  const prompt = getMemorySummaryPrompt({
    previousLongMemory: longMemory,
    messagesText: formatMessagesForSummary(messagesToSummarize),
  });

  let updatedLongMemory = "";

  try {
    const result = await generateTextWithFallback(prompt);
    updatedLongMemory = result.text;
  } catch {
    updatedLongMemory = longMemory || "";
  }

  if (!updatedLongMemory) updatedLongMemory = longMemory || "";

  return {
    bufferHistory: tailMessages,
    longMemory: updatedLongMemory,
    didSummarize: true,
    summaryCheck,
  };
}
