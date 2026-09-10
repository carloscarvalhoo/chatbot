import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import RatingButtons from "@/components/chat/RatingButtons";
import MessageMeta from "@/components/chat/MessageMeta";
import QueueNotice from "@/components/chat/QueueNotice";

export default function ChatMessage({ message, onRate, onRetry, supportUrl, supportLabel }) {
  const isUser = message.role === "user";

  if (message.isQueued) {
    return (
      <div className="flex justify-start">
        <QueueNotice
          until={message.queuedUntil}
          initialMs={message.queuedMs}
          reason={message.queuedReason}
          supportUrl={supportUrl}
          supportLabel={supportLabel}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="glass max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium text-white sm:px-5 sm:text-base">
          {message.text}
        </div>
      </div>
    );
  }

  if (message.pending && !message.text) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-1 py-3 pl-1">
          {[0, 150, 300].map((delay) => (
            <div
              key={delay}
              className="h-1.5 w-1.5 rounded-full bg-white animate-bounce shadow-[0_0_8px_white]"
              style={{ animationDelay: `${delay}ms` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start">
      <div className="max-w-full sm:max-w-[780px]">
        <div className={`chat-md ${message.isError ? "text-red-400" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {message.text}
          </ReactMarkdown>
        </div>

        {!message.isError && (
          <MessageMeta
            modelUsed={message.modelUsed}
            usedFallback={message.usedFallback}
            sources={message.sources}
            sourcesStale={message.sourcesStale}
          />
        )}

        {!message.isError && onRate && (
          <RatingButtons
            messageId={message.id}
            messageText={message.text}
            currentRating={message.rating}
            onRate={onRate}
          />
        )}
      </div>
    </div>
  );
}
