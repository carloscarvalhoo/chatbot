"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Acessando as páginas selecionadas", duration: 3000 },
  { label: "Extraindo o conteúdo textual", duration: 4000 },
  { label: "Dividindo em trechos semânticos", duration: 3500 },
  { label: "Gerando embeddings com IA", duration: 0 },
];

export default function EmbeddingLoader({ active, count = 0, type = "url" }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    let i = 0;
    const timers = [];

    function advance() {
      if (i < STEPS.length - 1) {
        const delay = STEPS[i].duration;
        const t = setTimeout(() => {
          i++;
          setStepIndex(i);
          advance();
        }, delay);
        timers.push(t);
      }
    }

    advance();
    return () => timers.forEach(clearTimeout);
  }, [active]);

  // Animação dos pontinhos
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? "" : d + ".")), 500);
    return () => clearInterval(t);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-strong mx-4 w-full max-w-md rounded-3xl p-8">
        {/* Spinner */}
        <div className="flex justify-center mb-8">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 rounded-full border-t-2 border-zinc-400 animate-spin" />
            <div
              className="absolute inset-2 rounded-full border-t-2 border-zinc-600 animate-spin"
              style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
            />
          </div>
        </div>

        <h3 className="text-center text-lg font-semibold text-zinc-100 mb-1">
          {type === "url"
            ? `Indexando ${count} página${count !== 1 ? "s" : ""}${dots}`
            : `Processando documento${dots}`}
        </h3>
        <p className="text-center text-sm text-zinc-500 mb-8">
          Isso pode levar alguns minutos. Não feche esta janela.
        </p>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, idx) => {
            const done = idx < stepIndex;
            const current = idx === stepIndex;

            return (
              <div key={step.label} className="flex items-center gap-4">
                {/* Ícone */}
                <div className="relative shrink-0">
                  {done ? (
                    <div className="h-7 w-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  ) : current ? (
                    <div className="h-7 w-7 rounded-full bg-white/5 border border-white/20 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-zinc-300 animate-pulse" />
                    </div>
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-white/3 border border-white/8 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-sm transition-colors duration-300 ${
                    done
                      ? "text-emerald-400"
                      : current
                        ? "text-zinc-200 font-medium"
                        : "text-zinc-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Barra de progresso indeterminada */}
        <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-zinc-600 via-zinc-300 to-zinc-600 animate-[shimmer_2s_linear_infinite]"
            style={{ backgroundSize: "200% 100%" }}
          />
        </div>
      </div>
    </div>
  );
}
