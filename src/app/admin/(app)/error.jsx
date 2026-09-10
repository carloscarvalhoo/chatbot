"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error("Admin error boundary:", error);
  }, [error]);

  return (
    <ErrorState
      title="Erro no painel"
      message="Algo falhou ao carregar esta seção do painel. Tente novamente."
      onRetry={reset}
      homeHref="/admin/files"
    />
  );
}
