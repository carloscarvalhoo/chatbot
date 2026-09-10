"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/features/admin/settings/hooks/useSettings";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

export default function SettingsForm() {
  const { settings, loading, saving, error, success, save } = useSettings();

  const [form, setForm] = useState({
    institutionName: "",
    botName: "",
    welcomeMessage: "",
    footerNote: "",
    supportUrl: "",
    supportLabel: "",
    suggestedQuestions: [],
    aiChain: [],
  });

  const [newQuestion, setNewQuestion] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const catalog = settings?._aiChainCatalog || { envSpecs: [], providers: [] };

  useEffect(() => {
    if (!settings) return;
    const { _aiChainCatalog, ...clean } = settings;
    const seededChain =
      Array.isArray(clean.aiChain) && clean.aiChain.length
        ? clean.aiChain
        : (_aiChainCatalog?.envSpecs || []).map((s) => ({ spec: s.spec, enabled: true }));
    setForm((prev) => ({ ...prev, ...clean, aiChain: seededChain }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function specInfo(spec) {
    return (
      catalog.envSpecs.find((s) => s.spec === spec) || {
        spec,
        provider: spec.includes(":") ? spec.split(":")[0] : "google",
        model: spec.includes(":") ? spec.slice(spec.indexOf(":") + 1) : spec,
        available: catalog.providers.some(
          (p) => p.id === (spec.includes(":") ? spec.split(":")[0] : "google") && p.available,
        ),
      }
    );
  }

  function moveModel(index, dir) {
    reorderModels(index, index + dir);
  }

  function reorderModels(from, to) {
    if (from === to || from == null || to == null) return;
    const next = [...form.aiChain];
    if (to < 0 || to >= next.length || from < 0 || from >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    handleChange("aiChain", next);
  }

  function toggleModel(index) {
    const next = form.aiChain.map((item, i) =>
      i === index ? { ...item, enabled: !(item.enabled !== false) } : item,
    );
    handleChange("aiChain", next);
  }

  function removeModel(index) {
    handleChange(
      "aiChain",
      form.aiChain.filter((_, i) => i !== index),
    );
  }

  function addModel() {
    const spec = newSpec.trim();
    if (!spec || !spec.includes(":")) return;
    if (form.aiChain.some((item) => item.spec === spec)) return;
    handleChange("aiChain", [...form.aiChain, { spec, enabled: true }]);
    setNewSpec("");
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addQuestion() {
    const q = newQuestion.trim();
    if (!q || form.suggestedQuestions.length >= 6) return;
    handleChange("suggestedQuestions", [...form.suggestedQuestions, q]);
    setNewQuestion("");
  }

  function removeQuestion(index) {
    handleChange(
      "suggestedQuestions",
      form.suggestedQuestions.filter((_, i) => i !== index),
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    save(form);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl glass-subtle" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-7">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Como o assistente se apresenta para os usuários.
        </p>
      </div>

      <Field
        label="Nome da instituição"
        hint={`Usado no prompt do ${form.botName || "assistente"}.`}
      >
        <input
          type="text"
          value={form.institutionName}
          onChange={(e) => handleChange("institutionName", e.target.value)}
          maxLength={200}
          placeholder="Ex: IFPR - Campus Ivaiporã"
          className="input-field"
        />
      </Field>

      <Field label="Nome do assistente" hint="Como o bot vai se chamar.">
        <input
          type="text"
          value={form.botName}
          onChange={(e) => handleChange("botName", e.target.value)}
          maxLength={50}
          placeholder="Ex: LUMI"
          className="input-field"
        />
      </Field>

      <Field label="Mensagem de boas-vindas" hint="Exibida na tela inicial do chat.">
        <input
          type="text"
          value={form.welcomeMessage}
          onChange={(e) => handleChange("welcomeMessage", e.target.value)}
          maxLength={300}
          placeholder="Ex: Como posso ajudar você hoje?"
          className="input-field"
        />
      </Field>

      <Field label="Nota de rodapé" hint="Aviso de limitação exibido no chat.">
        <input
          type="text"
          value={form.footerNote}
          onChange={(e) => handleChange("footerNote", e.target.value)}
          maxLength={300}
          placeholder={`Ex: O ${form.botName || "assistente"} pode cometer erros...`}
          className="input-field"
        />
      </Field>

      <Field
        label="Link de suporte"
        hint="Mostrado na 'fila de espera' quando os limites de IA estouram."
      >
        <input
          type="url"
          value={form.supportUrl}
          onChange={(e) => handleChange("supportUrl", e.target.value)}
          maxLength={500}
          placeholder="https://ifpr.edu.br/ivaipora/fale-conosco/"
          className="input-field"
        />
      </Field>

      <Field label="Texto do botão de suporte" hint="Ex: Falar com a secretaria.">
        <input
          type="text"
          value={form.supportLabel}
          onChange={(e) => handleChange("supportLabel", e.target.value)}
          maxLength={60}
          placeholder="Falar com o setor responsável"
          className="input-field"
        />
      </Field>

      <Field
        label="Perguntas sugeridas"
        hint={`Exibidas na tela inicial. Máximo 6. (${form.suggestedQuestions.length}/6)`}
      >
        <div className="space-y-2">
          {form.suggestedQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="glass-subtle flex-1 rounded-xl px-4 py-2 text-sm text-zinc-300">
                {q}
              </span>
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                aria-label={`Remover pergunta: ${q}`}
                className="text-zinc-600 hover:text-red-400 transition"
              >
                <DeleteOutlineIcon fontSize="small" />
              </button>
            </div>
          ))}

          {form.suggestedQuestions.length < 6 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuestion())}
                placeholder="Nova pergunta sugerida..."
                maxLength={70}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={addQuestion}
                disabled={!newQuestion.trim()}
                className="glass glass-hover flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-zinc-300 transition disabled:opacity-40"
              >
                <AddIcon fontSize="small" />
              </button>
            </div>
          )}
        </div>
      </Field>

      <Field
        label="Modelos de IA"
        hint="Arraste para reordenar. O primeiro ativo é tentado primeiro; se falhar, cai para o próximo."
      >
        <div className="space-y-2">
          {form.aiChain.length === 0 && (
            <p className="glass-subtle rounded-xl px-4 py-3 text-sm text-zinc-500">
              Usando a ordem padrão do servidor (variável AI_CHAIN).
            </p>
          )}

          {form.aiChain.map((item, i) => {
            const info = specInfo(item.spec);
            const enabled = item.enabled !== false;
            return (
              <div
                key={item.spec}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnter={() => setDragOverIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  reorderModels(dragIndex, i);
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex items-center gap-2 rounded-xl px-2 py-2 transition ${
                  enabled ? "glass-subtle" : "glass-subtle opacity-45"
                } ${dragIndex === i ? "opacity-30" : ""} ${
                  dragOverIndex === i && dragIndex !== i ? "ring-1 ring-violet-400/60" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="cursor-grab select-none px-1 text-zinc-600 active:cursor-grabbing"
                  title="Arraste para reordenar"
                >
                  ⠿
                </span>

                <span className="flex flex-col leading-none">
                  <button
                    type="button"
                    onClick={() => moveModel(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir"
                    className="text-xs text-zinc-600 transition hover:text-zinc-200 disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveModel(i, 1)}
                    disabled={i === form.aiChain.length - 1}
                    aria-label="Descer"
                    className="text-xs text-zinc-600 transition hover:text-zinc-200 disabled:opacity-20"
                  >
                    ▼
                  </button>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">{info.model}</span>
                  <span className="text-xs text-zinc-600">
                    {info.provider}
                    {!info.available && (
                      <span className="ml-2 text-amber-400/80">sem chave de API</span>
                    )}
                  </span>
                </span>

                <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleModel(i)}
                    className="accent-violet-500"
                  />
                  ativo
                </label>

                <button
                  type="button"
                  onClick={() => removeModel(i)}
                  aria-label={`Remover ${info.model}`}
                  className="shrink-0 text-zinc-600 transition hover:text-red-400"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </button>
              </div>
            );
          })}

          <div className="mt-1 rounded-xl border border-white/[0.06] p-3">
            <p className="mb-2 text-xs font-medium text-zinc-400">Adicionar um modelo</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModel())}
                placeholder="provedor:modelo"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={addModel}
                disabled={!newSpec.includes(":")}
                className="glass glass-hover flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-zinc-300 transition disabled:opacity-40"
              >
                <AddIcon fontSize="small" />
              </button>
            </div>

            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Escreva no formato <span className="text-zinc-400">provedor:modelo</span>. O provedor
              precisa ser um que já tem chave no servidor:{" "}
              <span className="text-zinc-400">
                {catalog.providers
                  .filter((p) => p.available)
                  .map((p) => p.id)
                  .join(", ") || "nenhum"}
              </span>
              . Você NÃO coloca chave de API aqui.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                "groq:openai/gpt-oss-20b",
                "openrouter:deepseek/deepseek-chat-v3.1:free",
                "google:gemini-2.5-flash",
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setNewSpec(ex)}
                  className="glass-subtle rounded-full px-2.5 py-1 text-xs text-zinc-400 transition hover:text-zinc-200"
                >
                  {ex}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              O nome exato do modelo vem da documentação do provedor (Groq, OpenRouter, Google AI
              Studio). Para usar um provedor novo, a chave dele entra no arquivo .env do servidor.
            </p>
          </div>
        </div>
      </Field>

      {error && <p className="glass rounded-xl px-4 py-3 text-sm text-red-300">{error}</p>}
      {success && <p className="glass rounded-xl px-4 py-3 text-sm text-emerald-300">{success}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-300">
        {label}
        {hint && <span className="ml-2 font-normal text-zinc-600">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
