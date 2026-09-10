import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "A URL é obrigatória." }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Number(process.env.SCRAPE_TIMEOUT_MS) || 15000,
    );

    let response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) throw new Error("Falha ao acessar o site principal.");

    const html = await response.text();
    const $ = cheerio.load(html);
    const urlOriginal = new URL(url);

    const urlsEncontradas = new Set();
    urlsEncontradas.add(urlOriginal.href);

    // Coleta os links válidos
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        try {
          const urlAbsoluta = new URL(href, urlOriginal.origin);
          const mesmoDominio = urlAbsoluta.origin === urlOriginal.origin;
          const ehArquivo = /\.(pdf|jpg|jpeg|png|zip|gif|doc|docx)$/i.test(urlAbsoluta.pathname);

          if (mesmoDominio && !ehArquivo) {
            // Remove a barra final para evitar duplicatas (ex: site.com/ e site.com)
            urlsEncontradas.add(urlAbsoluta.href.replace(/\/$/, ""));
          }
        } catch {
          // Ignora links inválidos
        }
      }
    });

    return NextResponse.json({
      success: true,
      urls: Array.from(urlsEncontradas), // Devolve o array para o front-end montar a lista
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao mapear o site." }, { status: 500 });
  }
}
