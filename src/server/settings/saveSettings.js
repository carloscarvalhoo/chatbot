/**
 * @file Valida e grava a configuração institucional, e invalida o cache.
 * @module server/settings/saveSettings
 */

import { adminDb } from "@/server/firebase/admin";
import { createHttpError } from "@/server/utils/errors";
import { invalidateSettingsCache } from "@/server/settings/getSettings";
import { describeSpec } from "@/server/ai/chain";

const ALLOWED_FIELDS = [
  "institutionName",
  "botName",
  "welcomeMessage",
  "primaryColor",
  "suggestedQuestions",
  "footerNote",
  "supportUrl",
  "supportLabel",
  "supportContacts",
  "aiChain",
];

export async function saveSettings(data) {
  if (!data || typeof data !== "object") {
    throw createHttpError("Dados inválidos.", 400);
  }

  const sanitized = {};

  for (const field of ALLOWED_FIELDS) {
    if (field in data) {
      sanitized[field] = data[field];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw createHttpError("Nenhum campo válido para salvar.", 400);
  }

  if (sanitized.institutionName !== undefined) {
    sanitized.institutionName = String(sanitized.institutionName).trim().slice(0, 200);
  }

  if (sanitized.botName !== undefined) {
    sanitized.botName = String(sanitized.botName).trim().slice(0, 50);
  }

  if (sanitized.welcomeMessage !== undefined) {
    sanitized.welcomeMessage = String(sanitized.welcomeMessage).trim().slice(0, 300);
  }

  if (sanitized.footerNote !== undefined) {
    sanitized.footerNote = String(sanitized.footerNote).trim().slice(0, 300);
  }

  if (sanitized.supportUrl !== undefined) {
    const raw = String(sanitized.supportUrl).trim().slice(0, 500);
    if (raw && !/^https?:\/\//i.test(raw)) {
      throw createHttpError("O link de suporte deve começar com http:// ou https://", 400);
    }
    sanitized.supportUrl = raw;
  }

  if (sanitized.supportLabel !== undefined) {
    sanitized.supportLabel = String(sanitized.supportLabel).trim().slice(0, 60);
  }

  if (sanitized.supportContacts !== undefined) {
    if (!Array.isArray(sanitized.supportContacts)) {
      throw createHttpError("supportContacts deve ser um array.", 400);
    }
    sanitized.supportContacts = sanitized.supportContacts
      .map((contact) => ({
        label: String(contact?.label || "")
          .trim()
          .slice(0, 60),
        value: String(contact?.value || "")
          .trim()
          .slice(0, 200),
      }))
      .filter((contact) => contact.label && contact.value)
      .slice(0, 8);
  }

  if (sanitized.suggestedQuestions !== undefined) {
    if (!Array.isArray(sanitized.suggestedQuestions)) {
      throw createHttpError("suggestedQuestions deve ser um array.", 400);
    }
    sanitized.suggestedQuestions = sanitized.suggestedQuestions
      .map((q) => String(q).trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (sanitized.aiChain !== undefined) {
    if (!Array.isArray(sanitized.aiChain)) {
      throw createHttpError("aiChain deve ser um array.", 400);
    }
    const seen = new Set();
    const cleaned = [];
    for (const item of sanitized.aiChain.slice(0, 20)) {
      const spec = String(item?.spec || "").trim();
      if (!spec || seen.has(spec)) continue;
      const info = describeSpec(spec);
      if (info.provider && !info.model) {
        throw createHttpError(`Modelo inválido: "${spec}". Use o formato provedor:modelo.`, 400);
      }
      if (info.reason === "provedor desconhecido") {
        throw createHttpError(`Provedor desconhecido em "${spec}".`, 400);
      }
      seen.add(spec);
      cleaned.push({ spec, enabled: item?.enabled !== false });
    }
    if (cleaned.length && !cleaned.some((c) => c.enabled && describeSpec(c.spec).available)) {
      throw createHttpError(
        "Pelo menos um modelo ativo precisa ter chave de API configurada.",
        400,
      );
    }
    sanitized.aiChain = cleaned;
  }

  sanitized.updatedAt = new Date();

  await adminDb.collection("settings").doc("institution").set(sanitized, { merge: true });

  invalidateSettingsCache();

  return { success: true };
}
