import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { reprocessAllKnowledgeFiles } from "@/server/knowledge/reprocessKnowledgeFile";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Reprocessamento é lento (embeddings em lote por documento). Em produção,
// rodar via script/CLI; em dev o timeout maior dá conta.
export const maxDuration = 300;

export async function POST() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const summary = await reprocessAllKnowledgeFiles({
      onProgress: (done, total) => logger.debug(`♻️ reindex ${done}/${total}`),
    });
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    logger.error("Erro no reindex:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao reindexar." },
      { status: error?.statusCode || 500 },
    );
  }
}
