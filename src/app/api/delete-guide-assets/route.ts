import { NextResponse } from 'next/server';
import { deleteDirectoryRecursive } from '@/lib/amenFtp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug é obrigatório' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Iniciando limpeza de assets para guia: ${slug}`);

    // Caminho para a pasta do guia
    const guidePath = `guides/${slug}`;
    
    // Apagar a pasta do guia e todo o seu conteúdo
    const deleted = await deleteDirectoryRecursive(guidePath);
    
    if (deleted) {
      console.log(`✅ Pasta do guia apagada com sucesso: ${guidePath}`);
      return NextResponse.json({
        success: true,
        message: `Pasta do guia apagada com sucesso: ${guidePath}`,
        path: guidePath
      });
    } else {
      console.log(`⚠️ Não foi possível apagar a pasta do guia: ${guidePath}`);
      return NextResponse.json({
        success: false,
        message: `Não foi possível apagar a pasta do guia: ${guidePath}`,
        path: guidePath
      });
    }

  } catch (error) {
    console.error('Erro ao limpar assets:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao limpar assets' },
      { status: 500 }
    );
  }
}