import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { aiService } from "@/server/ai/aiService";
import { searchKnowledgeChunks, formatKnowledgeContext } from "@/server/knowledge/searchKnowledge";
import { validateChatMessage } from "@/server/chat/chatGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const message = validateChatMessage(body?.message);

    const [chunks, result] = await Promise.all([
      searchKnowledgeChunks(message, { topK: 5 }),
      aiService.sendMessage(message, [], null),
    ]);

    return NextResponse.json({
      answer: result.text,
      modelUsed: result.modelUsed,
      chunks: chunks.map((c) => ({
        sourceFileName: c.sourceFileName,
        index: c.index,
        score: c.score,
        searchType: c.searchType,
        preview: String(c.text || "").slice(0, 300),
      })),
      knowledgeContext: formatKnowledgeContext(chunks),
    });
  } catch (error) {
    console.error("Erro no teste de resposta:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao testar resposta." },
      { status: error?.statusCode || 500 },
    );
  }
}
