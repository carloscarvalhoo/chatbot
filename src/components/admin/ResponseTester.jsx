"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import SearchIcon from "@mui/icons-material/Search";

function ChunksUsed({ chunks }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-zinc-400">
        Trechos da base utilizados ({chunks.length})
      </h3>

      {chunks.length === 0 && (
        <p className="text-sm text-zinc-600">Nenhum trecho encontrado para essa pergunta.</p>
      )}

      <div className="space-y-3">
        {chunks.map((chunk, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/2 p-4 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-300">{chunk.sourceFileName}</span>
              <span>·</span>
              <span>chunk #{chunk.index}</span>
              <span>·</span>
              <span
                className={chunk.searchType === "embedding" ? "text-blue-400" : "text-amber-400"}
              >
                {chunk.searchType}
              </span>
              <span>·</span>
              <span>score: {chunk.score}</span>
            </div>
            <p className="leading-6 text-zinc-400">{chunk.preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResponseTester() {
  const [mode, setMode] = useState("single"); // "single" | "compare"
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [chain, setChain] = useState([]);

  useEffect(() => {
    fetch("/api/admin/compare", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.chain && setChain(d.chain))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    setComparison(null);

    const endpoint = mode === "compare" ? "/api/admin/compare" : "/api/admin/search";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: q }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro ao testar.");

      if (mode === "compare") setComparison(data);
      else setResult(data);
    } catch (err) {
      setError(err?.message || "Erro ao testar resposta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-200">Testar Resposta</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Veja como o assistente responderia e quais documentos seriam usados.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "single", label: "Resposta atual" },
          { id: "compare", label: "Comparar modelos" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              mode === tab.id ? "bg-white text-zinc-900" : "glass text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "compare" && chain.length > 0 && (
        <p className="text-xs text-zinc-600">
          Compara a cadeia configurada: {chain.map((c) => `${c.provider}:${c.model}`).join("  ·  ")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Quais documentos preciso levar?"
          maxLength={1000}
          className="glass-subtle flex-1 rounded-xl px-5 py-3 text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-white/20"
        />
        <button
          type="submit"
          disabled={!question.trim() || loading}
          className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SearchIcon fontSize="small" />
          {loading ? "Processando..." : mode === "compare" ? "Comparar" : "Testar"}
        </button>
      </form>

      {error && (
        <div className="glass rounded-xl border-red-500/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && mode === "single" && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Resposta</h3>
              <span className="glass-subtle rounded-full px-2 py-0.5 text-xs text-zinc-400">
                {result.modelUsed}
              </span>
            </div>
            <div className="text-sm leading-7 text-zinc-200">
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{result.answer}</ReactMarkdown>
            </div>
          </div>
          <ChunksUsed chunks={result.chunks} />
        </div>
      )}

      {comparison && mode === "compare" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {comparison.results.map((item) => (
              <div key={item.spec} className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-300">{item.spec}</span>
                  <span className="shrink-0 glass-subtle rounded-full px-2 py-0.5 text-xs text-zinc-400">
                    {item.ok ? `${item.latencyMs} ms` : item.errorKind}
                  </span>
                </div>
                {item.ok ? (
                  <div className="text-sm leading-7 text-zinc-200">
                    <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{item.text}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-red-300">{item.error}</p>
                )}
              </div>
            ))}
          </div>
          <ChunksUsed chunks={comparison.knowledgeChunks} />
        </div>
      )}
    </div>
  );
}
