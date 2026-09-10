"use client";

import { useEffect, useRef, useState } from "react";
import ChatInput from "@/components/chat/ChatInput";
import ChatMessage from "@/components/chat/ChatMessage";
import SuggestedQuestions from "@/components/chat/SuggestedQuestions";
import Link from "next/link";
import Toast from "@/components/ui/Toast";
import ModelPicker from "@/components/chat/ModelPicker";
import { useChat } from "@/features/chat/hooks/useChat";

export default function ChatWidget({ settings = {} }) {
  const {
    messages,
    loading,
    error,
    sendMessage,
    rateMessage,
    startNewChat,
    preferredModel,
    setPreferredModel,
  } = useChat();

  const messagesEndRef = useRef(null);
  const [toast, setToast] = useState("");

  const hasMessages = messages.length > 0;
  const greeting = useGreeting();

  const botName = settings.botName || "ELO";
  const suggestedQuestions = settings.suggestedQuestions || [];
  const footerNote =
    settings.footerNote?.trim() ||
    `O ${botName} pode cometer erros. Consulte o setor responsável quando necessário.`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (error) setToast(error);
  }, [error]);

  return (
    <main className="relative h-dvh overflow-hidden text-white">
      {/* Área rolável ocupa a tela inteira; o conteúdo passa POR TRÁS do header
          e do input, que ficam por cima com o vidro desfocando o que rola. */}
      <div className="h-full overflow-y-auto" role="log" aria-live="polite" aria-label="Mensagens">
        {!hasMessages ? (
          <div className="flex min-h-full flex-col items-center px-4 pb-40 pt-[26vh] sm:justify-center sm:px-6 sm:pb-24 sm:pt-24">
            <h1 className="mb-8 bg-gradient-to-r from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-center text-2xl font-medium text-transparent sm:mb-14 sm:text-4xl md:text-5xl">
              {greeting}, eu sou o <span className="font-bold">{botName}.</span>
            </h1>
            <div className="w-full max-w-2xl">
              <ChatInput loading={loading} onSend={sendMessage} />
            </div>
            <SuggestedQuestions
              questions={suggestedQuestions}
              onSelect={sendMessage}
              disabled={loading}
            />
            <p className="mt-6 px-4 text-center text-xs text-zinc-600">{footerNote}</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 pb-44 pt-24 sm:px-6 sm:pb-48 sm:pt-28">
            <div className="space-y-6 sm:space-y-8">
              {messages.map((message, index) => {
                const prevUser = [...messages.slice(0, index)]
                  .reverse()
                  .find((m) => m.role === "user");
                return (
                  <div
                    key={message.id}
                    className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                  >
                    <ChatMessage
                      message={message}
                      onRate={message.role === "model" ? rateMessage : null}
                      onRetry={prevUser ? () => sendMessage(prevUser.text) : undefined}
                      supportUrl={settings.supportUrl}
                      supportLabel={settings.supportLabel}
                      supportContacts={settings.supportContacts}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Header flutuante em vidro */}
      <header className="glass absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 sm:h-[68px] sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-lg font-semibold tracking-wide text-zinc-100 transition hover:text-zinc-300 sm:text-xl"
        >
          {botName} IA
        </Link>

        <div className="flex items-center gap-2.5">
          {hasMessages && (
            <button
              type="button"
              onClick={startNewChat}
              title="Nova conversa"
              aria-label="Nova conversa"
              className="glass glass-hover flex h-9 w-9 items-center justify-center rounded-xl text-zinc-300 transition"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M3 10h14M10 3v14" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <ModelPicker value={preferredModel} onChange={setPreferredModel} />
        </div>
      </header>

      {/* Input flutuante em vidro (só na conversa ativa) */}
      {hasMessages && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="mx-auto w-full max-w-3xl">
            <ChatInput loading={loading} onSend={sendMessage} />
            <p className="mt-2 text-center text-xs text-zinc-500 sm:mt-3">{footerNote}</p>
          </div>
        </div>
      )}

      <Toast message={toast} type="error" onClose={() => setToast("")} />
    </main>
  );
}

function useGreeting() {
  const [greeting, setGreeting] = useState("Olá");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Bom dia");
    else if (hour < 18) setGreeting("Boa tarde");
    else setGreeting("Boa noite");
  }, []);
  return greeting;
}
