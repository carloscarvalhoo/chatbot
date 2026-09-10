"use client";

import Link from "next/link";

/**
 * Tela de erro amigável. Usada pelos error boundaries (error.jsx) do Next.
 */
export default function ErrorState({
  title = "Algo deu errado",
  message = "Tivemos um problema inesperado. Você pode tentar de novo.",
  onRetry,
  homeHref = "/",
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              d="M12 8v5M12 16.5h.01M10.3 4.3l-7 12A2 2 0 0 0 5 19.5h14a2 2 0 0 0 1.7-3l-7-12a2 2 0 0 0-3.4 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1.5 text-sm leading-6 text-zinc-400">{message}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
            >
              Tentar de novo
            </button>
          )}
          <Link
            href={homeHref}
            className="glass glass-hover rounded-xl px-4 py-2 text-sm text-zinc-300 transition"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
