"use client";

import { useEffect, useState } from "react";

function format(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * "Fila de espera" mostrada quando os limites gratuitos de IA estouraram.
 * Conta o tempo até a liberação e oferece o canal humano como alternativa.
 */
export default function QueueNotice({
  until,
  initialMs = 0,
  reason,
  supportUrl,
  supportLabel,
  onRetry,
}) {
  const [remaining, setRemaining] = useState(initialMs);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, until - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  const ready = remaining <= 0;
  const isDaily = reason === "quota" && (initialMs > 10 * 60 * 1000 || remaining > 10 * 60 * 1000);

  return (
    <div className="glass max-w-full rounded-2xl p-4 sm:max-w-[520px] sm:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <span aria-hidden="true">🎫</span>
        {ready ? "Sua vez chegou!" : "Você está na fila"}
      </div>

      <p className="mt-1.5 text-sm leading-6 text-zinc-400">
        {ready
          ? "Os limites já foram liberados. É só tentar de novo."
          : isDaily
            ? "O LUMI atingiu o limite de perguntas gratuitas de hoje. A fila anda quando o limite renova:"
            : "Muita gente perguntando ao mesmo tempo agora. Sua vez em:"}
      </p>

      {!ready && (
        <div className="mt-3 font-mono text-2xl font-semibold tabular-nums text-zinc-100">
          {format(remaining)}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {ready ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200"
          >
            Tentar novamente
          </button>
        ) : (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Tentar agora mesmo assim
          </button>
        )}

        {supportUrl && (
          <a
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            {supportLabel || "Falar com o setor responsável"}
          </a>
        )}
      </div>

      {!ready && (
        <p className="mt-3 text-xs text-zinc-600">
          Não quer esperar? Fale direto com a equipe pelo botão acima.
        </p>
      )}
    </div>
  );
}
