import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { compareModels } from "@/server/ai/compareModels";
import { getChainInfo } from "@/server/ai/chain";
import { validateChatMessage } from "@/server/chat/chatGuards";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  return NextResponse.json({ chain: getChainInfo() });
}

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const message = validateChatMessage(body?.message);
    const specs = Array.isArray(body?.specs)
      ? body.specs
          .map((spec) => String(spec).trim())
          .filter(Boolean)
          .slice(0, 8)
      : undefined;

    const data = await compareModels({ message, specs });
    return NextResponse.json(data);
  } catch (error) {
    logger.error("Erro na comparação de modelos:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao comparar modelos." },
      { status: error?.statusCode || 500 },
    );
  }
}
