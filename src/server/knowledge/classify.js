/**
 * @file Classifica um documento pela URL e pelo conteúdo (tipo, intervalo de revisão, data mais recente citada) sem ninguém marcar nada no painel.
 *
 * Classifica automaticamente um documento a partir da URL e do conteúdo,
 * sem ninguém precisar marcar nada no painel.
 *  - reviewIntervalMonths: de quanto em quanto tempo esse TIPO de página
 *    deveria ser revisado (editais mudam rápido, "sobre o campus" quase nunca).
 *  - sourceDate: a data mais recente citada no conteúdo (ano de edital,
 *    "Portaria 45/2026", etc.) — usada para detectar material do ano passado.
 * @module server/knowledge/classify
 */

const MONTHS = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

// Regras por trecho de URL (primeira que casar vence).
const URL_RULES = [
  {
    test: /processo-seletivo|vestibular|\/editais?\/|\/edital|inscric|selec/i,
    months: 3,
    kind: "seletivo",
  },
  {
    test: /portaria|resolu[çc][aã]o|instru[çc][aã]o-normativa|regulament/i,
    months: 6,
    kind: "normativo",
  },
  { test: /calendario|cronograma|agenda/i, months: 4, kind: "calendario" },
  { test: /noticia|\/20\d\d\/|blog|informe/i, months: 0, kind: "noticia" }, // notícia não "vence"
  {
    test: /matricula|rematricula|transferencia|estagio|bolsa|assistencia/i,
    months: 6,
    kind: "academico",
  },
  {
    test: /contato|fale-conosco|telefone|horario|endereco|localizacao/i,
    months: 6,
    kind: "contato",
  },
  { test: /curso|graduacao|tecnico|pos-graduacao|mestrado/i, months: 12, kind: "curso" },
];

const DEFAULT_MONTHS = 18; // páginas institucionais genéricas

/**
 * @param {string} url
 * @returns {{ reviewIntervalMonths: number, kind: string }}
 */
export function classifyByUrl(url) {
  const value = String(url || "").toLowerCase();
  for (const rule of URL_RULES) {
    if (rule.test.test(value)) {
      return { reviewIntervalMonths: rule.months, kind: rule.kind };
    }
  }
  return { reviewIntervalMonths: DEFAULT_MONTHS, kind: "institucional" };
}

/**
 * Extrai a data mais recente mencionada no texto.
 * Reconhece: "1 de julho de 2026", "1 julho, 2026", "01/07/2026",
 * "Portaria 45/2026", "Edital nº 12/2026", "Processo Seletivo 2027", anos soltos.
 *
 * @param {string} text
 * @returns {Date | null}
 */
export function extractContentDate(text) {
  const value = String(text || "");
  const candidates = [];
  const now = new Date();
  const maxYear = now.getFullYear() + 2; // ignora anos absurdos

  // dd de mês de aaaa  /  dd mês, aaaa
  const reFull = /(\d{1,2})\s*(?:de\s+)?([a-zçã]+)\s*(?:de\s+|,\s*)?(\d{4})/gi;
  let m;
  while ((m = reFull.exec(value))) {
    const day = Number(m[1]);
    const month = MONTHS[m[2].toLowerCase()];
    const year = Number(m[3]);
    if (month !== undefined && year >= 2015 && year <= maxYear && day >= 1 && day <= 31) {
      candidates.push(new Date(year, month, day));
    }
  }

  // dd/mm/aaaa
  const reNumeric = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = reNumeric.exec(value))) {
    const [, d, mo, y] = m.map(Number);
    if (y >= 2015 && y <= maxYear && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      candidates.push(new Date(y, mo - 1, d));
    }
  }

  // "Portaria 45/2026", "Edital 12/2026", "Processo Seletivo 2027", ano solto
  const reYear =
    /\b(?:portaria|edital|resolu[çc][aã]o|instru[çc][aã]o normativa)[^0-9]{0,20}\d{1,4}\/(\d{4})\b|processo\s+seletivo[^0-9]{0,10}(\d{4})|\b(20[2-3]\d)\b/gi;
  while ((m = reYear.exec(value))) {
    const year = Number(m[1] || m[2] || m[3]);
    if (year >= 2015 && year <= maxYear) {
      candidates.push(new Date(year, 0, 1));
    }
  }

  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b > a ? b : a));
}

/**
 * Política completa de um documento.
 * @param {{ url?: string, text?: string }} params
 */
export function deriveDocPolicy({ url, text }) {
  const { reviewIntervalMonths, kind } = classifyByUrl(url);
  const sourceDate = extractContentDate(text);
  return { reviewIntervalMonths, kind, sourceDate };
}
