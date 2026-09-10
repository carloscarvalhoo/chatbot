"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Dropdown personalizado (substitui o <select> nativo, que não segue o tema).
 *
 * O painel é renderizado num portal no <body> e posicionado com `fixed`. Isso é
 * de propósito: se ele ficasse dentro de um elemento com `backdrop-filter` (o
 * header de vidro do chat, por exemplo), o blur dele só "veria" o vidro do pai,
 * não o conteúdo da página, e o efeito sumia.
 *
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: { value: string, label: string, hint?: string }[],
 *   ariaLabel?: string,
 *   className?: string,
 *   align?: "left" | "right",
 * }} props
 */
export default function Select({
  value,
  onChange,
  options,
  ariaLabel = "Selecionar",
  className = "",
  align = "left",
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => setMounted(true), []);

  const updateRect = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  };

  useLayoutEffect(() => {
    if (open) updateRect();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!btnRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReflow() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const panelStyle = rect
    ? {
        position: "fixed",
        top: rect.bottom + 6,
        left: align === "right" ? undefined : rect.left,
        right: align === "right" ? window.innerWidth - rect.right : undefined,
        minWidth: rect.width,
      }
    : { display: "none" };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className="glass glass-hover flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-zinc-200 outline-none transition"
      >
        <span className="truncate">{selected?.label}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted &&
        open &&
        createPortal(
          <ul
            ref={panelRef}
            role="listbox"
            style={panelStyle}
            className="glass-strong z-[100] max-h-72 overflow-auto rounded-2xl p-1.5"
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.hint && (
                      <span className="truncate text-[10px] text-zinc-500">{option.hint}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </div>
  );
}
