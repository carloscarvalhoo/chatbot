#!/usr/bin/env node
/**
 * Bateria de avaliacao de acuracia do LUMI.
 *
 * Roda cada pergunta de eval/faq-dataset.json pelo pipeline RAG real (via a rota
 * HTTP /api/chat do servidor em execucao) e mede tres coisas por pergunta:
 *
 *   1. Recuperacao  - a fonte esperada apareceu entre as fontes citadas?
 *   2. Acerto (palavras-chave) - checagem deterministica das palavras obrigatorias
 *   3. Acerto (juiz LLM) - um modelo avaliador classifica: correto | parcial | errado
 *
 * Saida: resumo no terminal + CSV e JSON em scripts/output/.
 *
 *   node --env-file=.env.local scripts/eval-accuracy.mjs [opcoes]
 *
 * Opcoes:
 *   --base=http://localhost:3000   URL do servidor (padrao: env EVAL_BASE_URL ou localhost:3000)
 *   --limit=10                     roda apenas as N primeiras perguntas
 *   --tema=processo-seletivo       filtra por tema
 *   --concorrencia=2               perguntas em paralelo (padrao 2)
 *   --sem-juiz                     pula a avaliacao por LLM (so palavras-chave)
 *   --juiz-modelo=openai/gpt-oss-120b   modelo avaliador no Groq
 *
 * Pre-requisitos:
 *   - servidor rodando (npm run dev) com EVAL_SECRET definido no .env.local
 *   - GROQ_API_KEY no .env.local (para o juiz); sem ela, use --sem-juiz
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

const BASE_URL = (args.base || process.env.EVAL_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const TEMA = args.tema || null;
const CONCURRENCY = Math.max(1, Number(args.concorrencia) || 2);
const USE_JUDGE = args["sem-juiz"] !== "true";
const JUDGE_MODEL = args["juiz-modelo"] || "openai/gpt-oss-120b";
const EVAL_SECRET = process.env.EVAL_SECRET || "";
const GROQ_KEY = process.env.GROQ_API_KEY?.trim() || "";

// ---------- utilidades ----------

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normUrl(u) {
  return String(u || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "");
}

function pct(n, d) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ---------- chamada ao chatbot ----------

async function askLumi(pergunta) {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(EVAL_SECRET ? { "x-eval-secret": EVAL_SECRET } : {}),
    },
    body: JSON.stringify({ message: pergunta, bufferHistory: [], stream: false }),
  });
  const latencyMs = Date.now() - started;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      latencyMs,
      text: "",
      sources: [],
      error: data?.error || `HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    latencyMs,
    text: String(data.text || ""),
    sources: Array.isArray(data.sources) ? data.sources : [],
    modelUsed: data.modelUsed || null,
    providerUsed: data.providerUsed || null,
    usedFallback: Boolean(data.usedFallback),
    sourcesStale: Boolean(data.sourcesStale),
  };
}

// ---------- avaliacoes ----------

function checkKeywords(text, item) {
  const hay = norm(text);
  const must = item.deveConter || [];
  const any = item.deveConterQualquer || [];
  const missing = must.filter((k) => !hay.includes(norm(k)));
  const anyOk = any.length === 0 || any.some((k) => hay.includes(norm(k)));
  const passed = missing.length === 0 && anyOk;
  return { passed, missing, anyOk };
}

function checkRetrieval(sources, item) {
  if (!item.fonteEsperada) return { hit: null };
  const target = normUrl(item.fonteEsperada);
  const hit = sources.some((s) => normUrl(s.url || s.href || "").includes(target));
  return { hit };
}

async function judge(item, answerText) {
  if (!USE_JUDGE) return { verdict: "n/a", score: null, reason: "juiz desativado" };
  if (!GROQ_KEY) return { verdict: "n/a", score: null, reason: "sem GROQ_API_KEY" };

  const prompt = [
    "Voce e um avaliador rigoroso de um chatbot institucional do IFPR.",
    "Compare a RESPOSTA DO CHATBOT com a RESPOSTA DE REFERENCIA (que e a verdade oficial).",
    "Classifique em: correto, parcial ou errado.",
    "- correto: transmite a mesma informacao essencial da referencia, sem contradicao.",
    "- parcial: acerta parte, mas omite algo importante ou e vago demais.",
    "- errado: contradiz a referencia, inventa dados, ou nao responde a pergunta.",
    "Ignore diferencas de estilo, formatacao e frases de encaminhamento a canais oficiais.",
    'Responda SOMENTE com JSON: {"veredito":"correto|parcial|errado","justificativa":"..."}',
    "",
    `PERGUNTA: ${item.pergunta}`,
    `RESPOSTA DE REFERENCIA: ${item.respostaReferencia}`,
    `RESPOSTA DO CHATBOT: ${answerText || "(vazia)"}`,
  ].join("\n");

  try {
    let res;
    let data;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: JUDGE_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      data = await res.json();
      if (res.status !== 429) break;
      const waitMs = Number(res.headers.get("retry-after")) * 1000 || 3000 + attempt * 2000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 12000)));
    }
    if (!res.ok) {
      return { verdict: "erro", score: null, reason: data?.error?.message || `HTTP ${res.status}` };
    }
    const raw = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const verdict = String(parsed.veredito || "").toLowerCase();
    const score = verdict === "correto" ? 1 : verdict === "parcial" ? 0.5 : 0;
    return { verdict: verdict || "errado", score, reason: parsed.justificativa || "" };
  } catch (error) {
    return { verdict: "erro", score: null, reason: error.message };
  }
}

// ---------- execucao ----------

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const datasetPath = join(ROOT, "eval", "faq-dataset.json");
  const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
  let perguntas = dataset.perguntas || [];
  if (TEMA) perguntas = perguntas.filter((p) => p.tema === TEMA);
  perguntas = perguntas.slice(0, LIMIT);

  if (!perguntas.length) {
    console.error("Nenhuma pergunta para rodar (verifique --tema / --limit).");
    process.exit(1);
  }

  console.log(`\nLUMI - Bateria de acuracia`);
  console.log(`  servidor:     ${BASE_URL}`);
  console.log(`  perguntas:    ${perguntas.length}${TEMA ? ` (tema: ${TEMA})` : ""}`);
  console.log(
    `  juiz LLM:     ${USE_JUDGE ? (GROQ_KEY ? JUDGE_MODEL : "SEM GROQ_API_KEY") : "desativado"}`,
  );
  console.log(`  bypass limite: ${EVAL_SECRET ? "sim" : "NAO (defina EVAL_SECRET)"}`);
  console.log("");

  // sanity check: servidor no ar
  try {
    const ping = await fetch(`${BASE_URL}/api/chat/models`);
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  } catch (error) {
    console.error(
      `Nao consegui falar com ${BASE_URL} (${error.message}). O servidor esta rodando?`,
    );
    process.exit(1);
  }

  const rows = await mapWithConcurrency(perguntas, CONCURRENCY, async (item, i) => {
    const ans = await askLumi(item.pergunta);
    const kw = checkKeywords(ans.text, item);
    const rt = checkRetrieval(ans.sources, item);
    const jd = ans.ok
      ? await judge(item, ans.text)
      : { verdict: "sem-resposta", score: 0, reason: ans.error };

    const line = {
      id: item.id,
      tema: item.tema,
      pergunta: item.pergunta,
      ok: ans.ok,
      erro: ans.ok ? "" : ans.error,
      latenciaMs: ans.latencyMs,
      modelo: ans.modelUsed || "",
      provider: ans.providerUsed || "",
      fallback: ans.usedFallback ? "sim" : "",
      recuperou: rt.hit === null ? "-" : rt.hit ? "sim" : "nao",
      palavrasChave: kw.passed ? "sim" : "nao",
      palavrasFaltando: kw.missing.join(" | "),
      juizVeredito: jd.verdict,
      juizNota: jd.score,
      juizJustificativa: jd.reason,
      resposta: ans.text.replace(/\s+/g, " ").trim(),
    };

    const mark = jd.verdict === "correto" ? "OK " : jd.verdict === "parcial" ? "~  " : "X  ";
    console.log(
      `${String(i + 1).padStart(2)}. ${mark} [${item.tema}] ${item.id}  ` +
        `kw:${line.palavrasChave} rec:${line.recuperou} ${ans.latencyMs}ms ${line.modelo}`,
    );
    if (jd.verdict !== "correto" && jd.reason) console.log(`      -> ${jd.reason}`);
    return line;
  });

  // ---------- agregados ----------
  const answered = rows.filter((r) => r.ok);
  const judged = rows.filter((r) => typeof r.juizNota === "number");
  const withRetrieval = rows.filter((r) => r.recuperou !== "-");
  const latencies = answered.map((r) => r.latenciaMs);

  const judgeScore = judged.reduce((a, r) => a + r.juizNota, 0);
  const summary = {
    executadoEm: new Date().toISOString(),
    base: BASE_URL,
    totalPerguntas: rows.length,
    responderam: answered.length,
    falharam: rows.length - answered.length,
    acuraciaJuizPct: pct(judgeScore, judged.length),
    juizCorreto: judged.filter((r) => r.juizVeredito === "correto").length,
    juizParcial: judged.filter((r) => r.juizVeredito === "parcial").length,
    juizErrado: judged.filter((r) => r.juizVeredito === "errado").length,
    acuraciaPalavrasChavePct: pct(
      rows.filter((r) => r.palavrasChave === "sim").length,
      rows.length,
    ),
    taxaRecuperacaoPct: pct(
      withRetrieval.filter((r) => r.recuperou === "sim").length,
      withRetrieval.length,
    ),
    latenciaMediaMs: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0,
    latenciaP95Ms: percentile(latencies, 95),
    porTema: {},
  };

  for (const tema of [...new Set(rows.map((r) => r.tema))]) {
    const t = rows.filter((r) => r.tema === tema);
    const tj = t.filter((r) => typeof r.juizNota === "number");
    summary.porTema[tema] = {
      perguntas: t.length,
      acuraciaJuizPct: pct(
        tj.reduce((a, r) => a + r.juizNota, 0),
        tj.length,
      ),
      palavrasChavePct: pct(t.filter((r) => r.palavrasChave === "sim").length, t.length),
    };
  }

  // ---------- saida ----------
  const outDir = join(ROOT, "scripts", "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(";")),
  ].join("\n");
  const csvPath = join(outDir, `eval-${stamp}.csv`);
  const jsonPath = join(outDir, `eval-${stamp}.json`);
  await writeFile(csvPath, `﻿${csv}`, "utf8");
  await writeFile(jsonPath, JSON.stringify({ summary, rows }, null, 2), "utf8");

  console.log("\n" + "=".repeat(56));
  console.log("RESUMO");
  console.log("=".repeat(56));
  console.log(`  Perguntas respondidas:     ${summary.responderam}/${summary.totalPerguntas}`);
  if (USE_JUDGE && GROQ_KEY) {
    console.log(
      `  Acuracia (juiz LLM):       ${summary.acuraciaJuizPct}%  ` +
        `(${summary.juizCorreto} correto / ${summary.juizParcial} parcial / ${summary.juizErrado} errado)`,
    );
  }
  console.log(`  Acuracia (palavras-chave): ${summary.acuraciaPalavrasChavePct}%`);
  console.log(`  Taxa de recuperacao:       ${summary.taxaRecuperacaoPct}%`);
  console.log(
    `  Latencia media / p95:      ${summary.latenciaMediaMs}ms / ${summary.latenciaP95Ms}ms`,
  );
  console.log("\n  Por tema:");
  for (const [tema, s] of Object.entries(summary.porTema)) {
    console.log(
      `    ${tema.padEnd(22)} juiz ${String(s.acuraciaJuizPct).padStart(5)}%   kw ${String(s.palavrasChavePct).padStart(5)}%   (${s.perguntas})`,
    );
  }
  console.log(`\n  CSV:  ${csvPath}`);
  console.log(`  JSON: ${jsonPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
