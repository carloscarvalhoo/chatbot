import { logger } from "@/server/utils/logger";

const FETCH_TIMEOUT_MS = Number(process.env.SITEMAP_TIMEOUT_MS) || 12000;
const MAX_SITEMAPS = 40;

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    return u.href.replace(/\/$/, "").toLowerCase();
  } catch {
    return String(url || "")
      .trim()
      .toLowerCase();
  }
}

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ChatbotIFPR/1.0 (+sitemap-check)",
        Accept: "application/xml,text/xml,*/*",
      },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extrai pares <loc>/<lastmod> de um XML de sitemap. */
export function parseUrlset(xml) {
  const entries = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1];
    const lastmod = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1];
    if (loc) entries.push({ loc, lastmod: lastmod || null });
  }
  return entries;
}

/** Extrai <loc> de um índice de sitemaps. */
export function parseSitemapIndex(xml) {
  return [...(xml.match(/<sitemap>[\s\S]*?<\/sitemap>/gi) || [])]
    .map((b) => b.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1])
    .filter(Boolean);
}

/** Descobre a(s) URL(s) de sitemap de uma origem. */
async function discoverSitemaps(origin) {
  const robots = await fetchText(`${origin}/robots.txt`);
  const fromRobots = robots ? [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];

  const candidates = [
    ...fromRobots,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml`,
  ];

  return [...new Set(candidates)];
}

/**
 * Carrega um mapa { urlNormalizada -> Date(lastmod) } para toda a origem.
 * Retorna Map vazio se o site não tiver sitemap ou não trouxer lastmod.
 *
 * @param {string} origin  ex: "https://ifpr.edu.br"
 * @returns {Promise<Map<string, Date>>}
 */
export async function loadSitemapLastmod(origin) {
  const result = new Map();
  const seen = new Set();
  const queue = await discoverSitemaps(origin);
  let processed = 0;

  while (queue.length && processed < MAX_SITEMAPS) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    processed += 1;

    const xml = await fetchText(url);
    if (!xml) continue;

    if (/<sitemapindex/i.test(xml)) {
      for (const child of parseSitemapIndex(xml)) {
        if (!seen.has(child)) queue.push(child);
      }
      continue;
    }

    for (const { loc, lastmod } of parseUrlset(xml)) {
      if (!lastmod) continue;
      const date = new Date(lastmod);
      if (Number.isNaN(date.getTime())) continue;
      result.set(normalizeUrl(loc), date);
    }
  }

  if (result.size) {
    logger.debug(`🗺️ sitemap de ${origin}: ${result.size} URLs com lastmod`);
  }
  return result;
}

export { normalizeUrl as normalizeSitemapUrl };
