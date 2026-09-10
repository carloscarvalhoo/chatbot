import { NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "firebase_admin_session";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logout realizado com sucesso.",
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
