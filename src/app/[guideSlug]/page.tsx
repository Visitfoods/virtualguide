"use client";

import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import GuideView from './__pp_copy/page';
import { mainDb } from '../../firebase/mainConfig';
import { doc, getDoc, getFirestore, query, collection, getDocs, where } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

type PageProps = { params: Promise<{ guideSlug: string }> };

interface ChatConfig {
  welcomeTitle?: string | null;
  button1Text?: string | null;
  button1Function?: string | null;
  button2Text?: string | null;
  button2Function?: string | null;
  button3Text?: string | null;
  button3Function?: string | null;
  downloadVideoEnabled?: boolean | null;
}

interface HelpPoints {
  point1?: string | null;
  point2?: string | null;
  point3?: string | null;
  point4?: string | null;
  point5?: string | null;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  name: string;
  questions: FaqItem[];
}

interface ContactInfo {
  phoneNumber: string;
  address: string;
  callUsTitle: string;
  callUsDescription: string;
  visitUsTitle: string;
  visitUsDescription: string;
  liveChatTitle: string;
  liveChatDescription: string;
  liveChatButtonText: string;
  mapEmbedUrl: string;
}

interface GuideVideos {
  backgroundVideoURL: string | null;
  welcomeVideoURL: string | null;
  systemPrompt: string | null;
  chatConfig?: ChatConfig | null;
  helpPoints?: HelpPoints | null;
  humanChatEnabled?: boolean | null;
  faq?: FaqCategory[] | null;
  contactInfo?: ContactInfo | null;
  chatIconURL?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
}

interface GuideData {
  name?: string;
  backgroundVideoURL?: string;
  welcomeVideoURL?: string;
  systemPrompt?: string;
  isActive?: boolean;
  chatConfig?: ChatConfig | null;
  helpPoints?: HelpPoints | null;
  humanChatEnabled?: boolean | null;
  faq?: FaqCategory[] | null;
  contactInfo?: ContactInfo | null;
  chatIconURL?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
  metaTitle?: string;
  metaDescription?: string;
  targetProject?: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
}

