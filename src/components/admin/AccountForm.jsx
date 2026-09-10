"use client";

import { useEffect, useState } from "react";
import { fetchAccount, updateAccount } from "@/features/admin/settings/services/accountClient";

export default function AccountForm() {
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchAccount()
      .then((data) => {
        setEmail(data.email || "");
        setCurrentEmail(data.email || "");
      })
      .catch((err) => setError(err?.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const payload = { currentPassword };
    if (email && email !== currentEmail) payload.email = email;
    if (newPassword) payload.newPassword = newPassword;

    if (!payload.email && !payload.newPassword) {
      setError("Nada para alterar. Mude o e-mail ou defina uma nova senha.");
      return;
    }

    setSaving(true);
    try {
      const result = await updateAccount(payload);
      setCurrentPassword("");
      setNewPassword("");
      if (result.requiresRelogin) {
        setSuccess("Senha alterada. Você vai precisar entrar de novo...");
        setTimeout(() => {
          window.location.href = "/admin/login";
        }, 1500);
        return;
      }
      setCurrentEmail(result.email || email);
      setSuccess("Dados de acesso atualizados!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err?.message || "Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="glass-subtle h-40 animate-pulse rounded-2xl" />;
  }

  return (
    <form onSubmit={handleSubmit} className="glass max-w-2xl space-y-5 rounded-2xl p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">Conta de acesso</h2>
        <p className="mt-1 text-sm text-zinc-500">
          E-mail e senha usados para entrar no painel. Trocar a senha desconecta esta sessão.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-zinc-300">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className="input-field"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-zinc-300">
          Nova senha
          <span className="ml-2 font-normal text-zinc-600">Deixe em branco para não trocar.</span>
        </span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          placeholder="Mínimo 8 caracteres"
          className="input-field"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="block text-sm font-medium text-zinc-300">
          Senha atual
          <span className="ml-2 font-normal text-zinc-600">Obrigatória para confirmar.</span>
        </span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="input-field"
        />
      </label>

      {error && <p className="glass rounded-xl px-4 py-3 text-sm text-red-300">{error}</p>}
      {success && <p className="glass rounded-xl px-4 py-3 text-sm text-emerald-300">{success}</p>}

      <button
        type="submit"
        disabled={saving || !currentPassword}
        className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Atualizar acesso"}
      </button>
    </form>
  );
}
