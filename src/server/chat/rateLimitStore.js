import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/server/firebase/admin";
import { logger } from "@/server/utils/logger";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 10 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 20;

// Cache local por instância: evita ir ao Firestore quando o IP está claramente
// dentro do limite. Só consulta o banco quando passa da metade da cota.
const local = new Map();
const SOFT_THRESHOLD = Math.ceil(MAX_REQUESTS / 2);

function bump(ip, now) {
  const entry = local.get(ip);
  if (!entry || now - entry.windowStartedAt > WINDOW_MS) {
    const fresh = { count: 1, windowStartedAt: now };
    local.set(ip, fresh);
    return fresh;
  }
  entry.count += 1;
  return entry;
}

function docRef(ip) {
  return adminDb.collection("rateLimits").doc(encodeURIComponent(ip).slice(0, 200));
}

/**
 * @param {string} ip
 * @returns {Promise<{ allowed: boolean, retryAfterMs: number }>}
 */
export async function checkRateLimit(ip) {
  const now = Date.now();
  const localEntry = bump(ip, now);

  // Limite local é fonte da verdade para abuso de uma mesma instância
  // (o caso comum: um cliente martelando). Bloqueia sempre que estourar.
  if (localEntry.count > MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterMs: Math.max(1000, localEntry.windowStartedAt + WINDOW_MS - now),
    };
  }

  // Caminho quente: claramente dentro do limite → nem toca no Firestore.
  if (localEntry.count <= SOFT_THRESHOLD) {
    return { allowed: true, retryAfterMs: 0 };
  }

  // Perto do limite (ou tráfego distribuído entre instâncias) → fonte da verdade
  // é o Firestore. Custo: 1 leitura + 1 escrita, só nesse caso.
  try {
    const ref = docRef(ip);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    const windowStartedAt = data?.windowStartedAt?.toMillis?.() ?? data?.windowStartedAt ?? 0;
    const expired = now - windowStartedAt > WINDOW_MS;
    const count = expired ? 0 : data?.count || 0;

    if (count >= MAX_REQUESTS) {
      return { allowed: false, retryAfterMs: Math.max(1000, windowStartedAt + WINDOW_MS - now) };
    }

    await ref.set(
      expired
        ? { count: 1, windowStartedAt: now }
        : { count: FieldValue.increment(1), windowStartedAt: windowStartedAt || now },
      { merge: true },
    );
    return { allowed: true, retryAfterMs: 0 };
  } catch (error) {
    // Se o Firestore falhar, cai no limite local (melhor que bloquear tudo).
    logger.warn("Rate limit: Firestore indisponível, usando limite local:", error?.message);
    const allowed = localEntry.count <= MAX_REQUESTS;
    return {
      allowed,
      retryAfterMs: allowed ? 0 : localEntry.windowStartedAt + WINDOW_MS - now,
    };
  }
}
