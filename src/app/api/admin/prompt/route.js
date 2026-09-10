import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { inspectSystemPrompt } from "@/server/ai/aiService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    return NextResponse.json(await inspectSystemPrompt(""));
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao montar o prompt." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const question = String(body?.question || "").slice(0, 500);
    return NextResponse.json(await inspectSystemPrompt(question));
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao montar o prompt." },
      { status: 500 },
    );
  }
}
