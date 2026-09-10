#!/usr/bin/env node
/**
 * Bateria de capacidade dos modelos gratuitos.
 *
 * Mede quantas requisições cada modelo da cadeia entrega antes de bater o
 * limite (RPM = por minuto, RPD = por dia). Script ISOLADO da aplicação —
 * roda direto com Node, lê as chaves do .env.local.
 *
 * Uso:
 *   node --env-file=.env.local scripts/model-capacity-test.mjs [opções]
 *
 * Opções:
 *   --mode=sweep|rpm|rpd|turn   (padrão: sweep)
 *   --model=groq:openai/gpt-oss-120b   testa só esse (senão, a AI_CHAIN inteira)
 *   --max-requests=N            teto de segurança (padrão 300 no rpd/turn)
 *   --concurrency=N             paralelismo no modo rpm (padrão 5)
 *   --duration=SECONDS          janela do modo rpm (padrão 60)
 *
 * ⚠️  Consome a MESMA cota da produção, a menos que você defina chaves
 *     separadas: CAPACITY_GROQ_API_KEY, CAPACITY_GEMINI_API_KEY, etc.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- opções ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "true"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);

const MODE = args.mode || "sweep";
const ONLY_MODEL = args.model || null;
const MAX_REQUESTS = Number(args["max-requests"]) || (MODE === "rpm" ? 2000 : 300);
const CONCURRENCY = Number(args.concurrency) || 5;
const RPM_DURATION_S = Number(args.duration) || 60;

const PROMPT = "Responda apenas com a palavra: ok";

// ---------- cadeia ----------
const DEFAULT_CHAIN = ["google:gemini-3.6-flash"];
const CHAIN = (process.env.AI_CHAIN?.trim() || DEFAULT_CHAIN.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => !ONLY_MODEL || s === ONLY_MODEL);

// ---------- chaves ----------
function key(name) {
  return process.env[`CAPACITY_${name}`]?.trim() || process.env[name]?.trim() || null;
}

const OPENAI_COMPAT = {
  groq: { base: "https://api.groq.com/openai/v1", keyName: "GROQ_API_KEY" },
  openrouter: { base: "https://openrouter.ai/api/v1", keyName: "OPENROUTER_API_KEY" },
  mistral: { base: "https://api.mistral.ai/v1", keyName: "MISTRAL_API_KEY" },
  cerebras: { base: "https://api.cerebras.ai/v1", keyName: "CEREBRAS_API_KEY" },
  openai: { base: "https://api.openai.com/v1", keyName: "OPENAI_API_KEY" },
};

// ---------- classificação de erro ----------
function classify(status, message = "") {
  const m = message.toLowerCase();
  if (
    status === 429 ||
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("rate limit")
  )
    return "quota";
  if (status === 503 || m.includes("overloaded") || m.includes("unavailable")) return "overloaded";
  if (status === 404 || m.includes("not found") || m.includes("no longer available"))
    return "not_found";
  if (status === 401 || status === 403 || m.includes("api key")) return "auth";
  if (status >= 500) return "server";
  return "unknown";
}

// ---------- uma requisição ----------
async function probe(spec) {
  const idx = spec.indexOf(":");
  const provider = idx > -1 ? spec.slice(0, idx) : "google";
  const model = idx > -1 ? spec.slice(idx + 1) : spec;
  const started = Date.now();

  try {
    let res;
    if (provider === "google") {
      const k = key("GEMINI_API_KEY");
      if (!k)
        return {
          ok: false,
          kind: "auth",
          status: 0,
          latencyMs: 0,
          error: "GEMINI_API_KEY ausente",
        };
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": k },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: PROMPT }] }] }),
        },
      );
    } else {
      const cfg = OPENAI_COMPAT[provider];
      if (!cfg)
        return {
          ok: false,
          kind: "not_found",
          status: 0,
          latencyMs: 0,
          error: `provider ${provider} desconhecido`,
        };
      const k = key(cfg.keyName);
      if (!k)
        return {
          ok: false,
          kind: "auth",
          status: 0,
          latencyMs: 0,
          error: `${cfg.keyName} ausente`,
        };
      res = await fetch(`${cfg.base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
        body: JSON.stringify({
          model,
          max_tokens: 16,
          messages: [{ role: "user", content: PROMPT }],
        }),
      });
    }

    const latencyMs = Date.now() - started;
    if (res.ok) {
      await res.text();
      return { ok: true, kind: "ok", status: res.status, latencyMs };
    }
    const body = await res.text();
    let msg = body;
    try {
      msg = JSON.parse(body)?.error?.message || body;
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      kind: classify(res.status, msg),
      status: res.status,
      latencyMs,
      error: String(msg).slice(0, 200),
    };
  } catch (error) {
    return {
      ok: false,
      kind: "network",
      status: 0,
      latencyMs: Date.now() - started,
      error: error.message,
    };
  }
}

// ---------- modos ----------
const stats = {};
function record(spec, r) {
  const s = (stats[spec] ??= { ok: 0, byKind: {}, latencies: [], firstQuotaAt: null });
  if (r.ok) {
    s.ok++;
    s.latencies.push(r.latencyMs);
  } else {
    s.byKind[r.kind] = (s.byKind[r.kind] || 0) + 1;
    if (r.kind === "quota" && !s.firstQuotaAt) s.firstQuotaAt = new Date().toISOString();
  }
}

let stopped = false;
process.on("SIGINT", () => {
  console.log("\n\n⏹  Interrompido — gerando relatório parcial...\n");
  stopped = true;
});

async function runSweep() {
  console.log(`Sweep: 1 requisição por modelo da cadeia (${CHAIN.length} modelos)\n`);
  for (const spec of CHAIN) {
    const r = await probe(spec);
    record(spec, r);
    console.log(
      `  ${spec.padEnd(45)} ${r.ok ? "✅" : "❌"} ${String(r.status).padStart(3)} ${r.latencyMs}ms ${r.error || ""}`,
    );
  }
}

async function runRpm(spec) {
  console.log(`RPM: rajada de ${RPM_DURATION_S}s em ${spec} (concorrência ${CONCURRENCY})\n`);
  const deadline = Date.now() + RPM_DURATION_S * 1000;
  let sent = 0;

  while (Date.now() < deadline && sent < MAX_REQUESTS && !stopped) {
    const batch = [];
    for (let i = 0; i < CONCURRENCY && sent < MAX_REQUESTS; i++, sent++) {
      batch.push(probe(spec).then((r) => record(spec, r)));
    }
    await Promise.all(batch);
    process.stdout.write(
      `\r  enviadas: ${sent}  ok: ${stats[spec]?.ok || 0}  quota: ${stats[spec]?.byKind?.quota || 0}`,
    );
    if (stats[spec]?.byKind?.quota >= 3) {
      console.log("\n  → 429 recorrente, parando.");
      break;
    }
  }
  console.log();
}

async function runRpd(spec) {
  console.log(`RPD: sustentado em ${spec} até 429 de cota (máx ${MAX_REQUESTS})\n`);
  let sent = 0;
  while (sent < MAX_REQUESTS && !stopped) {
    const r = await probe(spec);
    record(spec, r);
    sent++;
    process.stdout.write(
      `\r  enviadas: ${sent}  ok: ${stats[spec].ok}  última: ${r.status} ${r.latencyMs}ms`,
    );
    if (r.kind === "quota") {
      console.log(`\n  → cota estourada após ${stats[spec].ok} requisições OK.`);
      break;
    }
    await new Promise((res) => setTimeout(res, 1200)); // ~50 req/min
  }
  console.log();
}

// ---------- relatório ----------
function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function report() {
  console.log("\n" + "=".repeat(70));
  console.log("RELATÓRIO");
  console.log("=".repeat(70));

  const rows = [["modelo", "ok", "quota(429)", "outros_erros", "lat_p50", "lat_p95", "1º_429"]];
  for (const [spec, s] of Object.entries(stats)) {
    const otherErrors = Object.entries(s.byKind)
      .filter(([k]) => k !== "quota")
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    const row = [
      spec,
      String(s.ok),
      String(s.byKind.quota || 0),
      otherErrors || "-",
      `${pct(s.latencies, 50)}ms`,
      `${pct(s.latencies, 95)}ms`,
      s.firstQuotaAt || "-",
    ];
    rows.push(row);
    console.log(
      `\n  ${spec}\n    entregou: ${s.ok} req OK  |  429: ${s.byKind.quota || 0}  |  ${otherErrors || "sem outros erros"}` +
        `\n    latência p50/p95: ${pct(s.latencies, 50)}ms / ${pct(s.latencies, 95)}ms`,
    );
  }

  const outDir = join(__dirname, "output");
  await mkdir(outDir, { recursive: true });
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const file = join(outDir, `capacity-${MODE}-${Date.now()}.csv`);
  await writeFile(file, csv, "utf-8");
  console.log(`\n  CSV: ${file}\n`);
}

// ---------- main ----------
(async () => {
  if (!CHAIN.length) {
    console.error("Nenhum modelo na cadeia. Defina AI_CHAIN no .env.local ou passe --model=");
    process.exit(1);
  }

  const usingSeparateKeys = [
    "CAPACITY_GROQ_API_KEY",
    "CAPACITY_GEMINI_API_KEY",
    "CAPACITY_OPENROUTER_API_KEY",
  ].some((k) => process.env[k]);
  if (!usingSeparateKeys) {
    console.log(
      "⚠️  Usando as MESMAS chaves da produção — este teste consome a cota do dia.\n" +
        "    Para isolar, defina CAPACITY_<PROVIDER>_API_KEY no ambiente.\n",
    );
  }

  console.log(`Modo: ${MODE}  |  modelos: ${CHAIN.join(", ")}\n`);

  if (MODE === "sweep") {
    await runSweep();
  } else {
    for (const spec of CHAIN) {
      if (stopped) break;
      if (MODE === "rpm") await runRpm(spec);
      else if (MODE === "rpd" || MODE === "turn") await runRpd(spec);
      else {
        console.error(`Modo desconhecido: ${MODE}`);
        process.exit(1);
      }
    }
  }

  await report();
})();
