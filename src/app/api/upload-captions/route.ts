import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const guideSlug = (formData.get('guideSlug') || formData.get('slug')) as string | null;
		const captionType = (formData.get('captionType') || formData.get('variant')) as 'desktop' | 'tablet' | 'mobile' | null;

		if (!file || !guideSlug || !captionType) {
			return NextResponse.json(
				{ error: 'Ficheiro, slug e variante são obrigatórios' },
				{ status: 400 }
			);
		}

		if (!file.name.endsWith('.vtt')) {
			return NextResponse.json(
				{ error: 'Apenas ficheiros .vtt são permitidos' },
				{ status: 400 }
			);
		}

		const timestamp = Date.now();
		const fileName = `captions_${captionType}_${timestamp}.vtt`;
		const remotePath = `guides/${guideSlug}/${fileName}`;
		const buffer = Buffer.from(await file.arrayBuffer());
		const publicUrl = await uploadBufferToAmen(remotePath, buffer);
		return NextResponse.json({ success: true, stored: true, path: publicUrl, fileName, message: 'Legendas guardadas no servidor (FTP) com sucesso' });
	} catch (error) {
		console.error('Erro ao fazer upload de legendas:', error);
		return NextResponse.json(
			{ error: 'Erro interno do servidor ao fazer upload de legendas' },
			{ status: 500 }
		);
	}
}