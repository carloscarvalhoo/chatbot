"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <ErrorState
      message="Tivemos um problema ao carregar esta página. Recarregar costuma resolver."
      onRetry={reset}
    />
  );
}
