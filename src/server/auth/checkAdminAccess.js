/**
 * @file Guarda das rotas do painel: valida o cookie de sessão do Firebase.
 * @module server/auth/checkAdminAccess
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAuth } from "@/server/firebase/admin";

const ADMIN_COOKIE_NAME = "firebase_admin_session";

/**
 * @returns {Promise<import("next/server").NextResponse | null>}
 *   `null` se o admin está autenticado; uma resposta 401 caso contrário
 *   (a rota deve devolver essa resposta e parar).
 */
export async function checkAdminAccess() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    await adminAuth.verifySessionCookie(sessionCookie, true);
    return null;
  } catch {
    return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  }
}
