import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Hosts permitidos para evitar uso abusivo do proxy
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

    // Obter o ficheiro remoto
    const upstream = await fetch(target.toString(), { cache: 'no-store' });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Falha ao obter vídeo', status: upstream.status, body: text.slice(0, 200) }), { status: 502 });
    }

    // Preparar headers para forçar download
    const headers = new Headers();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    headers.set('Cache-Control', 'no-store');
    headers.set('Access-Control-Allow-Origin', '*');

    // Gerar um nome de ficheiro
    const fileNameFromUrl = decodeURIComponent(target.pathname.split('/').pop() || 'video.mp4');
    headers.set('Content-Disposition', `attachment; filename="${fileNameFromUrl}"`);

    return new Response(upstream.body, { status: 200, headers });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Erro no download de vídeo', message: error?.message }), { status: 500 });
  }
}


