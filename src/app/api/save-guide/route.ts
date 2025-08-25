import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Configuração do projeto virtualguide-teste
const TARGET_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
  authDomain: 'virtualguide-teste.firebaseapp.com',
  projectId: 'virtualguide-teste',
  storageBucket: 'virtualguide-teste.firebasestorage.app',
  messagingSenderId: '101459525297',
  appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
  measurementId: ''
};

// Inicializar Firebase para o projeto virtualguide-teste
const getTargetDb = () => {
  const appName = 'vg-virtualguide-teste-api';
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return getFirestore(existing);
  
  const app = initializeApp(TARGET_FIREBASE_CONFIG, appName);
  return getFirestore(app);
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guideData, userId, userRole, isEditMode } = body as {
      guideData: Record<string, unknown> & { slug: string };
      userId: string;
      userRole: string;
      isEditMode?: boolean;
    };
    
    if (!guideData || !userId || !userRole) {
      return NextResponse.json(
        { error: 'Dados insuficientes para salvar o guia' },
        { status: 400 }
      );
    }

    // Verificar se o utilizador tem permissões (apenas admin ou utilizador autorizado)
    if (userRole !== 'admin' && userRole !== 'user') {
      return NextResponse.json(
        { error: 'Permissões insuficientes para salvar guias' },
        { status: 403 }
      );
    }

    const targetDb = getTargetDb();

    // Preparar dados do guia
    const guideDoc = {
      ...guideData,
      updatedAt: serverTimestamp(),
      ...(isEditMode ? {} : { createdAt: serverTimestamp() })
    };

    // Salvar o guia
    await setDoc(
      doc(targetDb, 'guides', guideData.slug),
      guideDoc,
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: `Guia "${guideData.slug}" ${isEditMode ? 'atualizado' : 'criado'} com sucesso`
    });

  } catch (error: unknown) {
    console.error('Erro ao salvar guia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao salvar guia' },
      { status: 500 }
    );
  }
}
