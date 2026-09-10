import { cookies } from "next/headers";
import { adminAuth } from "@/server/firebase/admin";

const ADMIN_COOKIE_NAME = "firebase_admin_session";

/**
 * Devolve as claims do admin logado ({ uid, email, ... }) ou null.
 * Diferente de checkAdminAccess (que devolve uma Response de erro), este
 * é pra quando a rota precisa saber QUEM é o admin.
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
