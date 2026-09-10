import { getChainInfo, createProviderFromSpec } from "@/server/ai/chain";
import { withTimeout } from "@/server/ai/retry";
import { classifyProviderError } from "@/server/ai/errors";
import { formatKnowledgeContext, searchKnowledgeChunks } from "@/server/knowledge/searchKnowledge";
import { getSystemPrompt } from "@/server/ai/prompts";
import { getSettings } from "@/server/settings/getSettings";

const COMPARE_TIMEOUT_MS = Number(process.env.AI_COMPARE_TIMEOUT_MS) || 30000;

/**
 * Roda a MESMA pergunta (mesmo contexto RAG, mesmo system prompt) em vários
 * modelos e devolve as respostas lado a lado, com latência e status.
 *
 * @param {{ message: string, specs?: string[] }} params
 */
export async function compareModels({ message, specs }) {
  const question = String(message || "").trim();
  if (!question) {
    throw Object.assign(new Error("Digite uma pergunta para comparar."), { statusCode: 400 });
  }

  // Se nada for pedido, compara a cadeia configurada inteira.
  const targetSpecs =
    Array.isArray(specs) && specs.length
      ? specs
      : getChainInfo().map((entry) => `${entry.provider}:${entry.model}`);

  const [settings, chunks] = await Promise.all([
    getSettings(),
    searchKnowledgeChunks(question, { topK: 6 }),
  ]);

  const knowledgeContext = formatKnowledgeContext(chunks);
  const systemPrompt = getSystemPrompt(
    null,
    knowledgeContext,
    settings.institutionName,
    settings.botName,
  );

  const results = await Promise.all(
    targetSpecs.map(async (spec) => {
      const startedAt = Date.now();
      try {
        const provider = createProviderFromSpec(spec);
        const { text } = await withTimeout(
          provider.sendChat({ systemPrompt, history: [], message: question }),
          COMPARE_TIMEOUT_MS,
          spec,
        );
        return {
          spec,
          provider: provider.id,
          model: provider.model,
          ok: true,
          latencyMs: Date.now() - startedAt,
          text,
        };
      } catch (error) {
        return {
          spec,
          ok: false,
          latencyMs: Date.now() - startedAt,
          errorKind: classifyProviderError(error),
          error: error?.message || "Falha desconhecida.",
        };
      }
    }),
  );

  return {
    question,
    knowledgeChunks: chunks.map((chunk) => ({
      sourceFileName: chunk.sourceFileName,
      index: chunk.index,
      score: chunk.score,
      searchType: chunk.searchType,
      preview: String(chunk.text || "").slice(0, 300),
    })),
    results,
  };
}
