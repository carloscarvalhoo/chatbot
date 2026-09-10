"use client";

export default function SuggestedQuestions({ questions = [], onSelect, disabled }) {
  if (!questions.length) return null;

  return (
    <div
      className="mt-6 flex flex-wrap justify-center gap-2"
      role="list"
      aria-label="Perguntas sugeridas"
    >
      {questions.map((question, i) => (
        <button
          key={i}
          type="button"
          role="listitem"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
