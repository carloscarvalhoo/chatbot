import { NextResponse } from "next/server";
import { aiService } from "@/server/ai/aiService";
import {
  checkChatRateLimit,
  sanitizeBufferHistory,
  sanitizeLongMemory,
  validateChatMessage,
} from "@/server/chat/chatGuards";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mensagens seguras para o cliente. Detalhes internos (nomes de modelo, chaves
// ausentes, stack) ficam só no log do servidor.
function handleChatError(error) {
  logger.error("Erro na rota /api/chat:", error);

  const status = error?.statusCode || 500;

  if (status === 400) {
    return NextResponse.json({ error: error?.message || "Requisição inválida." }, { status });
  }

  if (status === 429) {
    return NextResponse.json(
      { error: "Muitas mensagens em pouco tempo. Aguarde um instante e tente de novo." },
      { status },
    );
  }

  return NextResponse.json(
    {
      error: "Não consegui responder agora. Tente novamente em alguns instantes.",
      retryAfterMs: error?.retryAfterMs || null,
      reason: error?.reason || null,
    },
    { status: status >= 500 ? 503 : status },
  );
}

export async function POST(request) {
  let params;
  try {
    await checkChatRateLimit(request);

    const body = await request.json();
    params = {
      message: validateChatMessage(body?.message),
      bufferHistory: sanitizeBufferHistory(body?.bufferHistory),
      longMemory: sanitizeLongMemory(body?.longMemory),
      conversationId: String(body?.conversationId || "").slice(0, 64) || null,
      preferredModel: String(body?.preferredModel || "").slice(0, 80) || null,
      stream: body?.stream !== false,
    };
  } catch (error) {
    return handleChatError(error);
  }

  // Modo não-streaming (usado por testes / integrações).
  if (!params.stream) {
    try {
      const result = await aiService.sendMessage(
        params.message,
        params.bufferHistory,
        params.longMemory,
        params.conversationId,
        params.preferredModel,
      );
      return NextResponse.json(result);
    } catch (error) {
      return handleChatError(error);
    }
  }

  // Streaming: NDJSON — uma linha JSON por evento.
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        for await (const event of aiService.sendMessageStream(
          params.message,
          params.bufferHistory,
          params.longMemory,
          params.conversationId,
          params.preferredModel,
        )) {
          send(event);
        }
      } catch (error) {
        logger.error("Erro no stream /api/chat:", error);
        send({ type: "error", error: "Não consegui responder agora. Tente novamente." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
