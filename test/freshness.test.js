import { describe, it, expect } from "vitest";
import { computeFreshness } from "@/server/knowledge/freshness";
import { hashContent } from "@/server/utils/hash";

const daysAgo = (n) => new Date(Date.now() - n * 86400_000);

describe("computeFreshness", () => {
  it("revisado recentemente → fresh", () => {
    expect(computeFreshness({ lastReviewedAt: daysAgo(5), reviewIntervalMonths: 12 })).toBe(
      "fresh",
    );
  });

  it("passou do intervalo de revisão → dueForReview", () => {
    expect(computeFreshness({ lastReviewedAt: daysAgo(400), reviewIntervalMonths: 12 })).toBe(
      "dueForReview",
    );
  });

  it("expiresAt no passado → expired", () => {
    expect(computeFreshness({ expiresAt: daysAgo(1), lastReviewedAt: daysAgo(1) })).toBe("expired");
  });

  it("edital com sourceDate do ano passado → expired", () => {
    const lastYear = new Date(new Date().getFullYear() - 1, 5, 1);
    expect(
      computeFreshness({
        docKind: "seletivo",
        sourceDate: lastYear,
        lastReviewedAt: daysAgo(2),
        reviewIntervalMonths: 3,
      }),
    ).toBe("expired");
  });

  it("notícia (intervalo 0) → sempre fresh", () => {
    expect(computeFreshness({ reviewIntervalMonths: 0, lastReviewedAt: daysAgo(1000) })).toBe(
      "fresh",
    );
  });

  it("sem nenhuma data → dueForReview", () => {
    expect(computeFreshness({ reviewIntervalMonths: 12 })).toBe("dueForReview");
  });
});

describe("hashContent", () => {
  it("ignora diferença de espaço em branco", () => {
    expect(hashContent("a  b\nc")).toBe(hashContent("a b c"));
  });
  it("detecta mudança real", () => {
    expect(hashContent("texto A")).not.toBe(hashContent("texto B"));
  });
});
