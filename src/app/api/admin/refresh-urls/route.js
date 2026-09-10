import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { refreshAllUrls } from "@/server/knowledge/refreshUrls";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const summary = await refreshAllUrls();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    logger.error("Erro ao verificar atualizações das URLs:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao verificar atualizações." },
      { status: 500 },
    );
  }
}
