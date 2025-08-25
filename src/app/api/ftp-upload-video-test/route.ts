import { NextResponse } from 'next/server';
import { uploadBufferToAmen } from '@/lib/amenFtp';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutos para vídeos maiores

export async function GET() {
	try {
		// Caminho para o ficheiro de vídeo
		const videoPath = 'C:/Users/joao/Desktop/big-buck-bunny_trailer-.webm';
		
		// Verificar se o ficheiro existe
		if (!fs.existsSync(videoPath)) {
			return NextResponse.json({
				success: false,
				error: 'Ficheiro não encontrado',
				message: 'O ficheiro de vídeo não foi encontrado no caminho especificado.'
			}, { status: 404 });
		}
		
		// Ler o ficheiro de vídeo
		console.log('Lendo ficheiro de vídeo:', videoPath);
		const fileBuffer = fs.readFileSync(videoPath);
		console.log('Ficheiro lido com sucesso. Tamanho:', fileBuffer.length, 'bytes');
		
		// Nome do guia e ficheiro para teste
		const testGuide = 'teste-video';
		const fileName = `big-buck-bunny_${Date.now()}.webm`;
		const remotePath = `guides/${testGuide}/${fileName}`;
		
		console.log('Iniciando upload de vídeo para:', remotePath);
		
		// Fazer upload do ficheiro
		console.log(`Iniciando upload do vídeo (${fileBuffer.length} bytes)...`);
		const url = await uploadBufferToAmen(remotePath, fileBuffer);
		console.log('Upload concluído com sucesso! URL:', url);
		
		return NextResponse.json({
			success: true,
			message: 'Upload de vídeo concluído com sucesso!',
			path: remotePath,
			url: url,
			fileSize: fileBuffer.length
		});
	} catch (error) {
		console.error('Erro no teste de upload de vídeo:', error);
		return NextResponse.json({
			success: false,
			error: error instanceof Error ? error.message : 'Erro desconhecido',
			message: 'Falha no upload de vídeo. Verifique as configurações.'
		}, { status: 500 });
	}
}
