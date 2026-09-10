"use client";

import { useState } from "react";
import FileUploadCard from "@/components/admin/FileUploadCard";
import UrlUploadCard from "@/components/admin/UrlUploadCard";
import KnowledgeFileList from "@/components/admin/KnowledgeFileList";
import EmbeddingLoader from "@/components/ui/EmbeddingLoader";
import PageTitle from "@/components/admin/ui/PageTitle";
import Button from "@/components/admin/ui/Button";
import { useKnowledgeFiles } from "@/features/admin/knowledge-files/hooks/useKnowledgeFiles";

export default function AdminFilesPage() {
  const {
    files,
    loadingFiles,
    uploading,
    reindexing,
    progress,
    error,
    successMessage,
    uploadFile,
    uploadUrl,
    removeFile,
    removeManyFiles,
    markReviewed,
    reprocessFile,
    reindexAll,
    checkUrlUpdates,
  } = useKnowledgeFiles();

  const [activeTab, setActiveTab] = useState("link");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadingType, setUploadingType] = useState("url");

  const getFileKey = (file) => file?.id || file?.sourceUrl || file?.url || file?.originalName;

  const isFileSelected = (file) => selectedFiles.some((s) => getFileKey(s) === getFileKey(file));

  const allSelected = files.length > 0 && files.every(isFileSelected);

  function toggleFileSelection(file) {
    const key = getFileKey(file);
    setSelectedFiles((prev) =>
      prev.some((s) => getFileKey(s) === key)
        ? prev.filter((s) => getFileKey(s) !== key)
        : [...prev, file],
    );
  }

  function toggleSelectAll() {
    setSelectedFiles(allSelected ? [] : files);
  }

  async function handleDeleteSelected() {
    if (!selectedFiles.length) return;
    setDeletingSelected(true);
    try {
      if (await removeManyFiles(selectedFiles)) setSelectedFiles([]);
    } finally {
      setDeletingSelected(false);
    }
  }

  async function handleUploadUrl(urls) {
    setUploadingType("url");
    setUploadingCount(Array.isArray(urls) ? urls.length : 1);
    await uploadUrl(urls);
    setUploadingCount(0);
  }

  async function handleUploadFile(file) {
    setUploadingType("file");
    setUploadingCount(1);
    await uploadFile(file);
    setUploadingCount(0);
  }

  const tabs = [
    { id: "link", label: "Links e sites" },
    { id: "file", label: "Upload de arquivos" },
  ];

  return (
    <div className="space-y-10">
      <EmbeddingLoader active={uploading} count={uploadingCount} type={uploadingType} />

      <div>
        <PageTitle
          title="Base de conhecimento"
          description="As fontes que o assistente consulta para responder."
        />

        <div className="mt-6 flex gap-1 border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition ${
                activeTab === tab.id
                  ? "border-zinc-100 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "link" ? (
            <UrlUploadCard
              uploading={uploading}
              error={error}
              successMessage={successMessage}
              onUploadUrl={handleUploadUrl}
            />
          ) : (
            <FileUploadCard
              uploading={uploading}
              progress={progress}
              error={error}
              successMessage={successMessage}
              onUpload={handleUploadFile}
            />
          )}
        </div>
      </div>

      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-200">Fontes ativas</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={checkUrlUpdates} disabled={reindexing}>
              {reindexing ? "Verificando…" : "Verificar atualizações"}
            </Button>
            <Button size="sm" onClick={reindexAll} disabled={reindexing}>
              {reindexing ? "Reindexando…" : "Reindexar tudo"}
            </Button>
            {selectedFiles.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={handleDeleteSelected}
                disabled={deletingSelected}
              >
                {deletingSelected ? "Apagando…" : `Apagar (${selectedFiles.length})`}
              </Button>
            )}
          </div>
        </div>

        <KnowledgeFileList
          files={files}
          loading={loadingFiles}
          onDelete={removeFile}
          onReprocess={reprocessFile}
          onReview={markReviewed}
          selectedFiles={selectedFiles}
          onToggleSelection={toggleFileSelection}
          onToggleSelectAll={toggleSelectAll}
          allSelected={allSelected}
        />
      </div>
    </div>
  );
}
