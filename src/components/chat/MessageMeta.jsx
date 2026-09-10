function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

// Nomes vindos de <title> às vezes repetem o nome do site. Limpa e encurta.
function cleanName(name) {
  let value = String(name || "Documento").trim();
  // remove repetição imediata ("Foo BarFoo Bar" -> "Foo Bar")
  const half = Math.floor(value.length / 2);
  if (value.length > 20 && value.slice(0, half).trim() === value.slice(half).trim()) {
    value = value.slice(0, half).trim();
  }
  // corta no separador de site (–, |, -)
  value = value.split(/\s+[–|]\s+/)[0].trim();
  return value.length > 44 ? `${value.slice(0, 43)}…` : value;
}

export default function MessageMeta({
  modelUsed,
  usedFallback,
  sources = [],
  sourcesStale = false,
}) {
  const hasSources = sources.length > 0;
  // Sem fontes e sem aviso de desatualização (ex.: saudação, conversa fiada):
  // não polui a resposta com chip de modelo nem nada.
  if (!hasSources && !sourcesStale) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {sourcesStale && (
        <p className="text-[11px] text-amber-400/80">
          ⚠️ Parte desta resposta pode estar desatualizada. Confirme nos canais oficiais.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
        {hasSources &&
          sources.map((source, i) => {
            const updated = formatDate(source.updatedAt);
            const label = updated
              ? `${cleanName(source.name)} · atual. ${updated}`
              : cleanName(source.name);
            const stale = source.freshness === "expired";
            const border = stale ? "border-amber-500/40 text-amber-400/80" : "border-white/10";
            return source.url ? (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className={`max-w-full truncate rounded-full border px-2 py-0.5 transition hover:border-white/25 hover:text-zinc-400 ${border}`}
                title={source.url}
              >
                {label}
              </a>
            ) : (
              <span
                key={i}
                className={`max-w-full truncate rounded-full border px-2 py-0.5 ${border}`}
                title={source.name}
              >
                {label}
              </span>
            );
          })}

        {modelUsed && (
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-zinc-600">
            {modelUsed}
            {usedFallback ? " (fallback)" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
