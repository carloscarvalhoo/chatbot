"use client";

import { useEffect } from "react";

/**
 * Modal genérico. Fecha no Esc, no clique fora e no X.
 */
export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div
        className={`glass-strong relative w-full ${width} rounded-2xl animate-in fade-in zoom-in-95 duration-150`}
      >
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="px-5 py-4 text-sm leading-6 text-zinc-300">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/[0.06] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
