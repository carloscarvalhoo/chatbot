"use client";

import { useRef, useState } from "react";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function FileUploadCard({ uploading, progress, error, successMessage, onUpload }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  async function processFile(file) {
    if (!file) return;
    setSelectedFile(file);
    await onUpload(file);
    setSelectedFile(null);
  }

  function handleFileChange(e) {
    processFile(e.target.files?.[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf" || file?.name?.endsWith(".pdf")) {
      processFile(file);
    }
  }

  return (
    <section className="mb-8 rounded-[28px] border border-white/10 bg-[#111116]/90 p-6 shadow-2xl shadow-black/30">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-100">Enviar documento PDF</h2>
        <p className="mt-1 text-sm text-zinc-500">
          O sistema extrai o texto, divide em trechos e gera embeddings para busca semântica. Máximo
          10 MB por arquivo.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />

      {/* Área de drag & drop */}
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={`w-full rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-200 ${
          dragging
            ? "border-white/40 bg-white/5"
            : uploading
              ? "border-white/10 bg-white/2 cursor-not-allowed"
              : "border-white/10 hover:border-white/25 hover:bg-white/3 cursor-pointer"
        }`}
      >
        <UploadFileIcon
          className={`mx-auto mb-3 ${dragging ? "text-white" : "text-zinc-600"}`}
          style={{ fontSize: 36 }}
        />
        <p className="text-sm font-medium text-zinc-300">
          {uploading
            ? selectedFile
              ? `Processando "${selectedFile.name}"...`
              : "Processando..."
            : dragging
              ? "Solte o arquivo aqui"
              : "Clique ou arraste um PDF aqui"}
        </p>
        {!uploading && <p className="mt-1 text-xs text-zinc-600">Somente arquivos .pdf</p>}
      </button>

      {/* Barra de progresso */}
      {uploading && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Gerando embeddings semânticos...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-amber-300 transition-all duration-300"
              style={{ width: `${progress || 5}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 glass rounded-xl border-red-500/25 px-4 py-3 text-sm text-red-200">
          <ErrorOutlineIcon fontSize="small" className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 flex items-start gap-2 glass rounded-xl border-emerald-500/25 px-4 py-3 text-sm text-emerald-200">
          <CheckCircleOutlineIcon fontSize="small" className="mt-0.5 shrink-0" />
          {successMessage}
        </div>
      )}
    </section>
  );
}
