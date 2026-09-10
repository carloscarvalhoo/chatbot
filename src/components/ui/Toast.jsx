"use client";

import { useEffect } from "react";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

export default function Toast({ message, type = "error", onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isError = type === "error";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3 shadow-xl animate-in slide-in-from-bottom-4 duration-300 ${
        isError ? "glass text-red-200 border-red-500/30" : "glass text-zinc-100"
      }`}
    >
      {isError ? (
        <ErrorOutlineIcon fontSize="small" className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircleOutlineIcon fontSize="small" className="mt-0.5 shrink-0 text-emerald-400" />
      )}

      <p className="flex-1 text-sm leading-snug">{message}</p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar notificação"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
}
