// Contrato que todo provedor de IA implementa (Google e APIs compatíveis com
// OpenAI, como Groq, OpenRouter, Mistral e Cerebras).

/**
 * @typedef {Object} ChatTurn
 * @property {"user"|"model"} role
 * @property {string} text
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} systemPrompt
 * @property {ChatTurn[]} history
 * @property {string} message
 */

/**
 * @typedef {Object} ProviderResult
 * @property {string} text
 */

/**
 * @typedef {Object} Provider
 * @property {string} id           Identificador do provedor (ex: "google").
 * @property {string} model        Nome do modelo (ex: "gemini-3.6-flash").
 * @property {(req: ChatRequest) => Promise<ProviderResult>} sendChat
 * @property {(req: { prompt: string }) => Promise<ProviderResult>} generateText
 */

export {};
