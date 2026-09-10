"use client";

import ThumbUpOutlinedIcon from "@mui/icons-material/ThumbUpOutlined";
import ThumbDownOutlinedIcon from "@mui/icons-material/ThumbDownOutlined";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";

export default function RatingButtons({ messageId, messageText, currentRating, onRate }) {
  const isUp = currentRating === "up";
  const isDown = currentRating === "down";

  return (
    <div
      className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      aria-label="Avaliar resposta"
    >
      <button
        type="button"
        onClick={() => !currentRating && onRate({ messageId, rating: "up", messageText })}
        disabled={Boolean(currentRating)}
        title="Resposta útil"
        aria-label="Resposta útil"
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
          isUp
            ? "text-emerald-400 cursor-default"
            : "text-zinc-500 hover:text-emerald-400 disabled:cursor-default"
        }`}
      >
        {isUp ? <ThumbUpIcon fontSize="inherit" /> : <ThumbUpOutlinedIcon fontSize="inherit" />}
      </button>

      <button
        type="button"
        onClick={() => !currentRating && onRate({ messageId, rating: "down", messageText })}
        disabled={Boolean(currentRating)}
        title="Resposta não útil"
        aria-label="Resposta não útil"
        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors ${
          isDown
            ? "text-red-400 cursor-default"
            : "text-zinc-500 hover:text-red-400 disabled:cursor-default"
        }`}
      >
        {isDown ? (
          <ThumbDownIcon fontSize="inherit" />
        ) : (
          <ThumbDownOutlinedIcon fontSize="inherit" />
        )}
      </button>

      {currentRating && (
        <span className="text-xs text-zinc-600 ml-1">
          {isUp ? "Obrigado pelo feedback!" : "Vamos melhorar!"}
        </span>
      )}
    </div>
  );
}
