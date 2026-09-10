import { describe, it, expect } from "vitest";
import { parseUrlset, parseSitemapIndex, normalizeSitemapUrl } from "@/server/knowledge/sitemap";

const URLSET = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ifpr.edu.br/a/</loc><lastmod>2026-07-01T10:00:00-03:00</lastmod></url>
  <url><loc>https://ifpr.edu.br/b</loc></url>
</urlset>`;

const INDEX = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://ifpr.edu.br/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://ifpr.edu.br/wp-sitemap-posts-page-1.xml</loc></sitemap>
</sitemapindex>`;

describe("sitemap parsers", () => {
  it("parseUrlset extrai loc + lastmod", () => {
    const entries = parseUrlset(URLSET);
    expect(entries).toHaveLength(2);
    expect(entries[0].loc).toBe("https://ifpr.edu.br/a/");
    expect(entries[0].lastmod).toBe("2026-07-01T10:00:00-03:00");
    expect(entries[1].lastmod).toBeNull();
  });

  it("parseSitemapIndex extrai as sub-sitemaps", () => {
    expect(parseSitemapIndex(INDEX)).toEqual([
      "https://ifpr.edu.br/wp-sitemap-posts-post-1.xml",
      "https://ifpr.edu.br/wp-sitemap-posts-page-1.xml",
    ]);
  });

  it("normalizeSitemapUrl remove barra final, query e hash", () => {
    expect(normalizeSitemapUrl("https://ifpr.edu.br/A/?x=1#y")).toBe("https://ifpr.edu.br/a");
    expect(normalizeSitemapUrl("https://ifpr.edu.br/a")).toBe("https://ifpr.edu.br/a");
  });
});
