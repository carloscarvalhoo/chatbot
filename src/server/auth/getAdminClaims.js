/**
 * @file Lê as claims do admin logado (uid, email) — para rotas que precisam
 * saber QUEM é o admin, não só se ele está autenticado.
 * @module server/auth/getAdminClaims
 */

import { cookies } from "next/headers";
import { adminAuth } from "@/server/firebase/admin";

const ADMIN_COOKIE_NAME = "firebase_admin_session";

/**
 * @returns {Promise<import("firebase-admin/auth").DecodedIdToken | null>}
 *   as claims (`uid`, `email`, ...) ou `null` se não houver sessão válida.
 */
export async function getAdminClaims() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