export default function GuideWrapper({ params }: PageProps) {
  const { guideSlug } = usePromise(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [guideVideos, setGuideVideos] = useState<GuideVideos>({
    backgroundVideoURL: null,
    welcomeVideoURL: null,
    systemPrompt: null,
    chatConfig: null,
    helpPoints: null,
    humanChatEnabled: null,
    faq: null,
    contactInfo: null,
    chatIconURL: null,
    captions: null
  });

  useEffect(() => {
    let aborted = false;
    async function loadPrompt() {
      try {
        console.log('🔍 Loading guide with slug:', guideSlug);
        console.log('📍 Current URL:', window.location.href);
        console.log('📍 Current pathname:', window.location.pathname);
        
        // 1) Para guias conhecidos do virtualguide-teste, sempre usar esse projeto
        let targetDb = mainDb;
        let data: GuideData | null = null;
        
        // Lista de guias que sabemos que estão no virtualguide-teste
        const virtualguideTesteGuides = ['virtualguide', 'portugaldospequenitos', 'seguranca', 'seguranca45', 'seguranca76', 'teste23', 'teste24', 'teste270'];
        
        if (virtualguideTesteGuides.includes(guideSlug)) {
          console.log(`🎯 Guia ${guideSlug} detectado, usando projeto virtualguide-teste diretamente`);
          try {
            const TESTE_FIREBASE_CONFIG = {
              apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
              authDomain: 'virtualguide-teste.firebaseapp.com',
              projectId: 'virtualguide-teste',
              storageBucket: 'virtualguide-teste.firebasestorage.app',
              messagingSenderId: '101459525297',
              appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
              measurementId: ''
            };
            
            const appName = `vg-virtualguide-teste-${guideSlug}`;
            const existing = getApps().find(a => a.name === appName);
            console.log('🔍 Apps Firebase existentes:', getApps().map(a => a.name));
            console.log('🔍 App encontrado:', existing ? existing.name : 'Nenhum');
            
            const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
            console.log(`✅ App Firebase inicializado para ${guideSlug}:`, app.name);
            targetDb = getFirestore(app);
            
            // Buscar diretamente no virtualguide-teste
            const testeRef = doc(targetDb, 'guides', guideSlug);
            console.log(`🔍 Procurando guia ${guideSlug} no documento:`, guideSlug);
            const testeSnap = await getDoc(testeRef);
            if (testeSnap.exists()) {
              data = testeSnap.data() as GuideData;
              console.log(`✅ Guia ${guideSlug} encontrado:`, data?.name);
              console.log('📊 Dados do guia:', {
                backgroundVideoURL: data?.backgroundVideoURL,
                welcomeVideoURL: data?.welcomeVideoURL,
                systemPrompt: data?.systemPrompt?.substring(0, 100) + '...',
                isActive: data?.isActive
              });
            } else {
              console.log(`❌ Guia ${guideSlug} não encontrado no documento`);
              // Tentar buscar por slug
              const q = query(collection(targetDb, 'guides'), where('slug', '==', guideSlug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                data = querySnapshot.docs[0].data() as GuideData;
                console.log(`✅ Guia ${guideSlug} encontrado por slug:`, data?.name);
              } else {
                console.log(`❌ Guia ${guideSlug} não encontrado por slug também`);
              }
            }
          } catch (error) {
            console.error(`Erro ao carregar guia ${guideSlug}:`, error);
          }
        } else {
          // Para outros guias, usar lógica original (projeto principal)
          try {
            const ref = doc(mainDb, 'guides', guideSlug);
            const snap = await getDoc(ref);
            data = snap.exists() ? (snap.data() as GuideData) : null;
            
            if (data && data.targetProject) {
              // Se existir targetProject, usar esse projeto
              const target = data.targetProject;
              const appName = `vg-${target.projectId}`;
              const existing = getApps().find(a => a.name === appName);
              const app = existing || initializeApp({
                apiKey: target.apiKey || '',
                authDomain: target.authDomain || '',
                projectId: target.projectId,
                storageBucket: target.storageBucket || '',
                messagingSenderId: target.messagingSenderId || '',
                appId: target.appId || '',
                ...(target.measurementId ? { measurementId: target.measurementId } : {}),
              }, appName);
              targetDb = getFirestore(app);
            }
          } catch (error) {
            console.log('❌ Guia não encontrado no projeto principal');
          }
        }

        // 2) Para outros guias que não estão na lista, se não encontrou no projeto principal, tentar no virtualguide-teste
        if (!data && !virtualguideTesteGuides.includes(guideSlug)) {
          try {
            console.log('🔄 Tentando carregar do projeto virtualguide-teste...');
            const TESTE_FIREBASE_CONFIG = {
              apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
              authDomain: 'virtualguide-teste.firebaseapp.com',
              projectId: 'virtualguide-teste',
              storageBucket: 'virtualguide-teste.firebasestorage.app',
              messagingSenderId: '101459525297',
              appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
              measurementId: ''
            };
            
            const appName = 'vg-virtualguide-teste-dynamic';
            const existing = getApps().find(a => a.name === appName);
            console.log('🔍 Apps Firebase existentes:', getApps().map(a => a.name));
            console.log('🔍 App encontrado:', existing ? existing.name : 'Nenhum');
            
            const app = existing || initializeApp(TESTE_FIREBASE_CONFIG, appName);
            console.log('✅ App Firebase inicializado:', app.name);
            targetDb = getFirestore(app);
            
            // Verificar se o guia existe no virtualguide-teste
            const testeRef = doc(targetDb, 'guides', guideSlug);
            console.log('🔍 Procurando guia no documento:', guideSlug);
            const testeSnap = await getDoc(testeRef);
            if (testeSnap.exists()) {
              data = testeSnap.data() as GuideData;
              console.log('✅ Guia encontrado no projeto virtualguide-teste:', data?.name);
              console.log('📊 Dados do guia:', {
                backgroundVideoURL: data?.backgroundVideoURL,
                welcomeVideoURL: data?.welcomeVideoURL,
                systemPrompt: data?.systemPrompt?.substring(0, 100) + '...',
                isActive: data?.isActive
              });
            } else {
              console.log('❌ Guia não encontrado no virtualguide-teste');
              console.log('🔍 Tentando buscar por slug...');
              
              // Tentar buscar por slug
              const q = query(collection(targetDb, 'guides'), where('slug', '==', guideSlug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                data = querySnapshot.docs[0].data() as GuideData;
                console.log('✅ Guia encontrado por slug:', data?.name);
              } else {
                console.log('❌ Guia não encontrado por slug também');
              }
            }
          } catch (error) {
            console.error('Erro ao tentar ler do projeto virtualguide-teste:', error);
          }
        }

        // 3) Se não encontrou em nenhum lugar, mostrar 404
        if (!data) {
          console.log('❌ Nenhum dado encontrado para o guia:', guideSlug);
          if (!aborted) {
            setNotFound(true);
          }
          return;
        }

        // 4) Bloquear se o guia estiver inativo
        if (data.isActive === false) {
          console.log('❌ Guia inativo:', guideSlug);
          if (!aborted) {
            setNotFound(true);
          }
          return;
        }
        
        console.log('✅ Guia carregado com sucesso:', data?.name, 'isActive:', data?.isActive);

        // 3) Extrair dados do guia encontrado
        const prompt = data?.systemPrompt || '';
        const videos = {
          backgroundVideoURL: data?.backgroundVideoURL || null,
          welcomeVideoURL: data?.welcomeVideoURL || null
        };
        const chatConfig: ChatConfig | null = data?.chatConfig || null;
        const helpPoints: HelpPoints | null = data?.helpPoints || null;
        const humanChatEnabled: boolean | null = typeof data?.humanChatEnabled === 'boolean' ? data.humanChatEnabled : null;
        const faq: FaqCategory[] | null = data?.faq || null;
        const contactInfo: ContactInfo | null = data?.contactInfo || null;
        const chatIconURL: string | null = data?.chatIconURL || null;
        const captions: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null = data?.captions || null;

        // 3.1) Atualizar título e meta description do documento (SEO)
        try {
          const metaTitle: string = data?.metaTitle || data?.name || 'Guia Virtual';
          const metaDescription: string = data?.metaDescription || 'Guia Virtual';
          if (typeof document !== 'undefined') {
            document.title = metaTitle;
            let descEl: HTMLMetaElement | null = document.querySelector('meta[name="description"]');
            if (!descEl) {
              descEl = document.createElement('meta');
              descEl.setAttribute('name', 'description');
              document.head.appendChild(descEl);
            }
            descEl.setAttribute('content', metaDescription);

            // Open Graph e Twitter dinâmicos
            const ensureTag = (selector: string, attr: 'content' | 'href', value: string) => {
              let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
              if (!el) {
                const isLink = selector.startsWith('link');
                el = document.createElement(isLink ? 'link' : 'meta') as any;
                const attrName = selector.includes('property=') ? 'property' : selector.includes('name=') ? 'name' : 'rel';
                const match = selector.match(/(?:property|name|rel)="([^"]+)"/);
                el.setAttribute(attrName, match?.[1] || '');
                document.head.appendChild(el);
              }
              el.setAttribute(attr, value);
            };

            const pageUrl = window.location.href;
            const imageCandidate = (data?.chatIconURL || 'https://virtualguide.info/favicon.jpg') as string;
            const absoluteImage = imageCandidate.startsWith('http')
              ? imageCandidate
              : `${window.location.origin}${imageCandidate.startsWith('/') ? '' : '/'}${imageCandidate}`;

            ensureTag('meta[property="og:title"]', 'content', metaTitle);
            ensureTag('meta[property="og:description"]', 'content', metaDescription);
            ensureTag('meta[property="og:type"]', 'content', 'website');
            ensureTag('meta[property="og:url"]', 'content', pageUrl);
            ensureTag('meta[property="og:site_name"]', 'content', 'VirtualGuide');
            ensureTag('meta[property="og:image"]', 'content', absoluteImage);

            ensureTag('meta[name="twitter:card"]', 'content', 'summary');
            ensureTag('meta[name="twitter:title"]', 'content', metaTitle);
            ensureTag('meta[name="twitter:description"]', 'content', metaDescription);
            ensureTag('meta[name="twitter:image"]', 'content', absoluteImage);

            ensureTag('link[rel="canonical"]', 'href', pageUrl);
          }
        } catch {
          // Ignorar erros silenciosamente para não bloquear render
        }

        if (!aborted) {
          setGuideVideos({
            backgroundVideoURL: videos.backgroundVideoURL,
            welcomeVideoURL: videos.welcomeVideoURL,
            systemPrompt: prompt,
            chatConfig,
            helpPoints,
            humanChatEnabled,
            faq,
            contactInfo,
            chatIconURL,
            captions
          });
        }
      } catch (e) {
        console.error('Erro ao carregar systemPrompt, vídeos e chat config do guia', e);
        setNotFound(true);
      } finally {
        if (!aborted) setReady(true);
      }
    }
    loadPrompt();
    return () => { aborted = true; };
  }, [guideSlug]);

  // Redirecionar quando não existir o guia
  useEffect(() => {
    if (notFound && ready) {
      router.replace('/404');
    }
  }, [notFound, ready, router]);

  if (!ready) {
    return null;
  }

  if (notFound) {
    return null;
  }

  console.log('📊 Dados passados para GuideView:', {
    backgroundVideoURL: guideVideos.backgroundVideoURL,
    welcomeVideoURL: guideVideos.welcomeVideoURL,
    systemPrompt: guideVideos.systemPrompt?.substring(0, 50) + '...',
    chatConfig: guideVideos.chatConfig,
    helpPoints: guideVideos.helpPoints,
    humanChatEnabled: guideVideos.humanChatEnabled,
    faq: guideVideos.faq ? `${guideVideos.faq.length} categorias` : null,
    contactInfo: guideVideos.contactInfo ? 'Configurado' : null,
    chatIconURL: guideVideos.chatIconURL,
    captions: guideVideos.captions ? 'Configurado' : null
  });
  
  return <GuideView guideVideos={guideVideos} guideSlug={guideSlug} />;
}

