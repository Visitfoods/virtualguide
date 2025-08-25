import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';

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
  const existing = getApps().find((app) => app.name === appName);
  if (existing) return getFirestore(existing);
  
  const app = initializeApp(TARGET_FIREBASE_CONFIG, appName);
  return getFirestore(app);
};

export async function POST(request: Request) {
  try {
    const { slug, userId, userRole } = await request.json() as {
      slug: string;
      userId: string;
      userRole: string;
    };
    
    if (!slug || !userId || !userRole) {
      return NextResponse.json(
        { error: 'Dados insuficientes para eliminar o guia' },
        { status: 400 }
      );
    }

    // Verificar se o utilizador tem permissões (apenas admin)
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Permissões insuficientes para eliminar guias' },
        { status: 403 }
      );
    }

    const targetDb = getTargetDb();

    // Verificar se o guia existe
    const guideRef = doc(targetDb, 'guides', slug);
    await deleteDoc(guideRef);

    return NextResponse.json({
      success: true,
      message: `Guia "${slug}" eliminado com sucesso`
    });

  } catch (error) {
    console.error('Erro ao eliminar guia:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor ao eliminar guia' },
      { status: 500 }
    );
  }
}