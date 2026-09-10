import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/server/auth/checkAdminAccess";
import { deleteKnowledgeFile } from "@/server/knowledge/deleteKnowledgeFile";
import { listKnowledgeFiles } from "@/server/knowledge/listKnowledgeFiles";
import { saveKnowledgeFile } from "@/server/knowledge/saveKnowledgeFile";
import { reprocessKnowledgeFile } from "@/server/knowledge/reprocessKnowledgeFile";
import { markFileReviewed, setFileValidity } from "@/server/knowledge/knowledgeMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handleRouteError(error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return NextResponse.json(
    { error: error?.message || fallbackMessage },
    { status: error?.statusCode || 500 },
  );
}

export async function GET() {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const files = await listKnowledgeFiles();

    return NextResponse.json({ files });
  } catch (error) {
    return handleRouteError(error, "Erro ao listar arquivos.");
  }
}

export async function POST(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    const result = await saveKnowledgeFile(file);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Erro ao processar PDF.");
  }
}

export async function PATCH(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, action } = body || {};

    if (!id) {
      return NextResponse.json({ error: "ID não informado." }, { status: 400 });
    }

    if (action === "reprocess") {
      const result = await reprocessKnowledgeFile(id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "review") {
      await markFileReviewed(id);
      return NextResponse.json({ success: true });
    }

    if (action === "setValidity") {
      await setFileValidity(id, {
        sourceDate: body.sourceDate,
        expiresAt: body.expiresAt,
        reviewIntervalMonths: body.reviewIntervalMonths,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return handleRouteError(error, "Erro ao atualizar documento.");
  }
}

export async function DELETE(request) {
  const authError = await checkAdminAccess();
  if (authError) return authError;

  try {
    const body = await request.json();
    const result = await deleteKnowledgeFile(body?.id);

    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Erro ao remover arquivo.");
  }
}
