"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  deleteKnowledgeFile,
  getKnowledgeFiles,
  uploadKnowledgeFile,
  indexKnowledgeUrl,
  patchKnowledgeFile,
  reindexAllFiles,
  refreshUrls,
} from "@/features/admin/knowledge-files/services/knowledgeFilesClient";

export function useKnowledgeFiles() {
  const router = useRouter();
  const confirm = useConfirm();

  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadFiles() {
    try {
      setLoadingFiles(true);
      setError("");
      setFiles(await getKnowledgeFiles());
    } catch (err) {
      if (err?.message?.includes("autorizado")) {
        router.push("/admin/login");
        return;
      }
      setError(err?.message || "Erro ao carregar arquivos.");
    } finally {
      setLoadingFiles(false);
    }
  }

  async function uploadFile(file) {
    setUploading(true);
    setProgress(0);
    setError("");
    setSuccessMessage("");
    try {
      await uploadKnowledgeFile(file, setProgress);
      setSuccessMessage("PDF processado e salvo.");
      await loadFiles();
    } catch (err) {
      setError(err?.message || "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function uploadUrl(urls) {
    setUploading(true);
    setError("");
    setSuccessMessage("");
    try {
      await indexKnowledgeUrl(urls);
      setSuccessMessage(`${urls.length} página(s) indexada(s).`);
      await loadFiles();
    } catch (err) {
      setError(err?.message || "Erro ao indexar as URLs.");
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(fileDoc) {
    const name = fileDoc?.originalName || fileDoc?.url || "esta fonte";
    const ok = await confirm({
      title: "Apagar fonte",
      message: `"${name}" será removida da base de conhecimento.`,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return false;

    setError("");
    setSuccessMessage("");
    try {
      await deleteKnowledgeFile(fileDoc);
      setSuccessMessage("Fonte removida.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao remover.");
      return false;
    }
  }

  async function removeManyFiles(fileDocs) {
    if (!fileDocs?.length) return false;
    const ok = await confirm({
      title: "Apagar selecionadas",
      message: `${fileDocs.length} fonte(s) serão removidas da base.`,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (!ok) return false;

    setError("");
    setSuccessMessage("");
    try {
      await Promise.all(fileDocs.map(deleteKnowledgeFile));
      setSuccessMessage("Fontes removidas.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao remover.");
      return false;
    }
  }

  async function markReviewed(fileId) {
    if (!fileId) return false;
    setError("");
    setSuccessMessage("");
    try {
      await patchKnowledgeFile(fileId, { action: "review" });
      setSuccessMessage("Marcado como revisado.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao marcar revisão.");
      return false;
    }
  }

  async function reprocessFile(fileId) {
    if (!fileId) return false;
    const ok = await confirm({
      title: "Reprocessar",
      message: "O documento será re-fragmentado e os embeddings refeitos.",
      confirmLabel: "Reprocessar",
    });
    if (!ok) return false;

    setReindexing(true);
    setError("");
    setSuccessMessage("");
    try {
      await patchKnowledgeFile(fileId, { action: "reprocess" });
      setSuccessMessage("Documento reprocessado.");
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao reprocessar.");
      return false;
    } finally {
      setReindexing(false);
    }
  }

  async function reindexAll() {
    const ok = await confirm({
      title: "Reindexar tudo",
      message:
        "Refaz o processamento de toda a base. Pode levar alguns minutos e consome cota de embeddings.",
      confirmLabel: "Reindexar",
    });
    if (!ok) return false;

    setReindexing(true);
    setError("");
    setSuccessMessage("");
    try {
      const r = await reindexAllFiles();
      setSuccessMessage(
        `Reindexação: ${r.ok}/${r.total} documentos${r.failed?.length ? `, ${r.failed.length} com erro` : ""}.`,
      );
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao reindexar.");
      return false;
    } finally {
      setReindexing(false);
    }
  }

  async function checkUrlUpdates() {
    const ok = await confirm({
      title: "Verificar atualizações",
      message: "Compara cada página do site com o que está na base e re-processa só o que mudou.",
      confirmLabel: "Verificar",
    });
    if (!ok) return false;

    setReindexing(true);
    setError("");
    setSuccessMessage("");
    try {
      const r = await refreshUrls();
      setSuccessMessage(
        `Verificação: ${r.unchanged} iguais, ${r.updated} atualizada(s)${
          r.failed?.length ? `, ${r.failed.length} inacessível(is)` : ""
        }.`,
      );
      await loadFiles();
      return true;
    } catch (err) {
      setError(err?.message || "Erro ao verificar.");
      return false;
    } finally {
      setReindexing(false);
    }
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
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
    reloadFiles: loadFiles,
  };
}
