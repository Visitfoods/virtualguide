import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { mainDb } from '../../firebase/mainConfig';
import { getFirestore, doc, getDoc, query, collection, getDocs, where } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { guideSlug: string } }): Promise<Metadata> {
  const guideSlug = params.guideSlug;

  // Defaults
  let title = 'VirtualGuide - Guia Virtual Inteligente';
  let description = 'Sistema de guia virtual inteligente com IA';
  let image: string | undefined = undefined;
  const baseUrl = 'https://virtualguide.info';

  const virtualguideTesteGuides = ['virtualguide', 'portugaldospequenitos', 'seguranca', 'seguranca45', 'seguranca76', 'teste23', 'teste24', 'teste270'];

  try {
    // 1) Selecionar DB inicial
    let db = mainDb;

    // 2) Se o slug está na lista especial, ler diretamente do projeto de teste
    if (virtualguideTesteGuides.includes(guideSlug)) {
      const TESTE_FIREBASE_CONFIG = {
        apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
        authDomain: 'virtualguide-teste.firebaseapp.com',
        projectId: 'virtualguide-teste',
        storageBucket: 'virtualguide-teste.firebasestorage.app',
        messagingSenderId: '101459525297',
        appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
        measurementId: ''
      } as const;
      const appName = `vg-virtualguide-teste-${guideSlug}`;
      const existing = getApps().find(a => a.name === appName);
      const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
      db = getFirestore(app);
    }

    // 3) Tentar ler doc por ID
    let data: any | null = null;
    try {
      const ref = doc(db, 'guides', guideSlug);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        data = snap.data();
      }
    } catch {}

    // 4) Se ainda não temos dados e NÃO é um slug da lista, tentar fallback no projeto de teste
    if (!data && !virtualguideTesteGuides.includes(guideSlug)) {
      try {
        const TESTE_FIREBASE_CONFIG = {
          apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
          authDomain: 'virtualguide-teste.firebaseapp.com',
          projectId: 'virtualguide-teste',
          storageBucket: 'virtualguide-teste.firebasestorage.app',
          messagingSenderId: '101459525297',
          appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
          measurementId: ''
        } as const;
        const appName = 'vg-virtualguide-teste-dynamic';
        const existing = getApps().find(a => a.name === appName);
        const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
        const testeDb = getFirestore(app);

        let snap = await getDoc(doc(testeDb, 'guides', guideSlug));
        if (snap.exists()) {
          data = snap.data();
        } else {
          const q = query(collection(testeDb, 'guides'), where('slug', '==', guideSlug));
          const qs = await getDocs(q);
          if (!qs.empty) {
            data = qs.docs[0].data();
          }
        }
      } catch {}
    }

    if (data) {
      title = data?.metaTitle || data?.name || title;
      description = data?.metaDescription || description;
      image = data?.chatIconURL || undefined;
    }
  } catch {
    // Ignorar e ficar com defaults
  }

  const absoluteImage = image
    ? (image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${baseUrl}/favicon.jpg`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/${guideSlug}`,
      siteName: 'VirtualGuide',
      images: [absoluteImage],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [absoluteImage],
    },
    alternates: {
      canonical: `${baseUrl}/${guideSlug}`,
    },
  };
}

export default function GuideSegmentLayout({ children }: { children: ReactNode }) {
  return children as any;
}


