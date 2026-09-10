import { NextResponse } from "next/server";
import { getChainInfo, describeSpec } from "@/server/ai/chain";
import { getSettings } from "@/server/settings/getSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista pública dos modelos disponíveis (só nomes — nenhuma credencial).
// Reflete a ordem definida no painel; se não houver, usa a AI_CHAIN do ambiente.
// O usuário pode escolher um como PREFERÊNCIA; o fallback continua ativo.
export async function GET() {
  try {
    const settings = await getSettings().catch(() => ({}));

    let models = [];
    if (Array.isArray(settings.aiChain) && settings.aiChain.length) {
      models = settings.aiChain
        .filter((item) => item && item.enabled !== false && item.spec)
        .map((item) => describeSpec(item.spec))
        .filter((info) => info.available)
        .map((info) => ({ spec: info.spec, provider: info.provider, model: info.model }));
    }

    if (!models.length) {
      models = getChainInfo().map((entry) => ({
        spec: `${entry.provider}:${entry.model}`,
        provider: entry.provider,
        model: entry.model,
      }));
    }

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
