import { NextResponse } from "next/server";
import { adminAuth } from "@/server/firebase/admin";
import { getAdminClaims } from "@/server/auth/getAdminClaims";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const ADMIN_COOKIE_NAME = "firebase_admin_session";
const MIN_PASSWORD = 8;

export async function GET() {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const user = await adminAuth.getUser(claims.uid);
    return NextResponse.json({ email: user.email || claims.email || "" });
  } catch {
    return NextResponse.json({ email: claims.email || "" });
  }
}

/** Confere a senha atual pelo endpoint REST de login do Firebase Auth. */
async function verifyCurrentPassword(email, password) {
  if (!FIREBASE_API_KEY) {
    throw Object.assign(new Error("Configuração do Firebase ausente no servidor."), {
      statusCode: 500,
    });
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    },
  );
  if (!res.ok) {
    throw Object.assign(new Error("Senha atual incorreta."), { statusCode: 401 });
  }
}

export async function POST(request) {
  const claims = await getAdminClaims();
  if (!claims) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = String(body?.currentPassword || "");
    const newEmail = body?.email ? String(body.email).trim() : "";
    const newPassword = body?.newPassword ? String(body.newPassword) : "";

    if (!currentPassword) {
      return NextResponse.json({ error: "Informe a senha atual." }, { status: 400 });
    }
    if (!newEmail && !newPassword) {
      return NextResponse.json(
        { error: "Nada para alterar. Preencha um novo e-mail ou uma nova senha." },
        { status: 400 },
      );
    }
    if (newPassword && newPassword.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` },
        { status: 400 },
      );
    }
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const user = await adminAuth.getUser(claims.uid);
    const currentEmail = user.email || claims.email;
    if (!currentEmail) {
      return NextResponse.json(
        { error: "Não foi possível identificar o e-mail atual da conta." },
        { status: 400 },
      );
    }

    await verifyCurrentPassword(currentEmail, currentPassword);

    const update = {};
    if (newEmail && newEmail !== currentEmail) update.email = newEmail;
    if (newPassword) update.password = newPassword;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "O novo e-mail é igual ao atual." }, { status: 400 });
    }

    await adminAuth.updateUser(claims.uid, update);

    const passwordChanged = Boolean(update.password);
    if (passwordChanged) {
      await adminAuth.revokeRefreshTokens(claims.uid);
    }

    const response = NextResponse.json({
      success: true,
      email: update.email || currentEmail,
      requiresRelogin: passwordChanged,
    });

    if (passwordChanged) {
      response.cookies.set({
        name: ADMIN_COOKIE_NAME,
        value: "",
        httpOnly: true,
        path: "/",
        maxAge: 0,
      });
    }

    return response;
  } catch (error) {
    logger.error("Erro em /api/admin/account:", error);
    const status = error?.statusCode || 500;
    if (error?.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Esse e-mail já está em uso." }, { status: 400 });
    }
    return NextResponse.json(
      { error: status === 500 ? "Não foi possível atualizar a conta." : error.message },
      { status },
    );
  }
}
