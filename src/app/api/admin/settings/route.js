import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { getSettings } from "@/server/settings/getSettings";
import { saveSettings } from "@/server/settings/saveSettings";
import { getEnvChainSpecs, describeSpec } from "@/server/ai/chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const settings = await getSettings();

    // Catálogo pro painel: specs que existem no ambiente + estado de cada provedor.
    const envSpecs = getEnvChainSpecs().map(describeSpec);
    const savedSpecs = Array.isArray(settings.aiChain)
      ? settings.aiChain.map((item) => describeSpec(item.spec))
      : [];
    const providers = {};
    for (const info of [...envSpecs, ...savedSpecs]) {
      providers[info.provider] = providers[info.provider] || info.available;
    }

    return NextResponse.json({
      ...settings,
      _aiChainCatalog: {
        envSpecs,
        providers: Object.entries(providers).map(([id, available]) => ({ id, available })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao buscar configurações." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const result = await saveSettings(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar configurações." },
      { status: error?.statusCode || 500 },
    );
  }
}
