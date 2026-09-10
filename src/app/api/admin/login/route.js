import { NextResponse } from "next/server";
import { adminAuth } from "@/server/firebase/admin";

const ADMIN_COOKIE_NAME = "firebase_admin_session";
const SESSION_EXPIRES_IN = 1000 * 60 * 60 * 8;

export async function POST(request) {
  try {
    const body = await request.json();
    const idToken = String(body?.idToken || "").trim();

    if (!idToken) {
      return NextResponse.json({ error: "Token de autenticação não enviado." }, { status: 400 });
    }

    await adminAuth.verifyIdToken(idToken);

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login realizado com sucesso.",
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_EXPIRES_IN / 1000,
    });

    return response;
  } catch (error) {
    console.error("Erro no login admin:", error);

    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
}
