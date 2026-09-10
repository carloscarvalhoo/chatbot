"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminLogin } from "@/features/admin/auth/hooks/useAdminLogin";

export default function AdminLoginForm() {
  const { email, setEmail, password, setPassword, loading, error, submitLogin } = useAdminLogin();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden text-zinc-100">
      <section className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center relative z-20">
            <h1 className="bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-4xl font-semibold text-transparent">
              Bem vindo!
            </h1>

            <p className="mt-3 text-base leading-6 text-zinc-400">
              Essa é uma área de acesso restrito. Por favor, informe suas credenciais para
              prosseguir.
            </p>
          </div>

          <form onSubmit={submitLogin} className="glass relative z-20 rounded-2xl p-6">
            <div className="mb-5">
              <label htmlFor="email" className="mb-2 block text-base font-medium text-zinc-300">
                E-mail
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="exemplo@gmail.com"
                className="glass-subtle w-full rounded-xl px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-2 block text-base font-medium text-zinc-300">
                Senha
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  className="glass-subtle w-full rounded-xl px-4 py-3 pr-12 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-zinc-500 transition hover:text-zinc-200"
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 10 7a15 15 0 01-3.3 4.2M6.5 6.6C4.3 8 2.8 10 2 12c1 2.5 5 7 10 7a9.7 9.7 0 004.5-1.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-base text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center rounded-lg bg-zinc-100 px-4 py-3 text-base font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {loading ? "Acessando..." : "Acessar Plataforma"}
            </button>
          </form>

          <div className="mt-6 text-center relative z-20">
            <Link href="/chat" className="text-base text-zinc-500 transition hover:text-zinc-300">
              Voltar para o chat público
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
