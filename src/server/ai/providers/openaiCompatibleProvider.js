/**
 * @file Provedor genérico para APIs no formato OpenAI /chat/completions (Groq, OpenRouter, Mistral, Cerebras). Presets por provedor; chave sempre do ambiente.
 * @module server/ai/providers/openaiCompatibleProvider
 */

import { toAssistantStyleMessages, fetchJson, streamViaSse } from "@/server/ai/providers/shared";

// Presets para provedores com API no formato OpenAI /chat/completions.
// A chave vem sempre do ambiente; nada é hardcoded.
const PRESETS = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    apiKeyEnv: "MISTRAL_API_KEY",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    extraHeaders: {
      "HTTP-Referer": process.env.PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Chatbot IFPR",
    },
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1",
    apiKeyEnv: "CEREBRAS_API_KEY",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
  },
};

const ATTEMPT_TIMEOUT_MS = Number(process.env.AI_ATTEMPT_TIMEOUT_MS) || 25000;

/** @param {string} presetId */
export function isConfigured(presetId) {
  const preset = PRESETS[presetId];
  return Boolean(preset && process.env[preset.apiKeyEnv]?.trim());
}

function getConfig(presetId) {
  const preset = PRESETS[presetId];
  if (!preset) {
    const error = new Error(`Provedor OpenAI-compat desconhecido: "${presetId}".`);
    error.statusCode = 500;
    throw error;
  }
  const apiKey = process.env[preset.apiKeyEnv]?.trim();
  if (!apiKey) {
    const error = new Error(`${preset.apiKeyEnv} não configurada.`);
    error.statusCode = 500;
    throw error;
  }
  return { baseUrl: preset.baseUrl, apiKey, extraHeaders: preset.extraHeaders || {} };
}

async function createCompletion(presetId, model, messages) {
  const { baseUrl, apiKey, extraHeaders } = getConfig(presetId);

  const data = await fetchJson(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({ model, messages, temperature: 0.4 }),
    },
    ATTEMPT_TIMEOUT_MS,
  );

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error(`Modelo ${presetId}:${model} retornou resposta vazia.`);
  return text;
}

/**
 * @param {string} presetId  ex: "groq"
 * @param {string} model     ex: "llama-3.3-70b-versatile"
 * @returns {import("./types").Provider}
 */
export function createOpenAICompatibleProvider(presetId, model) {
  return {
    id: presetId,
    model,

    async sendChat({ systemPrompt, history, message }) {
      const messages = [
        { role: "system", content: systemPrompt },
        ...toAssistantStyleMessages(history),
        { role: "user", content: message },
      ];
      return { text: await createCompletion(presetId, model, messages) };
    },

    async generateText({ prompt }) {
      const messages = [{ role: "user", content: prompt }];
      return { text: await createCompletion(presetId, model, messages) };
    },

    async *streamChat({ systemPrompt, history, message }) {
      const { baseUrl, apiKey, extraHeaders } = getConfig(presetId);
      const messages = [
        { role: "system", content: systemPrompt },
        ...toAssistantStyleMessages(history),
        { role: "user", content: message },
      ];

      yield* streamViaSse(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...extraHeaders,
          },
          body: JSON.stringify({ model, messages, temperature: 0.4, stream: true }),
        },
        (evt) => evt?.choices?.[0]?.delta?.content || "",
        ATTEMPT_TIMEOUT_MS,
      );
    },
  };
}

export const OPENAI_COMPAT_PRESETS = Object.keys(PRESETS);
