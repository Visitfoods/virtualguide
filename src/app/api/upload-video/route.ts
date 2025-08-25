import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const guideSlug = (formData.get('guideSlug') || formData.get('slug')) as string | null;
		const fileType = (formData.get('fileType') || formData.get('type')) as 'background' | 'welcome' | null;

		if (!file || !guideSlug || !fileType) {
			return NextResponse.json(
				{ error: 'Ficheiro, slug e tipo são obrigatórios' },
				{ status: 400 }
			);
		}

		if (!file.type.startsWith('video/')) {
			return NextResponse.json(
				{ error: 'Apenas vídeos são permitidos' },
				{ status: 400 }
			);
		}

		const timestamp = Date.now();
		const safeName = (file.name || 'video').replace(/[^a-zA-Z0-9._-]/g, '_');
		const fileName = `${fileType}_${timestamp}_${safeName}`;
		const remotePath = `guides/${guideSlug}/${fileName}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		const publicUrl = await uploadBufferToAmen(remotePath, buffer);
		return NextResponse.json({ success: true, stored: true, path: publicUrl, fileName, message: 'Vídeo guardado no servidor (FTP) com sucesso' });
	} catch (error) {
		console.error('Erro ao fazer upload de vídeo:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de vídeo' },
			{ status: 500 }
		);
	}
}