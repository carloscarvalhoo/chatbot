/**
 * @file Baixa e limpa o texto de uma página HTML, com timeout, limite de tamanho e suporte a GET condicional (ETag / If-Modified-Since).
 * @module server/knowledge/scrapePage
 */

import * as cheerio from "cheerio";
import { logger } from "@/server/utils/logger";

const FETCH_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 15000;
const MAX_HTML_BYTES = Number(process.env.SCRAPE_MAX_BYTES) || 3_000_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ChatbotIFPR/1.0";

/**
 * Baixa e limpa o texto de uma página.
 *
 * @param {string} url
 * @param {object} [conditional] Se informado, envia If-None-Match /
 *   If-Modified-Since. Uma resposta 304 devolve `{ notModified: true }` sem
 *   baixar o corpo.
 * @param {string} [conditional.etag]
 * @param {string} [conditional.lastModified]
 * @returns {Promise<null | {notModified: true} | {title: string, text: string, etag: (string|null), lastModified: (string|null)}>}
 */
export async function scrapePage(url, conditional = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const headers = { "User-Agent": USER_AGENT, Accept: "text/html" };
    if (conditional.etag) headers["If-None-Match"] = conditional.etag;
    if (conditional.lastModified) headers["If-Modified-Since"] = conditional.lastModified;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
      redirect: "follow",
    });

    if (response.status === 304) {
      return { notModified: true };
    }

    if (!response.ok) {
      logger.warn(`⚠️ scrape: ${url} respondeu ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      logger.warn(`⚠️ scrape: ${url} não é HTML (${contentType})`);
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_HTML_BYTES) {
      logger.warn(`⚠️ scrape: ${url} muito grande (${contentLength} bytes)`);
      return null;
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      logger.warn(`⚠️ scrape: ${url} corpo muito grande (${html.length} bytes)`);
      return null;
    }

    const $ = cheerio.load(html);
    const title = $("title").first().text().trim() || "Página Web";

    $(
      "script, style, nav, footer, header, iframe, noscript, .menu, #sidebar, [role=navigation]",
    ).remove();

    const text = $("main, article, #content, .content, body")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 50) {
      logger.warn(`⚠️ scrape: ${url} conteúdo curto demais (${text.length} chars)`);
      return null;
    }

    return {
      title,
      text,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  } catch (error) {
    logger.warn(`⚠️ scrape: falha em ${url}: ${error?.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
