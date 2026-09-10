"use client";

import { useState } from "react";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";

export default function ChatInput({ loading, onSend }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    const cleanText = text.trim();

    if (!cleanText || loading) return;

    onSend(cleanText);
    setText("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="glass flex items-end gap-2 rounded-[22px] px-3 py-3 sm:gap-3 sm:rounded-[28px] sm:px-4 sm:py-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Como posso ajudar você hoje?"
          className="max-h-36 min-h-7 flex-1 resize-none bg-transparent ps-2 py-1.5 text-sm text-white outline-none placeholder:text-zinc-500 sm:ps-4 sm:py-2 sm:text-base"
        />

        <button
          type="submit"
          title="Enviar"
          disabled={!text.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          <ArrowUpwardRoundedIcon fontSize="small" />
        </button>
      </div>
    </form>
  );
}
