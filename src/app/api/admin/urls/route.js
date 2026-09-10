import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { saveKnowledgeUrl } from "@/server/knowledge/saveKnowledgeUrl";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const { urlsSelecionadas } = await request.json();

    if (!Array.isArray(urlsSelecionadas) || urlsSelecionadas.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma URL fornecida para processamento." },
        { status: 400 },
      );
    }

    let processed = 0;
    const skipped = [];

    for (const url of urlsSelecionadas) {
      logger.debug(`🤖 Processando: ${url}`);
      const scraped = await scrapePage(url);

      if (!scraped) {
        skipped.push(url);
        continue;
      }

      await saveKnowledgeUrl(scraped.title, url, scraped.text);
      processed += 1;
    }

    return NextResponse.json({
      success: true,
      message: `${processed} página(s) indexada(s).${
        skipped.length ? ` ${skipped.length} ignorada(s) (inacessível ou vazia).` : ""
      }`,
      processed,
      skipped,
    });
  } catch (error) {
    logger.error("Erro no processamento das URLs:", error);
    return NextResponse.json({ error: "Erro interno ao indexar as URLs." }, { status: 500 });
  }
}
