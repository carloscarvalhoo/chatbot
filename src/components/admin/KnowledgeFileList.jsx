"use client";

import { useMemo, useState } from "react";

const FRESHNESS = {
  fresh: { label: "Em dia", cls: "border-green-400/30 bg-green-400/10 text-green-300" },
  dueForReview: { label: "Revisar", cls: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  expired: { label: "Vencido", cls: "border-red-400/30 bg-red-400/10 text-red-300" },
};

function FreshnessBadge({ freshness }) {
  const info = FRESHNESS[freshness];
  if (!info) return null;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

function DocActions({ file, onReprocess, onReview, onDelete }) {
  return (
    <div className="flex flex-wrap gap-2">
      {onReview &&
        file?.id &&
        (file.freshness === "dueForReview" || file.freshness === "expired") && (
          <button
            onClick={() => onReview(file.id)}
            className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
          >
            Marcar revisado
          </button>
        )}
      {onReprocess && file?.id && (
        <button
          onClick={() => onReprocess(file.id)}
          className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
        >
          Reprocessar
        </button>
      )}
      <button
        onClick={() => onDelete(file)}
        className="shrink-0 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/[0.14]"
      >
        Apagar
      </button>
    </div>
  );
}

export default function KnowledgeFileList({
  files,
  loading,
  onDelete,
  onReprocess,
  onReview,
  selectedFiles = [],
  onToggleSelection,
  onToggleSelectAll,
  allSelected,
}) {
  const [openGroups, setOpenGroups] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  function getFileKey(file) {
    return (
      file?.id ||
      file?.docId ||
      file?._id ||
      file?.path ||
      file?.storagePath ||
      file?.url ||
      file?.sourceUrl ||
      file?.siteUrl ||
      file?.link ||
      file?.originalName
    );
  }

  function getFileUrl(file) {
    return file?.url || file?.sourceUrl || file?.siteUrl || file?.link || "";
  }

  function getDomainFromUrl(url) {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url || "site-sem-dominio";
    }
  }

  function getPathFromUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname || "/";
    } catch {
      return url;
    }
  }

  function getFileName(file) {
    const url = getFileUrl(file);

    if (isSiteFile(file) && url) {
      return file?.title || getPathFromUrl(url) || getDomainFromUrl(url);
    }

    return file?.originalName || file?.fileName || file?.name || file?.title || "Arquivo sem nome";
  }

  function isPdfFile(file) {
    const name = (file?.originalName || file?.fileName || file?.name || "").toLowerCase();

    const type = (
      file?.type ||
      file?.mimeType ||
      file?.contentType ||
      file?.sourceType ||
      ""
    ).toLowerCase();

    return name.endsWith(".pdf") || type.includes("pdf") || type.includes("application/pdf");
  }

  function isSiteFile(file) {
    const sourceType = (file?.sourceType || file?.type || file?.kind || "").toLowerCase();

    const url = getFileUrl(file);

    if (isPdfFile(file)) return false;

    return (
      sourceType.includes("url") ||
      sourceType.includes("site") ||
      sourceType.includes("link") ||
      sourceType.includes("web") ||
      Boolean(url)
    );
  }

  function formatFileSize(bytes) {
    const size = Number(bytes);

    if (!size || Number.isNaN(size)) return "";

    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value = value / 1024;
      unitIndex++;
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function getDateObject(value) {
    if (!value) return null;

    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return null;

    return date;
  }

  function formatDate(value) {
    const date = getDateObject(value);

    if (!date) return "";

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getIndexedDate(file) {
    return file?.createdAt || file?.indexedAt || file?.uploadedAt || file?.updatedAt;
  }

  function getPageCount(file) {
    return file?.pageCount || file?.pages || file?.totalPages || file?.metadata?.pageCount || 0;
  }

  function getPdfDetails(file) {
    const details = [];

    const size = formatFileSize(
      file?.size || file?.fileSize || file?.sizeBytes || file?.metadata?.size,
    );

    const pages = getPageCount(file);
    const createdAt = formatDate(getIndexedDate(file));

    if (size) details.push(`Tamanho: ${size}`);
    if (pages) details.push(`${pages} página(s)`);
    if (createdAt) details.push(`Enviado em ${createdAt}`);

    return details;
  }

  function getSiteDetails(file) {
    const details = [];

    const indexedAt = formatDate(getIndexedDate(file));

    if (indexedAt) details.push(`Indexado em ${indexedAt}`);

    return details;
  }

  function isFileSelected(file) {
    const fileKey = getFileKey(file);

    return selectedFiles.some((selectedFile) => getFileKey(selectedFile) === fileKey);
  }

  function toggleGroup(domain) {
    setOpenGroups((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  }

  function isGroupSelected(groupFiles) {
    return groupFiles.every((file) => isFileSelected(file));
  }

  function toggleGroupSelection(groupFiles) {
    const groupSelected = isGroupSelected(groupFiles);

    groupFiles.forEach((file) => {
      const selected = isFileSelected(file);

      if (groupSelected && selected) {
        onToggleSelection(file);
      }

      if (!groupSelected && !selected) {
        onToggleSelection(file);
      }
    });
  }

  function selectDomain(groupFiles) {
    const anyUnselected = groupFiles.some((file) => !isFileSelected(file));
    groupFiles.forEach((file) => {
      const selected = isFileSelected(file);
      if (anyUnselected ? !selected : selected) onToggleSelection(file);
    });
  }

  const summary = useMemo(() => {
    const allFiles = files || [];

    const totalSources = allFiles.length;
    const totalSites = allFiles.filter(isSiteFile).length;
    const totalPdfs = allFiles.filter(isPdfFile).length;
    const totalOthers = totalSources - totalSites - totalPdfs;

    return {
      totalSources,
      totalSites,
      totalPdfs,
      totalOthers,
      selected: selectedFiles.length,
    };
  }, [files, selectedFiles]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return (files || []).filter((file) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "sites" && isSiteFile(file)) ||
        (activeFilter === "pdfs" && isPdfFile(file)) ||
        (activeFilter === "others" && !isSiteFile(file) && !isPdfFile(file));

      if (!matchesFilter) return false;

      if (!term) return true;

      const name = getFileName(file).toLowerCase();
      const url = getFileUrl(file).toLowerCase();
      const domain = getDomainFromUrl(url).toLowerCase();

      return name.includes(term) || url.includes(term) || domain.includes(term);
    });
  }, [files, searchTerm, activeFilter]);

  const groupedData = useMemo(() => {
    const siteGroupsMap = {};
    const pdfFiles = [];
    const otherFiles = [];

    filteredFiles.forEach((file) => {
      if (isSiteFile(file)) {
        const url = getFileUrl(file);
        const domain = getDomainFromUrl(url);

        if (!siteGroupsMap[domain]) {
          siteGroupsMap[domain] = [];
        }

        siteGroupsMap[domain].push(file);
        return;
      }

      if (isPdfFile(file)) {
        pdfFiles.push(file);
        return;
      }

      otherFiles.push(file);
    });

    const siteGroups = Object.entries(siteGroupsMap)
      .map(([domain, groupFiles]) => {
        const sortedFiles = [...groupFiles].sort((a, b) => {
          const aUrl = getFileUrl(a);
          const bUrl = getFileUrl(b);

          const aValue = getPathFromUrl(aUrl) || getFileName(a) || "";
          const bValue = getPathFromUrl(bUrl) || getFileName(b) || "";

          return aValue.localeCompare(bValue, "pt-BR", {
            sensitivity: "base",
          });
        });

        const latestDate = sortedFiles
          .map((file) => getDateObject(getIndexedDate(file)))
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0];

        return {
          domain,
          files: sortedFiles,
          latestDate,
        };
      })
      .sort((a, b) =>
        a.domain.localeCompare(b.domain, "pt-BR", {
          sensitivity: "base",
        }),
      );

    const sortedPdfFiles = [...pdfFiles].sort((a, b) =>
      getFileName(a).localeCompare(getFileName(b), "pt-BR", {
        sensitivity: "base",
      }),
    );

    const sortedOtherFiles = [...otherFiles].sort((a, b) =>
      getFileName(a).localeCompare(getFileName(b), "pt-BR", {
        sensitivity: "base",
      }),
    );

    return {
      siteGroups,
      pdfFiles: sortedPdfFiles,
      otherFiles: sortedOtherFiles,
    };
  }, [filteredFiles]);

  const filterButtons = [
    { id: "all", label: "Todos", count: summary.totalSources },
    { id: "sites", label: "Sites", count: summary.totalSites },
    { id: "pdfs", label: "PDFs", count: summary.totalPdfs },
    { id: "others", label: "Outros", count: summary.totalOthers },
  ];

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-zinc-400">Carregando arquivos...</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-zinc-500">Nenhum item encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total de fontes" value={summary.totalSources} />
        <SummaryCard label="Sites" value={summary.totalSites} />
        <SummaryCard label="PDFs" value={summary.totalPdfs} />
        <SummaryCard label="Outros" value={summary.totalOthers} />
        <SummaryCard label="Selecionados" value={summary.selected} />
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 cursor-pointer accent-white"
              />

              <span className="text-sm text-zinc-400">Selecionar todos</span>
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, domínio ou URL..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/30 md:max-w-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterButtons.map((button) => (
              <button
                key={button.id}
                onClick={() => setActiveFilter(button.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  activeFilter === button.id
                    ? "border-white bg-white text-black"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {button.label} ({button.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFiles.length === 0 && (
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-zinc-500">Nenhum resultado encontrado para sua busca.</p>
        </div>
      )}

      {groupedData.siteGroups.length > 0 && (
        <section className="glass rounded-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-200">Sites indexados</h3>
          </div>

          <div className="divide-y divide-white/10">
            {groupedData.siteGroups.map((group) => {
              const opened = openGroups[group.domain];
              const groupSelected = isGroupSelected(group.files);

              return (
                <div key={group.domain}>
                  <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={groupSelected}
                        onChange={() => toggleGroupSelection(group.files)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-white"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">
                            {group.domain}
                          </p>

                          <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                            Site
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">
                            {group.files.length} página(s)
                          </span>

                          {group.latestDate && (
                            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">
                              Última indexação em {formatDate(group.latestDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleGroup(group.domain)}
                        className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
                      >
                        {opened ? "Fechar" : "Abrir"}
                      </button>

                      <button
                        onClick={() => selectDomain(group.files)}
                        className="glass glass-hover rounded-lg px-3 py-1.5 text-sm text-zinc-300 transition"
                      >
                        Selecionar tudo
                      </button>
                    </div>
                  </div>

                  {opened && (
                    <div className="space-y-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
                      {group.files.map((file, index) => {
                        const fileKey = getFileKey(file) || index;
                        const fileName = getFileName(file);
                        const fileUrl = getFileUrl(file);
                        const selected = isFileSelected(file);
                        const details = getSiteDetails(file);

                        return (
                          <div
                            key={fileKey}
                            className={`rounded-xl border border-white/10 p-3 transition ${
                              selected ? "bg-white/[0.08]" : "bg-white/[0.03] hover:bg-white/[0.05]"
                            }`}
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => onToggleSelection(file)}
                                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-white"
                                />

                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-sm font-medium text-white">
                                      {fileName}
                                    </p>
                                    <FreshnessBadge freshness={file.freshness} />
                                  </div>

                                  {fileUrl && (
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 block max-w-xl truncate text-xs text-blue-300 transition hover:text-blue-200 hover:underline"
                                    >
                                      {fileUrl}
                                    </a>
                                  )}

                                  {details.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {details.map((detail) => (
                                        <span
                                          key={detail}
                                          className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400"
                                        >
                                          {detail}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <DocActions
                                file={file}
                                onReprocess={onReprocess}
                                onReview={onReview}
                                onDelete={onDelete}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groupedData.pdfFiles.length > 0 && (
        <section className="glass rounded-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-200">PDFs enviados</h3>
          </div>

          <div className="divide-y divide-white/10">
            {groupedData.pdfFiles.map((file, index) => {
              const fileKey = getFileKey(file) || index;
              const fileName = getFileName(file);
              const selected = isFileSelected(file);
              const details = getPdfDetails(file);

              return (
                <div
                  key={fileKey}
                  className={`flex flex-col gap-4 px-4 py-4 transition md:flex-row md:items-center md:justify-between ${
                    selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelection(file)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-white"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{fileName}</p>

                        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[11px] font-medium text-red-300">
                          PDF
                        </span>

                        <FreshnessBadge freshness={file.freshness} />
                      </div>

                      {details.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {details.map((detail) => (
                            <span
                              key={detail}
                              className="rounded-full bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400"
                            >
                              {detail}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <DocActions
                    file={file}
                    onReprocess={onReprocess}
                    onReview={onReview}
                    onDelete={onDelete}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {groupedData.otherFiles.length > 0 && (
        <section className="glass rounded-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-200">Outras fontes</h3>
          </div>

          <div className="divide-y divide-white/10">
            {groupedData.otherFiles.map((file, index) => {
              const fileKey = getFileKey(file) || index;
              const fileName = getFileName(file);
              const selected = isFileSelected(file);

              return (
                <div
                  key={fileKey}
                  className={`flex items-center justify-between gap-4 px-4 py-4 transition ${
                    selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelection(file)}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-white"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{fileName}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDelete(file)}
                    className="shrink-0 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/[0.14]"
                  >
                    Apagar
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
