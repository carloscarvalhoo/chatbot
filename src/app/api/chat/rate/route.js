import { NextResponse } from "next/server";
import { saveRating } from "@/server/ratings/saveRating";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await saveRating(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao salvar avaliação." },
      { status: error?.statusCode || 500 },
    );
  }
}
