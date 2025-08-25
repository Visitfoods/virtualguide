import { NextRequest } from "next/server";
import { ask } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { q, opts } = await req.json();
    // sanitizar/limitar histórico para evitar payloads gigantes
    const cleanOpts = { ...opts } as typeof opts & { history?: Array<{ role: string; content: string }> };
    if (Array.isArray(cleanOpts?.history)) {
      const MAX_ITEMS = 10;
      const MAX_CHARS = 1200;
      cleanOpts.history = cleanOpts.history.slice(-MAX_ITEMS).map((m: any) => ({
        role: m.role,
        content: String(m.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS),
      }));
    }
    const r = await ask(String(q || ""), cleanOpts);
    // incluir responseId quando disponível no futuro (SDK streaming); por agora devolvemos o texto e modelo
    return Response.json(r);
  } catch (err) {
    console.error("/api/ask error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}


