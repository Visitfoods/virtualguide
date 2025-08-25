import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_HOSTS = new Set(['visitfoods.pt', 'www.visitfoods.pt']);

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get('url');
    if (!urlParam) {
      return new Response(JSON.stringify({ error: 'Parâmetro url é obrigatório' }), { status: 400 });
    }

    const target = new URL(urlParam);
    if (!ALLOWED_HOSTS.has(target.hostname)) {
      return new Response(JSON.stringify({ error: 'Host não permitido' }), { status: 400 });
    }

    // Propagar Range para suportar streaming
    const range = req.headers.get('range') ?? undefined;

    const upstream = await fetch(target.toString(), {
      headers: range ? { Range: range } : undefined,
      // Evita problemas de cache/proxy intermédio
      cache: 'no-store',
    });

    if (!upstream.ok && upstream.status !== 206) {
      const text = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Falha ao obter vídeo', status: upstream.status, body: text.slice(0, 200) }), { status: 502 });
    }

    // Copiar headers importantes
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    const contentRange = upstream.headers.get('content-range');

    headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    if (acceptRanges) headers.set('Accept-Ranges', acceptRanges);
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400');
    headers.set('Access-Control-Allow-Origin', '*');

    const status = upstream.status; // 200 ou 206

    return new Response(upstream.body, { status, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Erro no proxy de vídeo', message: error?.message }), { status: 500 });
  }
}
