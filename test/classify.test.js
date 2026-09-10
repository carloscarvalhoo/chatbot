import { describe, it, expect } from "vitest";
import { classifyByUrl, extractContentDate } from "@/server/knowledge/classify";

describe("classifyByUrl", () => {
  it("processo seletivo → revisão curta", () => {
    expect(classifyByUrl("https://ifpr.edu.br/processo-seletivo/editais/").kind).toBe("seletivo");
    expect(
      classifyByUrl("https://ifpr.edu.br/processo-seletivo/").reviewIntervalMonths,
    ).toBeLessThanOrEqual(3);
  });

  it("notícia não vence (0 meses)", () => {
    expect(classifyByUrl("https://ifpr.edu.br/ivaipora/2026/noticia-x/").reviewIntervalMonths).toBe(
      0,
    );
  });

  it("página institucional genérica → intervalo longo", () => {
    expect(
      classifyByUrl("https://ifpr.edu.br/institucional/o-instituto/").reviewIntervalMonths,
    ).toBeGreaterThanOrEqual(12);
  });

  it("contato → 6 meses", () => {
    expect(classifyByUrl("https://ifpr.edu.br/ivaipora/fale-conosco/").kind).toBe("contato");
  });
});

describe("extractContentDate", () => {
  it('"Atualizado em 1 de julho de 2026"', () => {
    const d = extractContentDate("Bla bla. Atualizado em 1 de julho de 2026. Mais texto.");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(6);
  });

  it('"1 julho, 2026"', () => {
    expect(extractContentDate("Publicado 1 julho, 2026")?.getFullYear()).toBe(2026);
  });

  it("dd/mm/aaaa", () => {
    expect(extractContentDate("prazo até 15/03/2027")?.getFullYear()).toBe(2027);
  });

  it('"Portaria 45/2026"', () => {
    expect(extractContentDate("conforme a Portaria 45/2026 do reitor")?.getFullYear()).toBe(2026);
  });

  it("pega a data mais recente", () => {
    const d = extractContentDate("Edital de 2024 revisado. Processo Seletivo 2027.");
    expect(d?.getFullYear()).toBe(2027);
  });

  it("sem data → null", () => {
    expect(extractContentDate("texto sem nenhuma data aqui")).toBeNull();
  });
});
