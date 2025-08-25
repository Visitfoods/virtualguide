export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
	try {
		if (!process.env.BLOB_READ_WRITE_TOKEN) {
			return new Response(JSON.stringify({ error: 'BLOB_READ_WRITE_TOKEN não configurado' }), {
				status: 500,
				headers: { 'content-type': 'application/json' },
			});
		}

		const { createUploadToken } = await import('@vercel/blob');

		const { token } = await createUploadToken({
			allowedContentTypes: ['video/*', 'image/*', 'text/vtt', 'application/octet-stream'],
			maximumSizeInBytes: 1024 * 1024 * 1024,
		});

		return new Response(JSON.stringify({ token }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Erro desconhecido';
		return new Response(JSON.stringify({ error: 'Erro ao gerar token', message }), {
			status: 500,
			headers: { 'content-type': 'application/json' },
		});
	}
}
