import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY?.trim();

function getClient() {
  if (!API_KEY) {
    const error = new Error("GEMINI_API_KEY não configurada.");
    error.statusCode = 500;
    throw error;
  }
  return new GoogleGenerativeAI(API_KEY);
}

function normalizeHistory(history = []) {
  return history
    .filter(
      (turn) =>
        turn &&
        ["user", "model"].includes(turn.role) &&
        typeof turn.text === "string" &&
        turn.text.trim(),
    )
    .map((turn) => ({ role: turn.role, parts: [{ text: turn.text.trim() }] }));
}

// O Gemini não tem role "system" nativa no startChat — simulamos com o primeiro par de turnos.
function buildContextualHistory(systemPrompt, history) {
  return [
    {
      role: "user",
      parts: [{ text: `INSTRUÇÃO DO SISTEMA:\n<<<\n${systemPrompt}\n>>>` }],
    },
    {
      role: "model",
      parts: [
        {
          text: "Entendido. Vou seguir as instruções e responder de acordo com a base de conhecimento quando ela estiver disponível.",
        },
      ],
    },
    ...normalizeHistory(history),
  ];
}

function extractText(result, model) {
  const text = result?.response?.text?.()?.trim() || "";
  if (!text) throw new Error(`Modelo ${model} retornou resposta vazia.`);
  return text;
}

/**
 * @param {string} model
 * @returns {import("./types").Provider}
 */
export function createGoogleProvider(model) {
  return {
    id: "google",
    model,

    async sendChat({ systemPrompt, history, message }) {
      const genModel = getClient().getGenerativeModel({ model });
      const chat = genModel.startChat({
        history: buildContextualHistory(systemPrompt, history),
      });
      const result = await chat.sendMessage(message);
      return { text: extractText(result, model) };
    },

    async generateText({ prompt }) {
      const genModel = getClient().getGenerativeModel({ model });
      const result = await genModel.generateContent(prompt);
      return { text: extractText(result, model) };
    },

    async *streamChat({ systemPrompt, history, message }) {
      const genModel = getClient().getGenerativeModel({ model });
      const chat = genModel.startChat({
        history: buildContextualHistory(systemPrompt, history),
      });
      const result = await chat.sendMessageStream(message);

      for await (const chunk of result.stream) {
        let text = "";
        try {
          text = typeof chunk.text === "function" ? chunk.text() : (chunk.text ?? "");
        } catch {
          text = "";
        }
        if (text) yield text;
      }
    },
  };
}
