"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function ChatError({ error, reset }) {
  useEffect(() => {
    console.error("Chat error boundary:", error);
  }, [error]);

  return (
    <ErrorState
      title="O chat travou"
      message="Não foi possível carregar a conversa. Tente de novo ou volte para a tela inicial."
      onRetry={reset}
      homeHref="/chat"
    />
  );
}
