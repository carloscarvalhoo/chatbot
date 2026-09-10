import { adminDb } from "@/server/firebase/admin";
import { scrapePage } from "@/server/knowledge/scrapePage";
import { splitTextIntoChunks } from "@/server/pdf/chunkText";
import { persistKnowledgeDocument } from "@/server/knowledge/saveKnowledgeFile";
import { loadSitemapLastmod, normalizeSitemapUrl } from "@/server/knowledge/sitemap";
import { hashContent } from "@/server/utils/hash";
import { logger } from "@/server/utils/logger";

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Verifica se cada página indexada mudou e re-processa SÓ as que mudaram.
 *
 * Cascata de detecção (mais barata primeiro):
 *  1. `<lastmod>` do sitemap do site — se não for mais novo que a última
 *     verificação, nem baixa a página.
 *  2. Requisição condicional (If-None-Match / If-Modified-Since) — 304 = igual.
 *  3. Hash do conteúdo — comparação final.
 *
 * @param {{ onProgress?: (done: number, total: number) => void }} [options]
 */
export async function refreshAllUrls({ onProgress } = {}) {
  const snapshot = await adminDb.collection("knowledgeFiles").get();
  const urlDocs = snapshot.docs.filter((doc) => doc.data().sourceUrl);

  const summary = {
    total: urlDocs.length,
    checked: 0,
    unchanged: 0,
    skippedBySitemap: 0,
    updated: 0,
    failed: [],
    changedTitles: [],
  };

  // Carrega o sitemap de cada origem uma vez só.
  const origins = [...new Set(urlDocs.map((d) => originOf(d.data().sourceUrl)).filter(Boolean))];
  const sitemaps = new Map();
  for (const origin of origins) {
    sitemaps.set(origin, await loadSitemapLastmod(origin));
  }

  for (let i = 0; i < urlDocs.length; i++) {
    const doc = urlDocs[i];
    const data = doc.data();
    const url = data.sourceUrl;
    const now = new Date();
    const lastChecked =
      toDate(data.lastCheckedAt) || toDate(data.updatedAt) || toDate(data.uploadedAt);

    try {
      const sitemap = sitemaps.get(originOf(url));
      const lastmod = sitemap?.get(normalizeSitemapUrl(url)) || null;

      // 1) Sitemap diz que não mudou desde a última checagem → pula sem baixar.
      if (lastmod && lastChecked && data.contentHash && lastmod <= lastChecked) {
        summary.skippedBySitemap += 1;
        summary.unchanged += 1;
        await doc.ref.set({ lastCheckedAt: now, lastCheckFailed: false }, { merge: true });
        onProgress?.(i + 1, urlDocs.length);
        continue;
      }

      // 2) + 3) Baixa (com requisição condicional) e compara hash.
      const scraped = await scrapePage(url, {
        etag: data.httpEtag || undefined,
        lastModified: data.httpLastModified || undefined,
      });
      summary.checked += 1;

      if (scraped?.notModified) {
        summary.unchanged += 1;
        await doc.ref.set({ lastCheckedAt: now, lastCheckFailed: false }, { merge: true });
        onProgress?.(i + 1, urlDocs.length);
        continue;
      }

      if (!scraped) {
        summary.failed.push({ fileId: doc.id, url });
        await doc.ref.set({ lastCheckedAt: now, lastCheckFailed: true }, { merge: true });
        onProgress?.(i + 1, urlDocs.length);
        continue;
      }

      const newHash = hashContent(scraped.text);
      const hadHash = Boolean(data.contentHash);

      if (hadHash && newHash === data.contentHash) {
        summary.unchanged += 1;
        await doc.ref.set(
          {
            lastCheckedAt: now,
            lastCheckFailed: false,
            httpEtag: scraped.etag || data.httpEtag || null,
            httpLastModified: scraped.lastModified || data.httpLastModified || null,
          },
          { merge: true },
        );
        onProgress?.(i + 1, urlDocs.length);
        continue;
      }

      // Mudou (ou nunca teve hash) → reprocessa.
      const chunks = splitTextIntoChunks(scraped.text);
      await persistKnowledgeDocument({
        fileId: doc.id,
        originalName: scraped.title || data.originalName || url,
        safeName: data.safeName || "link-site",
        meta: {
          contentType: "text/html-url",
          sourceUrl: url,
          size: scraped.text.length,
          totalPages: 1,
          uploadedAt: data.uploadedAt,
          lastCheckedAt: now,
          lastCheckFailed: false,
          httpEtag: scraped.etag || null,
          httpLastModified: scraped.lastModified || null,
          sourceUpdatedAt: lastmod || now,
          contentChangedAt: hadHash ? now : data.contentChangedAt || null,
          needsReview: hadHash, // marca revisão só se REALMENTE mudou
        },
        extractedText: scraped.text,
        chunks,
      });

      summary.updated += 1;
      if (hadHash) summary.changedTitles.push(scraped.title || url);
      logger.info(`♻️ refresh: "${scraped.title || url}" mudou — reprocessado`);
    } catch (error) {
      summary.failed.push({ fileId: doc.id, url, error: error?.message });
      logger.warn(`⚠️ refresh falhou em ${url}: ${error?.message}`);
    }

    onProgress?.(i + 1, urlDocs.length);
  }

  logger.info(
    `♻️ refresh: ${summary.unchanged} iguais (${summary.skippedBySitemap} pelo sitemap), ` +
      `${summary.updated} atualizadas, ${summary.failed.length} falhas`,
  );

  return summary;
}
