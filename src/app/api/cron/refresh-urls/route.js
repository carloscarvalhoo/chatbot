import { NextResponse } from "next/server";
import { refreshAllUrls } from "@/server/knowledge/refreshUrls";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Re-raspar ~140 páginas + re-embeddar as que mudaram é lento.
export const maxDuration = 300;

/**
 * Autoriza via `Authorization: Bearer <CRON_SECRET>` (formato do Vercel Cron)
 * ou `?secret=<CRON_SECRET>` (para GitHub Actions / chamada manual).
 */
function isAuthorized(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const summary = await refreshAllUrls({
      onProgress: (done, total) => {
        if (done % 20 === 0) logger.debug(`♻️ cron refresh ${done}/${total}`);
      },
    });

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      ...summary,
    });
  } catch (error) {
    logger.error("Erro no cron refresh-urls:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar as páginas." },
      { status: 500 },
    );
  }
}

// Vercel Cron dispara GET; POST fica disponível para chamada manual.
export const GET = handle;
export const POST = handle;
