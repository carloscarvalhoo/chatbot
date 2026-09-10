"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";

const ConfirmContext = createContext(null);

/**
 * Substitui window.confirm por um modal do próprio site.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Apagar?", message: "...", danger: true })) { ... }
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>");
  return ctx;
}

export default function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: options.title || "Confirmar",
        message: options.message || "",
        confirmLabel: options.confirmLabel || "Confirmar",
        cancelLabel: options.cancelLabel || "Cancelar",
        danger: Boolean(options.danger),
      });
    });
  }, []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => close(false)}
              className="glass glass-hover rounded-xl px-4 py-2 text-sm text-zinc-300 transition"
            >
              {state?.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                state?.danger
                  ? "bg-red-500/90 text-white hover:bg-red-500"
                  : "bg-white text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {state?.confirmLabel}
            </button>
          </>
        }
      >
        {state?.message}
      </Modal>
    </ConfirmContext.Provider>
  );
}
