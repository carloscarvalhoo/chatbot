/**
 * @file Registro de provedores de IA e montagem da cadeia de fallback a partir de specs "provedor:modelo".
 * @module server/ai/chain
 */

import { createGoogleProvider } from "@/server/ai/providers/googleProvider";
import {
  createOpenAICompatibleProvider,
  isConfigured as isOpenAICompatConfigured,
  OPENAI_COMPAT_PRESETS,
} from "@/server/ai/providers/openaiCompatibleProvider";
import { logger } from "@/server/utils/logger";

// Cadeia padrão (só Gemini grátis) quando AI_CHAIN não é definido.
const DEFAULT_CHAIN = [
  "google:gemini-3.6-flash",
  "google:gemini-3.5-flash-lite",
  "google:gemini-2.5-flash",
  "google:gemini-2.5-flash-lite",
];

/**
 * Cada entrada: como instanciar e como saber se as credenciais existem.
 * `configured()` evita colocar na cadeia um provedor sem chave (ele seria só
 * latência + erro garantido).
 */
const PROVIDER_REGISTRY = {
  google: {
    create: (model) => createGoogleProvider(model),
    configured: () => Boolean(process.env.GEMINI_API_KEY?.trim()),
  },
  ...Object.fromEntries(
    OPENAI_COMPAT_PRESETS.map((preset) => [
      preset,
      {
        create: (model) => createOpenAICompatibleProvider(preset, model),
        configured: () => isOpenAICompatConfigured(preset),
      },
    ]),
  ),
};

/**
 * "groq:llama-3.3-70b-versatile" -> Provider
 * "gemini-3.6-flash"             -> Provider (assume google)
 * @param {string} spec
 */
function parseSpec(spec) {
  const trimmed = String(spec || "").trim();
  if (!trimmed) return null;

  const hasProvider = trimmed.includes(":");
  const providerId = hasProvider ? trimmed.slice(0, trimmed.indexOf(":")).trim() : "google";
  const model = hasProvider ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;

  const entry = PROVIDER_REGISTRY[providerId];
  if (!entry) {
    logger.warn(`⚠️ Provider desconhecido na cadeia de IA: "${providerId}" (spec: "${trimmed}")`);
    return null;
  }
  if (!model) {
    logger.warn(`⚠️ Modelo vazio na cadeia de IA (spec: "${trimmed}")`);
    return null;
  }
  if (!entry.configured()) {
    logger.warn(
      `⚠️ "${providerId}" está na AI_CHAIN mas não tem chave configurada. Ignorando "${trimmed}".`,
    );
    return null;
  }

  return entry.create(model);
}

/**
 * Instancia UM provider a partir de "provider:modelo", sem cache e sem
 * pertencer à cadeia principal. Usado pelo comparador de modelos do painel.
 * @param {string} spec
 * @returns {import("./providers/types").Provider}
 */
export function createProviderFromSpec(spec) {
  const provider = parseSpec(spec);
  if (!provider) {
    throw new Error(`Spec de modelo inválido ou sem credencial: "${spec}".`);
  }
  return provider;
}

/** Lista crua de specs vinda do ambiente (ou a cadeia padrão). @returns {string[]} */
export function getEnvChainSpecs() {
  const raw = process.env.AI_CHAIN?.trim() || process.env.GEMINI_MODELS_CHAIN?.trim() || "";
  return (raw ? raw.split(",") : DEFAULT_CHAIN).map((s) => s.trim()).filter(Boolean);
}

/**
 * Descreve um spec sem instanciar nada — pro painel mostrar o que está
 * disponível e validar o que o admin digita.
 * @param {string} spec
 * @returns {{ spec: string, provider: string, model: string, available: boolean, reason?: string }}
 */
export function describeSpec(spec) {
  const trimmed = String(spec || "").trim();
  const hasProvider = trimmed.includes(":");
  const provider = hasProvider ? trimmed.slice(0, trimmed.indexOf(":")).trim() : "google";
  const model = hasProvider ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;

  const entry = PROVIDER_REGISTRY[provider];
  if (!entry)
    return { spec: trimmed, provider, model, available: false, reason: "provedor desconhecido" };
  if (!model) return { spec: trimmed, provider, model, available: false, reason: "modelo vazio" };
  if (!entry.configured())
    return { spec: trimmed, provider, model, available: false, reason: "sem chave de API" };
  return { spec: trimmed, provider, model, available: true };
}

/** Constrói uma cadeia a partir de specs explícitos (sem cache). */
export function buildChainFromSpecs(specs) {
  const chain = (specs || []).map(parseSpec).filter(Boolean);
  if (!chain.length) {
    throw new Error("Nenhum modelo de IA válido na lista fornecida.");
  }
  return chain;
}

let cachedChain = null;

/** @returns {import("./providers/types").Provider[]} */
export function getChain() {
  if (cachedChain) return cachedChain;

  const raw = process.env.AI_CHAIN?.trim() || process.env.GEMINI_MODELS_CHAIN?.trim() || "";
  const specs = raw ? raw.split(",") : DEFAULT_CHAIN;
  let chain = specs.map(parseSpec).filter(Boolean);

  // Se a AI_CHAIN configurada ficou vazia (chaves ausentes), cai pra cadeia padrão.
  if (!chain.length && raw) {
    logger.warn(
      "⚠️ AI_CHAIN não resolveu nenhum provedor válido. Usando a cadeia padrão (Gemini).",
    );
    chain = DEFAULT_CHAIN.map(parseSpec).filter(Boolean);
  }

  if (!chain.length) {
    throw new Error("Nenhum modelo de IA configurado. Verifique GEMINI_API_KEY / AI_CHAIN.");
  }

  cachedChain = chain;
  return cachedChain;
}

/** Para o script de capacidade e a analytics. */
export function getChainInfo() {
  return getChain().map((provider) => ({ provider: provider.id, model: provider.model }));
}

// Compat: código antigo esperava { modelsChain, primary }.
export function getModelNames() {
  const info = getChainInfo();
  return {
    modelsChain: info.map((entry) => entry.model),
    primary: info[0]?.model || null,
  };
}
