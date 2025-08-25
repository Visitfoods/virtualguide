import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const guideSlug = (formData.get('guideSlug') || formData.get('slug')) as string | null;
		const fileType = (formData.get('fileType') || formData.get('type')) as string | null;

		if (!file || !guideSlug) {
			return NextResponse.json(
				{ error: 'Ficheiro e slug são obrigatórios' },
				{ status: 400 }
			);
		}

		if (!file.type.startsWith('image/')) {
			return NextResponse.json(
				{ error: 'Apenas imagens são permitidas' },
				{ status: 400 }
			);
		}

		const timestamp = Date.now();
		const safeName = (file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
		const fileName = `${fileType || 'chatIcon'}_${timestamp}_${safeName}`;
		const remotePath = `guides/${guideSlug}/${fileName}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		const publicUrl = await uploadBufferToAmen(remotePath, buffer);
		return NextResponse.json({ success: true, stored: true, path: publicUrl, fileName, message: 'Imagem guardada no servidor (FTP) com sucesso' });
	} catch (error) {
		console.error('Erro ao fazer upload de imagem:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de imagem' },
			{ status: 500 }
		);
	}
}