import { NextResponse } from 'next/server';
import { deleteFileFromFtp } from '@/lib/amenFtp';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { guideSlug, fileName } = await request.json();

    if (!guideSlug || !fileName) {
      return NextResponse.json(
        { error: 'guideSlug e fileName são obrigatórios' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Apagando ficheiro: ${fileName} do guia: ${guideSlug}`);

    // Caminho completo para o ficheiro
    const filePath = `guides/${guideSlug}/${fileName}`;
    
    // Apagar o ficheiro específico
    const deleted = await deleteFileFromFtp(filePath);
    
    if (deleted) {
      console.log(`✅ Ficheiro apagado com sucesso: ${filePath}`);
      return NextResponse.json({
        success: true,
        message: `Ficheiro apagado com sucesso: ${fileName}`,
        path: filePath
      });
    } else {
      console.log(`⚠️ Não foi possível apagar o ficheiro: ${filePath}`);
      return NextResponse.json({
        success: false,
        message: `Não foi possível apagar o ficheiro: ${fileName}`,
        path: filePath
      });
    }

  } catch (error) {
    console.error('Erro ao apagar ficheiro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao apagar ficheiro' },
      { status: 500 }
    );
  }
}
