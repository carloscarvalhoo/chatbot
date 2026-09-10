"use client";

import { useEffect, useState } from "react";

async function loadBase() {
  const res = await fetch("/api/admin/prompt", { credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Erro ao carregar o prompt.");
  return data;
}

async function loadForQuestion(question) {
  const res = await fetch("/api/admin/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Erro ao montar o prompt.");
  return data;
}

export default function PromptInspector() {
  const [result, setResult] = useState(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadBase()
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function run(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(question.trim() ? await loadForQuestion(question.trim()) : await loadBase());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!result?.systemPrompt) return;
    navigator.clipboard?.writeText(result.systemPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Prompt do assistente</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Instruções que o LUMI recebe a cada resposta. Digite uma pergunta para ver o prompt real,
          já com os trechos da base que seriam usados.
        </p>
      </div>

      <form onSubmit={run} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Qual a taxa de inscrição dos cursos técnicos?"
          maxLength={500}
          className="input-field flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="glass glass-hover shrink-0 rounded-xl px-4 py-2 text-sm text-zinc-200 transition disabled:opacity-40"
        >
          {loading ? "..." : "Montar"}
        </button>
      </form>

      {error && <p className="glass rounded-xl px-4 py-3 text-sm text-red-300">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {result.question ? (
              <>
                <span className="glass-subtle rounded-full px-2.5 py-1">
                  {result.chunksFound} trecho(s) da base
                </span>
                {result.topScore != null && (
                  <span className="glass-subtle rounded-full px-2.5 py-1">
                    similaridade do topo: {result.topScore.toFixed(3)}
                  </span>
                )}
                {result.lowConfidence && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300/90">
                    baixa confiança (aviso anti-alucinação ativado)
                  </span>
                )}
              </>
            ) : (
              <span className="glass-subtle rounded-full px-2.5 py-1">
                esqueleto (sem pergunta)
              </span>
            )}
            <button
              type="button"
              onClick={copy}
              className="ml-auto glass glass-hover rounded-full px-3 py-1 text-zinc-300 transition"
            >
              {copied ? "copiado!" : "copiar"}
            </button>
          </div>

          <pre className="glass max-h-[60vh] overflow-auto rounded-2xl p-4 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
            {result.systemPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}
