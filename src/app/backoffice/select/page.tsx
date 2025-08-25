'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../backoffice.module.css';
import Link from 'next/link';
import BackofficeAuthGuard from '../../../components/BackofficeAuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy, deleteDoc, getDoc } from 'firebase/firestore';
// Removido: import { mainDb } from '../../../firebase/mainConfig';
import { uploadVideo, UploadProgress } from '../../../utils/videoUpload';
import { copyImageToPublic } from '../../../utils/imageUpload';
import { copyCaptionsToPublic } from '../../../utils/captionsUpload';

export default function SelectDataSource() {
  const router = useRouter();
  const { user, logout } = useAuth();
  // Configuração fixa do Firebase de destino
  const FIXED_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
    authDomain: 'virtualguide-teste.firebaseapp.com',
    projectId: 'virtualguide-teste',
    storageBucket: 'virtualguide-teste.firebasestorage.app',
    messagingSenderId: '101459525297',
    appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
    measurementId: ''
  } as const;

  // Inicializar Firebase para o projeto virtualguide-teste
  const targetApp = (() => {
    const appName = 'vg-virtualguide-teste';
    const existing = getApps().find(a => a.name === appName);
    if (existing) return existing;
    return initializeApp(FIXED_FIREBASE_CONFIG, appName);
  })();
  
  const targetDb = getFirestore(targetApp);
  

  const [showCreateGuideModal, setShowCreateGuideModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingGuide, setEditingGuide] = useState<{ slug: string; targetProject?: { projectId?: string; apiKey?: string; authDomain?: string; storageBucket?: string; messagingSenderId?: string; appId?: string; measurementId?: string | null } | null } | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [guides, setGuides] = useState<Array<{
    id: string;
    slug: string;
    name: string;
    company?: string;
    isActive?: boolean;
    targetProject?: { projectId?: string; apiKey?: string; authDomain?: string; storageBucket?: string; messagingSenderId?: string; appId?: string; measurementId?: string | null } | null;
  }>>([]);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingGuideId, setDeletingGuideId] = useState<string | null>(null);
  const [togglingGuideId, setTogglingGuideId] = useState<string | null>(null);
  const [backgroundVideoFile, setBackgroundVideoFile] = useState<File | null>(null);
  const [welcomeVideoFile, setWelcomeVideoFile] = useState<File | null>(null);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState<number>(0);
  const [welcomeUploadProgress, setWelcomeUploadProgress] = useState<number>(0);
  const [chatIconFile, setChatIconFile] = useState<File | null>(null);
  const [chatIconUploadProgress, setChatIconUploadProgress] = useState<number>(0);
  const [existingAssets, setExistingAssets] = useState<{ background?: string | null; welcome?: string | null; chatIcon?: string | null; captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null }>({});
  const [contactsEnabled, setContactsEnabled] = useState<boolean>(true);
  const [captionsDesktopFile, setCaptionsDesktopFile] = useState<File | null>(null);
  const [captionsTabletFile, setCaptionsTabletFile] = useState<File | null>(null);
  const [captionsMobileFile, setCaptionsMobileFile] = useState<File | null>(null);
  const [captionsUploadProgress, setCaptionsUploadProgress] = useState<{ desktop: number; tablet: number; mobile: number }>({ desktop: 0, tablet: 0, mobile: 0 });
  const [guideData, setGuideData] = useState({
    name: '',
    slug: '',
    company: '',
    metaTitle: '',
    metaDescription: ''
  });
  const [chatConfig, setChatConfig] = useState({
    welcomeTitle: 'BEM-VINDO AO GUIA VIRTUAL',
    button1Text: 'O que visitar',
    button1Function: 'O que visitar no parque?',
    button2Text: 'O que comer',
    button2Function: 'O que comer no parque?',
    button3Text: 'Download vídeo',
    button3Function: 'Como posso fazer download de vídeos?',
    downloadVideoEnabled: false
  });
  const [humanChatEnabled, setHumanChatEnabled] = useState<boolean>(true);
  const [helpPoints, setHelpPoints] = useState({
    point1: 'O que visitar ?',
    point2: 'O que comer ?',
    point3: 'Horários e bilhetes',
    point4: 'Como chegar',
    point5: 'Acessibilidade'
  });
  const [faqData, setFaqData] = useState([
    {
      name: "Sobre o Parque",
      questions: [
        {
          question: "O que é este parque?",
          answer: "Este é um parque temático que oferece uma experiência única de aprendizagem e diversão para toda a família."
        },
        {
          question: "Quando foi fundado?",
          answer: "O parque foi fundado para proporcionar momentos inesquecíveis aos visitantes de todas as idades."
        },
        {
          question: "Qual é a missão?",
          answer: "A missão é educar e divertir, criando experiências memoráveis para todos os visitantes."
        }
      ]
    },
    {
      name: "Horários & Bilhetes",
      questions: [
        {
          question: "Quais são os horários?",
          answer: "O parque está aberto todos os dias, com horários que variam consoante a época do ano."
        },
        {
          question: "Como comprar bilhetes?",
          answer: "Pode comprar bilhetes na bilheteira do parque ou online no site oficial."
        },
        {
          question: "Quanto custa a entrada?",
          answer: "Os preços variam consoante a idade e existem descontos para grupos e famílias."
        }
      ]
    },
    {
      name: "Como Chegar",
      questions: [
        {
          question: "Onde fica localizado?",
          answer: "O parque está situado numa localização central e acessível."
        },
        {
          question: "Como chegar de carro?",
          answer: "Existe estacionamento gratuito nas proximidades do parque."
        },
        {
          question: "Como chegar de transportes?",
          answer: "Pode chegar de comboio, autocarro ou táxi até ao parque."
        }
      ]
    },
    {
      name: "Monumentos & Atrações",
      questions: [
        {
          question: "Que atrações existem?",
          answer: "O parque oferece diversas atrações educativas e divertidas para todas as idades."
        },
        {
          question: "Há atividades para crianças?",
          answer: "Sim! Existem várias atividades educativas e workshops para crianças."
        },
        {
          question: "Quanto tempo demora a visita?",
          answer: "Uma visita completa demora aproximadamente 2 a 3 horas."
        }
      ]
    },
    {
      name: "Serviços & Instalações",
      questions: [
        {
          question: "Há restaurantes no parque?",
          answer: "Sim, o parque dispõe de cafetaria e restaurante com refeições tradicionais."
        },
        {
          question: "O parque tem loja?",
          answer: "Sim, existe uma loja oficial com lembranças e artigos relacionados."
        },
        {
          question: "O parque é acessível?",
          answer: "Sim, o parque está preparado para receber visitantes com mobilidade reduzida."
        }
      ]
    },
    {
      name: "Informações Úteis",
      questions: [
        {
          question: "Posso levar comida?",
          answer: "Sim, pode levar a sua própria comida e existem áreas de piquenique disponíveis."
        },
        {
          question: "O parque está aberto todo o ano?",
          answer: "Sim, o parque está aberto todos os dias do ano, incluindo feriados."
        },
        {
          question: "Posso tirar fotografias?",
          answer: "Sim, é permitido tirar fotografias para uso pessoal."
        }
      ]
    }
  ]);
  const [contactInfo, setContactInfo] = useState({
    phoneNumber: '+351 239 801 170',
    address: 'Largo Rossio de Santa Clara, 3040-256 Coimbra, Portugal',
    callUsTitle: 'Ligue-nos',
    callUsDescription: 'Entre em contacto connosco para esclarecer dúvidas ou solicitar informações sobre os nossos produtos e serviços.',
    visitUsTitle: 'Visite-nos',
    visitUsDescription: 'Visite o nosso parque e descubra mais sobre Portugal.',
    liveChatTitle: 'Chat ao Vivo',
    liveChatDescription: 'Fale com o nosso guia virtual em tempo real.',
    liveChatButtonText: 'FALE COM O GUIA VIRTUAL',
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3048.1234567890!2d-8.4194!3d40.2033!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd23f8b5e5b5b5b5%3A0x5b5b5b5b5b5b5b5b!2sLargo%20Rossio%20de%20Santa%20Clara%2C%20Coimbra!5e0!3m2!1spt-PT!2spt!4v1234567890',
    email: ''
  });
  // Removido: firebaseConfig state - usando sempre FIXED_FIREBASE_CONFIG

  useEffect(() => {
    // Verificação de autenticação agora feita pelo BackofficeAuthGuard
    // Esta verificação é redundante e pode ser removida
  }, []);

  // Abrir modal automaticamente se vier com ?create=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') {
      handleCreateGuide();
    }
  }, []);

  // Listagem de guias do projeto virtualguide-teste
  useEffect(() => {
    // Verificação de role agora feita pelo BackofficeAuthGuard
    // Esta verificação é redundante

    // Usar o projeto virtualguide-teste em vez do mainDb
    const q = query(collection(targetDb, 'guides'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const items = snapshot.docs.map((d: any) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          slug: data.slug || d.id,
          name: data.name || '(sem nome)',
          company: data.company || '',
          isActive: data.isActive ?? true,
          targetProject: data.targetProject || null,
        };
      });
      setGuides(items);
    });

    return () => unsubscribe();
  }, []);

  // Removido: seleção de origem de dados (Portugal dos Pequenitos / Página Principal)

  const handleCreateGuide = () => {
    setIsEditMode(false);
    setEditingGuide(null);
    setShowCreateGuideModal(true);
    setCurrentStep(1);
    setGuideData({ name: '', slug: '', company: '', metaTitle: '', metaDescription: '' });
    setSystemPrompt('');
    setBackgroundVideoFile(null);
    setWelcomeVideoFile(null);
    setBackgroundUploadProgress(0);
    setWelcomeUploadProgress(0);
    setChatIconFile(null);
    setChatIconUploadProgress(0);
    setCaptionsDesktopFile(null);
    setCaptionsTabletFile(null);
    setCaptionsMobileFile(null);
    setCaptionsUploadProgress({ desktop: 0, tablet: 0, mobile: 0 });
    setExistingAssets({});
            setChatConfig({
          welcomeTitle: 'BEM-VINDO AO GUIA VIRTUAL',
          button1Text: 'O que visitar',
          button1Function: 'O que visitar no parque?',
          button2Text: 'O que comer',
          button2Function: 'O que comer no parque?',
          button3Text: 'Download vídeo',
          button3Function: 'Como posso fazer download de vídeos?',
          downloadVideoEnabled: false
        });
    setHumanChatEnabled(true);
    setHelpPoints({
      point1: 'O que visitar ?',
      point2: 'O que comer ?',
      point3: 'Horários e bilhetes',
      point4: 'Como chegar',
      point5: 'Acessibilidade'
    });
    setFaqData([
      {
        name: "Sobre o Parque",
        questions: [
          {
            question: "O que é este parque?",
            answer: "Este é um parque temático que oferece uma experiência única de aprendizagem e diversão para toda a família."
          },
          {
            question: "Quando foi fundado?",
            answer: "O parque foi fundado para proporcionar momentos inesquecíveis aos visitantes de todas as idades."
          },
          {
            question: "Qual é a missão?",
            answer: "A missão é educar e divertir, criando experiências memoráveis para todos os visitantes."
          }
        ]
      },
      {
        name: "Horários & Bilhetes",
        questions: [
          {
            question: "Quais são os horários?",
            answer: "O parque está aberto todos os dias, com horários que variam consoante a época do ano."
          },
          {
            question: "Como comprar bilhetes?",
            answer: "Pode comprar bilhetes na bilheteira do parque ou online no site oficial."
          },
          {
            question: "Quanto custa a entrada?",
            answer: "Os preços variam consoante a idade e existem descontos para grupos e famílias."
          }
        ]
      },
      {
        name: "Como Chegar",
        questions: [
          {
            question: "Onde fica localizado?",
            answer: "O parque está situado numa localização central e acessível."
          },
          {
            question: "Como chegar de carro?",
            answer: "Existe estacionamento gratuito nas proximidades do parque."
          },
          {
            question: "Como chegar de transportes?",
            answer: "Pode chegar de comboio, autocarro ou táxi até ao parque."
          }
        ]
      },
      {
        name: "Monumentos & Atrações",
        questions: [
          {
            question: "Que atrações existem?",
            answer: "O parque oferece diversas atrações educativas e divertidas para todas as idades."
          },
          {
            question: "Há atividades para crianças?",
            answer: "Sim! Existem várias atividades educativas e workshops para crianças."
          },
          {
            question: "Quanto tempo demora a visita?",
            answer: "Uma visita completa demora aproximadamente 2 a 3 horas."
          }
        ]
      },
      {
        name: "Serviços & Instalações",
        questions: [
          {
            question: "Há restaurantes no parque?",
            answer: "Sim, o parque dispõe de cafetaria e restaurante com refeições tradicionais."
          },
          {
            question: "O parque tem loja?",
            answer: "Sim, existe uma loja oficial com lembranças e artigos relacionados."
          },
          {
            question: "O parque é acessível?",
            answer: "Sim, o parque está preparado para receber visitantes com mobilidade reduzida."
          }
        ]
      },
      {
        name: "Informações Úteis",
        questions: [
          {
            question: "Posso levar comida?",
            answer: "Sim, pode levar a sua própria comida e existem áreas de piquenique disponíveis."
          },
          {
            question: "O parque está aberto todo o ano?",
            answer: "Sim, o parque está aberto todos os dias do ano, incluindo feriados."
          },
          {
            question: "Posso tirar fotografias?",
            answer: "Sim, é permitido tirar fotografias para uso pessoal."
          }
        ]
      }
    ]);
    setContactInfo({
      phoneNumber: '+351 239 801 170',
      address: 'Largo Rossio de Santa Clara, 3040-256 Coimbra, Portugal',
      callUsTitle: 'Ligue-nos',
      callUsDescription: 'Entre em contacto connosco para esclarecer dúvidas ou solicitar informações sobre os nossos produtos e serviços.',
      visitUsTitle: 'Visite-nos',
      visitUsDescription: 'Visite o nosso parque e descubra mais sobre Portugal.',
      liveChatTitle: 'Chat ao Vivo',
      liveChatDescription: 'Fale com o nosso guia virtual em tempo real.',
      liveChatButtonText: 'FALE COM O GUIA VIRTUAL',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3048.1234567890!2d-8.4194!3d40.2033!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd23f8b5e5b5b5b5%3A0x5b5b5b5b5b5b5b5b!2sLargo%20Rossio%20de%20Santa%20Clara%2C%20Coimbra!5e0!3m2!1spt-PT!2spt!4v1234567890',
      email: ''
    });
    setContactsEnabled(true);
    // Removido: setFirebaseConfig - usando sempre FIXED_FIREBASE_CONFIG
  };

  // Abrir modal em modo edição e carregar dados do guia
  const handleEditGuide = async (guide: { slug: string; targetProject?: any | null }) => {
    try {
      setIsEditMode(true);
      setEditingGuide({ slug: guide.slug, targetProject: guide.targetProject || null });
      setShowCreateGuideModal(true);
      setCurrentStep(2); // Ir diretamente ao formulário principal
      setCreating(false);

      // Usar sempre o projeto virtualguide-teste
      const db = targetDb;

      // Ler documento do guia
      const snap = await getDoc(doc(targetDb, 'guides', guide.slug));
      if (!snap.exists()) {
        alert('Não foi possível carregar os dados do guia para edição.');
        return;
      }
      const data = snap.data() as any;

      // Preencher estados com dados existentes
      setGuideData({
        name: data?.name || '',
        slug: data?.slug || guide.slug,
        company: data?.company || '',
        metaTitle: data?.metaTitle || '',
        metaDescription: data?.metaDescription || ''
      });
      setSystemPrompt(data?.systemPrompt || '');
              setChatConfig({
          welcomeTitle: data?.chatConfig?.welcomeTitle || 'BEM-VINDO AO GUIA VIRTUAL',
          button1Text: data?.chatConfig?.button1Text || '',
          button1Function: data?.chatConfig?.button1Function || '',
          button2Text: data?.chatConfig?.button2Text || '',
          button2Function: data?.chatConfig?.button2Function || '',
          button3Text: data?.chatConfig?.button3Text || '',
          button3Function: data?.chatConfig?.button3Function || '',
          downloadVideoEnabled: data?.chatConfig?.downloadVideoEnabled || false
        });
      setHumanChatEnabled(!!data?.humanChatEnabled);
      setHelpPoints({
        point1: data?.helpPoints?.point1 || '',
        point2: data?.helpPoints?.point2 || '',
        point3: data?.helpPoints?.point3 || '',
        point4: data?.helpPoints?.point4 || '',
        point5: data?.helpPoints?.point5 || ''
      });
      setFaqData(Array.isArray(data?.faq) ? data.faq : []);
      const ci = data?.contactInfo || {};
      setContactsEnabled(!!ci?.enabled);
      setContactInfo({
        phoneNumber: ci?.phoneNumber || '',
        address: ci?.address || '',
        callUsTitle: ci?.callUsTitle || 'Ligue-nos',
        callUsDescription: ci?.callUsDescription || 'Entre em contacto connosco para esclarecer dúvidas ou solicitar informações sobre os nossos produtos e serviços.',
        visitUsTitle: ci?.visitUsTitle || 'Visite-nos',
        visitUsDescription: ci?.visitUsDescription || 'Visite o nosso parque e descubra mais sobre Portugal.',
        liveChatTitle: ci?.liveChatTitle || 'Chat ao Vivo',
        liveChatDescription: ci?.liveChatDescription || 'Fale com o nosso guia virtual em tempo real.',
        liveChatButtonText: ci?.liveChatButtonText || 'FALE COM O GUIA VIRTUAL',
        mapEmbedUrl: ci?.mapEmbedUrl || '',
        email: ci?.email || ''
      });
      setExistingAssets({
        background: data?.backgroundVideoURL || null,
        welcome: data?.welcomeVideoURL || null,
        chatIcon: data?.chatIconURL || null,
        captions: data?.captions || null
      });
    } catch (err) {
      console.error('Erro ao carregar guia para edição:', err);
      alert('Erro ao preparar edição do guia.');
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      // Passo 2: Informações do Guia
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isEditMode) {
        // Validar slug único antes de avançar (apenas na criação)
        const exists = await slugExists(guideData.slug);
        if (exists) {
          alert(`Já existe um guia com o link "/${guideData.slug}". Escolha outro nome de link.`);
          return;
        }
      }
      // Passo 3: System Prompt
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Passo 4: Upload de Vídeos
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Passo 5: Ícone do Chat
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // Passo 6: Configuração do Chat
      setCurrentStep(6);
    } else if (currentStep === 6) {
      // Passo 7: Pontos de Ajuda
      setCurrentStep(7);
    } else if (currentStep === 7) {
      // Passo 8: Configuração das FAQs
      setCurrentStep(8);
    } else if (currentStep === 8) {
      // Passo 9: Configuração de Contactos
      setCurrentStep(9);
    } else if (currentStep === 9) {
      if (isEditMode) {
        await handleSaveGuideEdits();
      } else {
        handleCreateGuideSubmit();
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 5) {
      setCurrentStep(4);
    } else if (currentStep === 6) {
      setCurrentStep(5);
    } else if (currentStep === 7) {
      setCurrentStep(6);
    } else if (currentStep === 8) {
      setCurrentStep(7);
    } else if (currentStep === 9) {
      setCurrentStep(8);
    }
  };

  // Função para extrair o nome do ficheiro de um URL
  const extractFileNameFromUrl = (url: string | null): string | null => {
    if (!url) return null;
    try {
      const path = url.split('/').pop();
      return path || null;
    } catch {
      return null;
    }
  };

  // Função para apagar ficheiros antigos específicos
  const deleteOldFiles = async (oldUrls: (string | null)[], guideSlug: string) => {
    const filesToDelete = oldUrls
      .map(url => extractFileNameFromUrl(url))
      .filter((fileName): fileName is string => fileName !== null);

    if (filesToDelete.length === 0) return;

    try {
      console.log('🗑️ Apagando ficheiros antigos:', filesToDelete);
      
      // Apagar cada ficheiro individualmente
      for (const fileName of filesToDelete) {
        try {
          const response = await fetch('/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              guideSlug, 
              fileName 
            })
          });
          
          if (response.ok) {
            console.log(`✅ Ficheiro apagado: ${fileName}`);
          } else {
            console.warn(`⚠️ Falha ao apagar ficheiro: ${fileName}`);
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao apagar ficheiro ${fileName}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro geral ao apagar ficheiros antigos:', error);
    }
  };

  // Guardar alterações em modo edição
  const handleSaveGuideEdits = async () => {
    if (!editingGuide?.slug) return;
    try {
      setCreating(true);
      // Usar sempre o projeto virtualguide-teste
      const db = targetDb;

      // Guardar URLs antigos para limpeza posterior
      const oldBackgroundURL = existingAssets.background ?? null;
      const oldWelcomeURL = existingAssets.welcome ?? null;
      const oldChatIconURL = existingAssets.chatIcon ?? null;
      const oldCaptionsDesktopURL = existingAssets.captions?.desktop ?? null;
      const oldCaptionsTabletURL = existingAssets.captions?.tablet ?? null;
      const oldCaptionsMobileURL = existingAssets.captions?.mobile ?? null;

      // Fazer upload de novos ficheiros, mantendo os existentes quando não houver novos
      let finalBackgroundURL = existingAssets.background ?? null;
      let finalWelcomeURL = existingAssets.welcome ?? null;
      let finalChatIconURL = existingAssets.chatIcon ?? null;
      let finalCaptionsDesktopURL = existingAssets.captions?.desktop ?? null;
      let finalCaptionsTabletURL = existingAssets.captions?.tablet ?? null;
      let finalCaptionsMobileURL = existingAssets.captions?.mobile ?? null;

      if (backgroundVideoFile) {
        const backgroundResult = await uploadVideo(backgroundVideoFile, guideData.slug.trim(), 'background', 
          (progress: UploadProgress) => {
            setBackgroundUploadProgress(progress.percentage);
          });
        finalBackgroundURL = backgroundResult.path;
      }
      if (welcomeVideoFile) {
        const welcomeResult = await uploadVideo(welcomeVideoFile, guideData.slug.trim(), 'welcome',
          (progress: UploadProgress) => {
            setWelcomeUploadProgress(progress.percentage);
          });
        finalWelcomeURL = welcomeResult.path;
      }
      if (chatIconFile) {
        setChatIconUploadProgress(50);
        finalChatIconURL = await copyImageToPublic(chatIconFile, guideData.slug.trim(), 'chatIcon');
        setChatIconUploadProgress(100);
      }
      if (captionsDesktopFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, desktop: 50 }));
        finalCaptionsDesktopURL = await copyCaptionsToPublic(captionsDesktopFile, guideData.slug.trim(), 'desktop');
        setCaptionsUploadProgress(prev => ({ ...prev, desktop: 100 }));
      }
      if (captionsTabletFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, tablet: 50 }));
        finalCaptionsTabletURL = await copyCaptionsToPublic(captionsTabletFile, guideData.slug.trim(), 'tablet');
        setCaptionsUploadProgress(prev => ({ ...prev, tablet: 100 }));
      }
      if (captionsMobileFile) {
        setCaptionsUploadProgress(prev => ({ ...prev, mobile: 50 }));
        finalCaptionsMobileURL = await copyCaptionsToPublic(captionsMobileFile, guideData.slug.trim(), 'mobile');
        setCaptionsUploadProgress(prev => ({ ...prev, mobile: 100 }));
      }

      const updatePayload: any = {
        name: guideData.name.trim(),
        // slug não é alterado em edição para simplificar
        company: guideData.company.trim(),
        metaTitle: (guideData as any).metaTitle?.trim?.() || '',
        metaDescription: (guideData as any).metaDescription?.trim?.() || '',
        systemPrompt: systemPrompt.trim(),
        chatConfig: {
          welcomeTitle: chatConfig.welcomeTitle.trim(),
          button1Text: chatConfig.button1Text.trim(),
          button1Function: chatConfig.button1Function.trim(),
          button2Text: chatConfig.button2Text.trim(),
          button2Function: chatConfig.button2Function.trim(),
          button3Text: chatConfig.button3Text.trim(),
          button3Function: chatConfig.button3Function.trim(),
          downloadVideoEnabled: chatConfig.downloadVideoEnabled
        },
        chatIconURL: finalChatIconURL,
        backgroundVideoURL: finalBackgroundURL,
        welcomeVideoURL: finalWelcomeURL,
        captions: { desktop: finalCaptionsDesktopURL, tablet: finalCaptionsTabletURL, mobile: finalCaptionsMobileURL },
        helpPoints: {
          point1: helpPoints.point1.trim(),
          point2: helpPoints.point2.trim(),
          point3: helpPoints.point3.trim(),
          point4: helpPoints.point4.trim(),
          point5: helpPoints.point5.trim()
        },
        humanChatEnabled: !!humanChatEnabled,
        faq: faqData.map(category => ({
          name: category.name,
          questions: category.questions.map(q => ({ question: q.question, answer: q.answer }))
        })),
        contactInfo: {
          enabled: contactsEnabled,
          phoneNumber: contactInfo.phoneNumber,
          address: contactInfo.address,
          callUsTitle: contactInfo.callUsTitle,
          callUsDescription: contactInfo.callUsDescription,
          visitUsTitle: contactInfo.visitUsTitle,
          visitUsDescription: contactInfo.visitUsDescription,
          liveChatTitle: contactInfo.liveChatTitle,
          liveChatDescription: contactInfo.liveChatDescription,
          liveChatButtonText: contactInfo.liveChatButtonText,
          mapEmbedUrl: contactInfo.mapEmbedUrl,
          email: contactInfo.email
        },
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'guides', editingGuide.slug), updatePayload, { merge: true });

      alert('Alterações guardadas com sucesso!');
      setShowCreateGuideModal(false);
      setIsEditMode(false);
      setEditingGuide(null);

      // Limpar os campos de upload
      setBackgroundVideoFile(null);
      setWelcomeVideoFile(null);
      setChatIconFile(null);
      setCaptionsDesktopFile(null);
      setCaptionsTabletFile(null);
      setCaptionsMobileFile(null);
      setCaptionsUploadProgress({ desktop: 0, tablet: 0, mobile: 0 });

      // Apagar ficheiros antigos APENAS se foram substituídos nesta edição
      const filesToMaybeDelete: (string | null)[] = [];
      if (backgroundVideoFile && oldBackgroundURL && oldBackgroundURL !== finalBackgroundURL) {
        filesToMaybeDelete.push(oldBackgroundURL);
      }
      if (welcomeVideoFile && oldWelcomeURL && oldWelcomeURL !== finalWelcomeURL) {
        filesToMaybeDelete.push(oldWelcomeURL);
      }
      if (chatIconFile && oldChatIconURL && oldChatIconURL !== finalChatIconURL) {
        filesToMaybeDelete.push(oldChatIconURL);
      }
      if (captionsDesktopFile && oldCaptionsDesktopURL && oldCaptionsDesktopURL !== finalCaptionsDesktopURL) {
        filesToMaybeDelete.push(oldCaptionsDesktopURL);
      }
      if (captionsTabletFile && oldCaptionsTabletURL && oldCaptionsTabletURL !== finalCaptionsTabletURL) {
        filesToMaybeDelete.push(oldCaptionsTabletURL);
      }
      if (captionsMobileFile && oldCaptionsMobileURL && oldCaptionsMobileURL !== finalCaptionsMobileURL) {
        filesToMaybeDelete.push(oldCaptionsMobileURL);
      }

      if (filesToMaybeDelete.length > 0) {
        deleteOldFiles(filesToMaybeDelete, guideData.slug);
      }
    } catch (error) {
      console.error('Erro ao guardar alterações do guia:', error);
      alert('Falha ao guardar alterações do guia.');
    } finally {
      setCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setGuideData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Removido: handleFirebaseChange - usando sempre FIXED_FIREBASE_CONFIG

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Verificar se já existe um guia com este slug (apenas no projeto virtualguide-teste)
  const slugExists = async (slug: string): Promise<boolean> => {
    const clean = slug.trim();
    if (!clean) return false;
    try {
      // Verificar apenas no projeto virtualguide-teste
      const targetDoc = await getDoc(doc(targetDb, 'guides', clean));
      return targetDoc.exists();
    } catch (err) {
      console.error('Erro ao verificar duplicação de slug:', err);
      // Em caso de erro, bloquear criação por segurança
      return true;
    }
  };

  const handleNameChange = (value: string) => {
    setGuideData(prev => ({
      ...prev,
      name: value,
      slug: generateSlug(value)
    }));
  };

  const handleCreateGuideSubmit = async () => {
    if (creating) return;
    try {
      setCreating(true);
      console.log('[CreateGuide] Iniciado');
      // Verificação final anti-duplicação
      const exists = await slugExists(guideData.slug);
      if (exists) {
        alert(`Não é possível criar. O link "/${guideData.slug}" já existe.`);
        setCreating(false);
        return;
      }
      // Usar sempre o projeto virtualguide-teste
      const db = targetDb;

      // Guardar o guia na coleção 'guides' (doc id = slug)
      const guideId = (globalThis as any).crypto?.randomUUID?.() ? (globalThis as any).crypto.randomUUID() : `guide_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      // Fazer upload dos vídeos se fornecidos
      let uploadedBackgroundURL: string | null = null;
      let uploadedWelcomeURL: string | null = null;
      let uploadedChatIconURL: string | null = null;
      let uploadedCaptionsDesktopURL: string | null = null;
      let uploadedCaptionsTabletURL: string | null = null;
      let uploadedCaptionsMobileURL: string | null = null;

      // Processar vídeo principal
      const toStreamUrl = (url: string) => {
        // Guardar sempre o URL "real" (sem proxy). O proxy será aplicado no frontoffice se necessário.
        try {
          const u = new URL(url);
          // Se o utilizador colar já uma URL proxied, extraímos o valor do parâmetro `file` para persistir o alvo real
          if (u.pathname.includes('/vg-video/') && u.searchParams.get('file')) {
            const file = u.searchParams.get('file') as string;
            // Reconstruir URL absoluto para visitfoods caso `file` seja um caminho absoluto
            if (file.startsWith('/')) return `https://visitfoods.pt${file}`;
            return file;
          }
        } catch {}
        return url;
      };

      if (backgroundVideoFile) {
        try {
          const backgroundResult = await uploadVideo(backgroundVideoFile, guideData.slug.trim(), 'background',
            (progress: UploadProgress) => {
              setBackgroundUploadProgress(progress.percentage);
            });
          const relativePath = backgroundResult.path;
          // Guardar exatamente o URL devolvido pelo upload (sem proxy)
          uploadedBackgroundURL = toStreamUrl(relativePath);
          console.log(`Vídeo principal copiado para: ${relativePath}`);
        } catch (error) {
          console.error('Erro ao processar vídeo principal:', error);
          alert('Erro ao processar vídeo principal. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar vídeo de boas‑vindas
      if (welcomeVideoFile) {
        try {
          const welcomeResult = await uploadVideo(welcomeVideoFile, guideData.slug.trim(), 'welcome',
            (progress: UploadProgress) => {
              setWelcomeUploadProgress(progress.percentage);
            });
          const relativePath = welcomeResult.path;
          // Guardar exatamente o URL devolvido pelo upload (sem proxy)
          uploadedWelcomeURL = toStreamUrl(relativePath);
          console.log(`Vídeo de boas‑vindas copiado para: ${relativePath}`);
        } catch (error) {
          console.error('Erro ao processar vídeo de boas‑vindas:', error);
          alert('Erro ao processar vídeo de boas‑vindas. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar ícone do chat
      if (chatIconFile) {
        try {
          setChatIconUploadProgress(50);
          const relativePath = await copyImageToPublic(chatIconFile, guideData.slug.trim(), 'chatIcon');
          uploadedChatIconURL = relativePath;
          setChatIconUploadProgress(100);
          console.log(`Ícone do chat copiado para: ${relativePath}`);
        } catch (error) {
          console.error('Erro ao processar ícone do chat:', error);
          alert('Erro ao processar a imagem do ícone do chat. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      // Processar legendas (.vtt) - opcionais
      if (captionsDesktopFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, desktop: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsDesktopFile, guideData.slug.trim(), 'desktop');
          uploadedCaptionsDesktopURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, desktop: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas desktop:', error);
          alert('Erro ao processar legendas desktop. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      if (captionsTabletFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, tablet: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsTabletFile, guideData.slug.trim(), 'tablet');
          uploadedCaptionsTabletURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, tablet: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas tablet:', error);
          alert('Erro ao processar legendas tablet. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      if (captionsMobileFile) {
        try {
          setCaptionsUploadProgress(prev => ({ ...prev, mobile: 50 }));
          const relativePath = await copyCaptionsToPublic(captionsMobileFile, guideData.slug.trim(), 'mobile');
          uploadedCaptionsMobileURL = relativePath;
          setCaptionsUploadProgress(prev => ({ ...prev, mobile: 100 }));
        } catch (error) {
          console.error('Erro ao processar legendas mobile:', error);
          alert('Erro ao processar legendas mobile. Tente novamente.');
          setCreating(false);
          return;
        }
      }

      const guideDoc = {
        id: guideId,
        name: guideData.name.trim(),
        slug: guideData.slug.trim(),
        company: guideData.company.trim(),
        metaTitle: guideData.metaTitle.trim(),
        metaDescription: guideData.metaDescription.trim(),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        backgroundVideoURL: uploadedBackgroundURL,
        welcomeVideoURL: uploadedWelcomeURL,
        captions: {
          desktop: uploadedCaptionsDesktopURL,
          tablet: uploadedCaptionsTabletURL,
          mobile: uploadedCaptionsMobileURL,
        },
        // Prompt do sistema específico deste guia (apenas na BD de destino)
        systemPrompt: systemPrompt.trim(),
        // Configuração do chat
        chatConfig: {
          welcomeTitle: chatConfig.welcomeTitle.trim(),
          button1Text: chatConfig.button1Text.trim(),
          button1Function: chatConfig.button1Function.trim(),
          button2Text: chatConfig.button2Text.trim(),
          button2Function: chatConfig.button2Function.trim(),
          button3Text: chatConfig.button3Text.trim(),
          button3Function: chatConfig.button3Function.trim(),
          downloadVideoEnabled: chatConfig.downloadVideoEnabled
        },
        // Ícone do chat (avatar do guia real)
        chatIconURL: uploadedChatIconURL,
        // Pontos de ajuda que aparecem abaixo de "Como posso ajudar hoje?"
        helpPoints: {
          point1: helpPoints.point1.trim(),
          point2: helpPoints.point2.trim(),
          point3: helpPoints.point3.trim(),
          point4: helpPoints.point4.trim(),
          point5: helpPoints.point5.trim()
        },
        // Flag para ativar/desativar chat com guia real
        humanChatEnabled: !!humanChatEnabled,
        // FAQs
        faq: faqData.map(category => ({
          name: category.name,
          questions: category.questions.map(q => ({ question: q.question, answer: q.answer }))
        })),
        // Informações de Contacto
        contactInfo: {
          enabled: contactsEnabled,
          phoneNumber: contactInfo.phoneNumber,
          address: contactInfo.address,
          callUsTitle: contactInfo.callUsTitle,
          callUsDescription: contactInfo.callUsDescription,
          visitUsTitle: contactInfo.visitUsTitle,
          visitUsDescription: contactInfo.visitUsDescription,
          liveChatTitle: contactInfo.liveChatTitle,
          liveChatDescription: contactInfo.liveChatDescription,
          liveChatButtonText: contactInfo.liveChatButtonText,
          mapEmbedUrl: contactInfo.mapEmbedUrl,
          email: contactInfo.email
        }
      };

      await setDoc(doc(db, 'guides', guideDoc.slug), guideDoc);

      console.log('Guia criado em', FIXED_FIREBASE_CONFIG.projectId, '-> guides/', guideDoc.slug);

      // Guardar o guia completo no projeto virtualguide-teste (coleção 'guides')
      // Usar o guideDoc completo em vez de criar um novo documento reduzido
      await setDoc(doc(targetDb, 'guides', guideDoc.slug), guideDoc);
      console.log('Guia registado também no projeto virtualguide-teste -> guides/', guideDoc.slug);
      
      // Simular criação bem-sucedida
      alert('Guia criado com sucesso!');
      setShowCreateGuideModal(false);
      setCurrentStep(1);
      setCreating(false);
      
      // Redirecionar para a página de teste
      window.open(`http://localhost:3000/${guideData.slug}`, '_blank');
    } catch (error) {
      console.error('Erro ao criar guia:', error);
      alert('Erro ao criar guia. Verifique a consola para detalhes.');
      setCreating(false);
    }
  };

  // Apagar guia (projeto principal + projeto de destino, se existir)
  const handleDeleteGuide = async (guide: { slug: string; targetProject?: any | null }) => {
    if (!guide?.slug) return;
    
    // Verificar se o utilizador está autenticado
    if (!user || !user.id) {
      alert('Erro: Utilizador não autenticado. Faça login novamente.');
      return;
    }
    
    const confirmed = window.confirm(`Tem a certeza que pretende apagar o guia "${guide.slug}"? Esta ação é irreversível.`);
    if (!confirmed) return;
    
    try {
      setDeletingGuideId(guide.slug);
      console.log('🔍 Iniciando processo de eliminação do guia:', guide.slug);
      console.log('👤 Utilizador autenticado:', user.id, user.role);
      console.log('🗄️ Database target:', targetDb);

      // Nota: A autenticação é verificada no projeto principal (virtualguide-83bc3)
      // Não precisamos de verificar autenticação no projeto virtualguide-teste
      console.log('🔐 Autenticação verificada no projeto principal, prosseguindo...');

      // 1) Remover do projeto virtualguide-teste via API
      console.log('📝 Removendo do projeto virtualguide-teste via API...');
      try {
        const response = await fetch('/api/delete-guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: guide.slug,
            userId: user.id,
            userRole: user.role
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Guia removido do projeto virtualguide-teste:', result.message);
      } catch (error) {
        console.error('❌ Erro ao remover do projeto virtualguide-teste:', error);
        throw new Error(`Falha ao remover do projeto virtualguide-teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }

      // 3) Remover também os ficheiros locais em /public/guides/<slug>
      console.log('📁 Removendo assets locais...');
      try {
        const response = await fetch('/api/delete-guide-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: guide.slug })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Assets locais removidos:', result);
      } catch (err) {
        console.error('⚠️ Aviso: falha ao remover assets locais do guia:', err);
        // Não interromper o processo se falhar nos assets locais
      }

      console.log('🎉 Guia apagado com sucesso!');
      alert('Guia apagado com sucesso. Os ficheiros associados foram removidos.');
      
      // Recarregar a lista de guias
      // window.location.reload();
      
    } catch (error) {
      console.error('❌ Erro ao apagar guia:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`Falha ao apagar o guia: ${errorMessage}\n\nVerifique a consola para mais detalhes.`);
    } finally {
      setDeletingGuideId(null);
    }
  };

  // Ativar/Desativar guia (apenas no projeto virtualguide-teste)
  const handleToggleGuideActive = async (
    guide: { slug: string; targetProject?: any | null },
    newActive: boolean
  ) => {
    if (!guide?.slug) return;
    try {
      setTogglingGuideId(guide.slug);
      
      // Atualizar via API
      const response = await fetch('/api/toggle-guide-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: guide.slug,
          newActive,
          userId: user?.id || '',
          userRole: user?.role || 'user'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ ${result.message}`);
      
    } catch (error) {
      console.error('Erro ao atualizar estado do guia:', error);
      alert('Falha ao atualizar estado do guia.');
    } finally {
      setTogglingGuideId(null);
    }
  };

  const isFirebaseValid = () => {
    return (
      FIXED_FIREBASE_CONFIG.apiKey.trim() !== '' &&
      FIXED_FIREBASE_CONFIG.authDomain.trim() !== '' &&
      FIXED_FIREBASE_CONFIG.projectId.trim() !== '' &&
      FIXED_FIREBASE_CONFIG.storageBucket.trim() !== '' &&
      FIXED_FIREBASE_CONFIG.messagingSenderId.trim() !== '' &&
      FIXED_FIREBASE_CONFIG.appId.trim() !== ''
    );
  };

  const isGuideFormValid = () => {
    return guideData.name.trim() !== '' && guideData.slug.trim() !== '';
  };

  // Funções para gerir as FAQs
  const addFaqCategory = () => {
    setFaqData(prev => [...prev, {
      name: "Nova Categoria",
      questions: [
        {
          question: "Nova Pergunta",
          answer: "Nova Resposta"
        }
      ]
    }]);
  };

  const removeFaqCategory = (categoryIndex: number) => {
    setFaqData(prev => prev.filter((_, index) => index !== categoryIndex));
  };

  const updateFaqCategoryName = (categoryIndex: number, newName: string) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex ? { ...category, name: newName } : category
    ));
  };

  const addFaqQuestion = (categoryIndex: number) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { ...category, questions: [...category.questions, { question: "Nova Pergunta", answer: "Nova Resposta" }] }
        : category
    ));
  };

  const removeFaqQuestion = (categoryIndex: number, questionIndex: number) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { ...category, questions: category.questions.filter((_, qIndex) => qIndex !== questionIndex) }
        : category
    ));
  };

  const updateFaqQuestion = (categoryIndex: number, questionIndex: number, field: 'question' | 'answer', value: string) => {
    setFaqData(prev => prev.map((category, index) => 
      index === categoryIndex 
        ? { 
            ...category, 
            questions: category.questions.map((q, qIndex) => 
              qIndex === questionIndex 
                ? { ...q, [field]: value }
                : q
            )
          }
        : category
    ));
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');

  const filteredGuides = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = guides.filter((g) => {
      const name = (g.name || '').toLowerCase();
      const slug = (g.slug || '').toLowerCase();
      const company = (g.company || '').toLowerCase();
      return !q || name.includes(q) || slug.includes(q) || company.includes(q);
    });
    const getTime = (x: any) => (x && (x.toMillis?.() ?? (x.seconds ? x.seconds * 1000 : Date.parse(x)))) || 0;
    list.sort((a, b) => {
      if (sortMode === 'az' || sortMode === 'za') {
        const an = (a.name || a.slug || '').toLowerCase();
        const bn = (b.name || b.slug || '').toLowerCase();
        return sortMode === 'az' ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      const ta = getTime((a as any).createdAt);
      const tb = getTime((b as any).createdAt);
      return sortMode === 'newest' ? tb - ta : ta - tb;
    });
    return list;
  }, [guides, searchQuery, sortMode]);

  return (
    <BackofficeAuthGuard requiredRole="admin">
      <div className={styles.backofficeHome}>
        {/* Top nav reutilizada */}
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
            <Link href="/backoffice" className={styles.navLink}>Administração</Link>
            <Link href="/backoffice/select" className={styles.navLink}>Guias</Link>
            <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
            <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
            <button 
              className={styles.navLink}
              onClick={() => router.push('/backoffice/users?create=1')}
              style={{ 
                background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              Adicionar Utilizador
            </button>
            <button 
              className={styles.navLink}
              onClick={handleCreateGuide}
              style={{ 
                background: 'linear-gradient(135deg, #4ecdc4, #45b7aa)',
                border: 'none',
                cursor: 'pointer',
                color: 'white',
                fontWeight: '600'
              }}
            >
              Adicionar Guias
            </button>
            <div className={styles.userInfo}>
              <span className={styles.userIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                </svg>
              </span>
              <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
            </div>
            <button 
              className={styles.logoutButton}
              onClick={() => {
                logout().then(() => {
                  router.push('/backoffice/login');
                });
              }}
            >
              <span className={styles.logoutIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </span>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </nav>
      <div className={styles.mainContent}>
        <div className={styles.selectToolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L20.71,20L19.29,21.41L13,15.14C11.86,16.1 10.38,16.69 8.77,16.69A6.5,6.5 0 0,1 2.27,10.19A6.5,6.5 0 0,1 8.77,3.69M8.77,5.19A5,5 0 0,0 3.77,10.19A5,5 0 0,0 8.77,15.19A5,5 0 0,0 13.77,10.19A5,5 0 0,0 8.77,5.19Z"/>
              </svg>
              <input
                type="text"
                placeholder="Procurar guia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
          <div className={styles.toolbarRight}>
            <select
              className={styles.sortSelect}
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
            >
              <option value="newest">Mais recente</option>
              <option value="oldest">Mais antigo</option>
              <option value="az">A → Z</option>
              <option value="za">Z → A</option>
            </select>
            <button className={styles.newGuideButton} onClick={handleCreateGuide}>+ Criar Guia</button>
          </div>
        </div>

        <div style={{ width: '90%', margin: '0 auto', marginTop: 24 }}>
          {filteredGuides.length === 0 ? (
            <div style={{ padding: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 12, textAlign: 'center', color: '#fff' }}>
              Nenhum guia encontrado.
            </div>
          ) : (
            <div className={styles.guidesGrid}>
              {filteredGuides.map((g) => (
                  <div key={g.id} className={styles.guideCard}>
                     <div className={styles.cardHeader}>
                      <div className={styles.statusIndicator}>
                        <span className={`${styles.statusDot} ${g.isActive ? styles.active : styles.inactive}`}></span>
                      </div>
                       <div style={{ marginLeft: 'auto' }}>
                         <button
                           onClick={() => handleEditGuide(g)}
                           title="Definições do guia"
                           style={{
                             background: 'transparent',
                             border: 'none',
                             color: '#fff',
                             cursor: 'pointer',
                             padding: 6,
                             borderRadius: 6
                           }}
                         >
                           <svg width="18" height="18" viewBox="0 0 649.61 649.63" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                             <path fill="#fff" d="m233.15,648.7c-25.21-7.14-49.5-17.21-72.37-30-8.33-4.72-13.27-13.77-12.73-23.33l4.4-68.9c.09-1.44-.45-2.85-1.47-3.87l-23.57-23.6c-.94-.93-2.21-1.44-3.53-1.43h-.33l-69.17,4.3h-1.57c-9.05,0-17.38-4.9-21.8-12.8-12.8-22.92-22.87-47.27-30-72.53-2.56-9.25.36-19.16,7.53-25.53l51.97-45.87c1.07-.96,1.68-2.33,1.67-3.77v-33.03c0-1.44-.6-2.81-1.67-3.77l-52.07-45.87c-7.18-6.37-10.11-16.28-7.53-25.53,7.14-25.27,17.21-49.63,30-72.57,4.43-7.87,12.77-12.74,21.8-12.73h1.57l69.17,4.3h.33c1.32-.01,2.59-.54,3.53-1.47l23.33-23.33c1.01-1.02,1.53-2.43,1.43-3.87l-4.23-69.1c-.55-9.57,4.39-18.62,12.73-23.33,22.94-12.79,47.29-22.86,72.57-30,9.25-2.6,19.17.33,25.53,7.53l45.87,51.83c.96,1.07,2.33,1.67,3.77,1.67h32.93c1.44.02,2.81-.59,3.77-1.67l45.9-51.97c6.36-7.2,16.28-10.13,25.53-7.53,25.27,7.13,49.61,17.2,72.53,30,8.37,4.7,13.32,13.75,12.77,23.33l-4.3,69.17c-.1,1.43.43,2.84,1.43,3.87l23.33,23.33c.96.93,2.23,1.46,3.57,1.47h.3l69.17-4.3h1.4c9.03,0,17.36,4.87,21.8,12.73,12.8,22.93,22.87,47.29,30,72.57,2.58,9.25-.34,19.16-7.53,25.53l-51.73,45.93c-1.08.96-1.69,2.33-1.7,3.77v32.93c0,1.44.62,2.81,1.7,3.77l51.97,45.87c7.19,6.37,10.11,16.28,7.53,25.53-7.12,25.27-17.19,49.62-30,72.53-4.42,7.89-12.75,12.79-21.8,12.8h-1.57l-69.17-4.3h-.33c-1.32-.01-2.59.5-3.53,1.43l-23.33,23.33c-1,1.03-1.52,2.43-1.43,3.87l4.3,69.17c.63,9.6-4.35,18.69-12.77,23.33-22.86,12.81-47.15,22.88-72.37,30-9.26,2.65-19.22-.28-25.57-7.53l-45.7-51.9c-.95-1.09-2.32-1.71-3.77-1.7h-33.33c-1.44,0-2.81.62-3.77,1.7l-45.87,52c-6.36,7.2-16.28,10.13-25.53,7.53h0Zm-70.4-185.13l23.6,23.57c11.19,11.18,17.02,26.65,16,42.43l-3.33,52.73c10.68,5.24,21.68,9.8,32.93,13.63l35.17-39.8c10.45-11.83,25.48-18.6,41.27-18.6h33.33c15.8,0,30.83,6.8,41.27,18.67l34.97,39.7c11.27-3.85,22.28-8.42,32.97-13.67l-3.33-53c-.97-15.76,4.87-31.17,16.03-42.33l23.33-23.33c10.35-10.27,24.32-16.05,38.9-16.1h3.33l53,3.33c5.28-10.74,9.87-21.81,13.73-33.13l-39.8-35.17c-11.83-10.45-18.6-25.48-18.6-41.27v-32.9c0-15.79,6.77-30.81,18.6-41.27l39.8-35.17c-3.85-11.33-8.44-22.4-13.73-33.13l-53,3.33h-3.33c-14.62.04-28.65-5.77-38.97-16.13l-23.33-23.33c-11.16-11.15-17-26.55-16.03-42.3l3.33-53c-10.75-5.26-21.82-9.86-33.13-13.77l-35.17,40c-10.45,11.83-25.48,18.6-41.27,18.6h-32.97c-15.79,0-30.81-6.77-41.27-18.6l-35.13-39.9c-11.32,3.91-22.38,8.51-33.13,13.77l3.33,53c.97,15.75-4.87,31.15-16.03,42.3l-23.33,23.33c-10.3,10.37-24.32,16.18-38.93,16.13h-3.33l-53-3.33c-5.26,10.75-9.86,21.82-13.77,33.13l40,35.17c11.72,10.47,18.4,25.45,18.37,41.17v32.93c0,15.79-6.77,30.81-18.6,41.27l-40,35.17c3.9,11.32,8.5,22.38,13.77,33.13l53-3.33h3.33c14.68-.13,28.8,5.66,39.17,16.07Zm3.53-138.93c0-87.45,70.89-158.33,158.33-158.33s158.33,70.89,158.33,158.33-70.89,158.33-158.33,158.33c-87.4-.11-158.22-70.93-158.33-158.33h0Zm50,0c0,59.83,48.5,108.33,108.33,108.33s108.33-48.5,108.33-108.33-48.5-108.33-108.33-108.33c-59.8.07-108.26,48.53-108.33,108.33h0Z"/>
                           </svg>
                         </button>
                       </div>
                    </div>
                    <div className={styles.guideInfo}>
                      <h3 className={styles.guideName}>{g.company || g.name}</h3>
                      <p className={styles.guideType}>Guia Virtual</p>
                    </div>
                    <div className={styles.guideDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Slug:</span>
                        <span className={styles.detailValue}>{g.slug}</span>
                      </div>
                      {g.targetProject?.projectId && (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Projeto:</span>
                          <span className={styles.detailValue}>{g.targetProject.projectId}</span>
                        </div>
                      )}
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Status:</span>
                        <span className={`${styles.detailValue} ${g.isActive ? styles.statusActive : styles.statusInactive}`}>
                          {g.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                    <button
                      className={styles.viewDetailsButton}
                      onClick={() => window.open(`/${g.slug}`, '_blank')}
                    >
                      ABRIR GUIA
                    </button>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        className={g.isActive ? styles.deleteAllButton : styles.filterButton}
                        onClick={() => handleToggleGuideActive(g, !g.isActive)}
                        disabled={togglingGuideId === g.slug}
                      >
                        {togglingGuideId === g.slug
                          ? (g.isActive ? 'A desativar...' : 'A ativar...')
                          : (g.isActive ? 'Desativar' : 'Ativar')}
                      </button>
                      <button
                        className={styles.deleteAllButton}
                        onClick={() => handleDeleteGuide(g)}
                        disabled={deletingGuideId === g.slug}
                      >
                        {deletingGuideId === g.slug ? 'A apagar...' : 'Apagar'}
                      </button>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal para criar novo guia virtual */}
      {showCreateGuideModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
               <h2>{isEditMode ? `Editar Guia Virtual — ${editingGuide?.slug || ''}` : 'Criar Novo Guia Virtual'}</h2>
              <button 
                className={styles.closeModalButton}
                onClick={() => setShowCreateGuideModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              {creating && (
                <div style={{
                  background: '#f6f8fa',
                  border: '1px solid #d0d7de',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>A criar guia…</div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57606a' }}>
                      <span>Upload vídeo principal</span>
                      <span>{backgroundUploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${backgroundUploadProgress}%`, height: '100%', background: '#1f6feb', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#57606a' }}>
                      <span>Upload vídeo de boas‑vindas</span>
                      <span>{welcomeUploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${welcomeUploadProgress}%`, height: '100%', background: '#1f6feb', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Passo 1: Introdução simples */}
              {currentStep === 1 && (
                <div className={styles.formStep}>
                  <h3>Criar Novo Guia Virtual</h3>
                  <p className={styles.stepDescription}>
                    Este assistente irá criar um novo guia no projeto padrão. Clique em "Seguir para Informações do Guia" para começar.
                  </p>
                </div>
              )}

              {/* Passo 2 removido: o guia é sempre criado no projeto Firebase fixo */}

              {/* Passo 2: Formulário de dados do guia */}
              {currentStep === 2 && (
                <div className={styles.formStep}>
                   <h3>{isEditMode ? 'Editar Informações do Guia' : 'Informações do Guia'}</h3>
                  <p className={styles.stepDescription}>
                    Preencha as informações básicas do novo guia virtual.
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="guideName">Nome do Guia *</label>
                    <input
                      type="text"
                      id="guideName"
                      value={guideData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex: Licor Beirão"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Este será o nome que aparece no título e cabeçalho do guia.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="guideSlug">Nome do Link *</label>
                    <div className={styles.slugInput}>
                      <span className={styles.slugPrefix}>localhost:3000/</span>
                       <input
                        type="text"
                        id="guideSlug"
                        value={guideData.slug}
                        onChange={(e) => handleInputChange('slug', e.target.value)}
                        placeholder="licor-beirao"
                         className={styles.formInput}
                         disabled={isEditMode}
                      />
                    </div>
                    <small className={styles.formHelp}>
                      Este será o endereço URL do guia. Use apenas letras minúsculas, números e hífens.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="guideCompany">Nome da Empresa</label>
                    <input
                      type="text"
                      id="guideCompany"
                      value={guideData.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      placeholder="Ex: Licor Beirão, Lda."
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Nome completo da empresa ou organização.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="metaTitle">Meta Title</label>
                    <input
                      type="text"
                      id="metaTitle"
                      value={guideData.metaTitle}
                      onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                      placeholder="Título SEO da página"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Título usado nos motores de busca e no separador do navegador.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="metaDescription">Meta Description</label>
                    <textarea
                      id="metaDescription"
                      value={guideData.metaDescription}
                      onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                      placeholder="Descrição SEO da página (ideal 50–160 caracteres)"
                      className={styles.formInput}
                      style={{ minHeight: 90 }}
                    />
                    <small className={styles.formHelp}>
                      Breve descrição apresentada nos resultados de pesquisa.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Pré-visualização:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Nome do Guia:</strong> {guideData.name || 'Nome do Guia'}</p>
                      <p><strong>URL:</strong> localhost:3000/{guideData.slug || 'nome-do-link'}</p>
                      <p><strong>Empresa:</strong> {guideData.company || 'Nome da Empresa'}</p>
                      <p><strong>Meta Title:</strong> {guideData.metaTitle || '(vazio)'}</p>
                      <p><strong>Meta Description:</strong> {guideData.metaDescription || '(vazio)'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 3: Definir System Prompt */}
              {currentStep === 3 && (
                <div className={styles.formStep}>
                  <h3>System Prompt do Chat (IA)</h3>
                  <p className={styles.stepDescription}>
                    Escreva o prompt de sistema para orientar o comportamento do assistente deste guia.
                    Este texto ficará guardado apenas no projeto Firebase do guia.
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="systemPrompt">System Prompt *</label>
                    <textarea
                      id="systemPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Defina aqui o papel, objetivos, limites e estilo do assistente para este guia..."
                      className={styles.formInput}
                      style={{ minHeight: 180, fontFamily: 'monospace' }}
                    />
                    <small className={styles.formHelp}>
                      Dica: Inclua identidade do agente, objetivo, fontes, tom, limites e instruções para ignorar pedidos indevidos.
                    </small>
                  </div>
                </div>
              )}

              {/* Passo 4: Upload de Vídeos e Legendas */}
              {currentStep === 4 && (
                <div className={styles.formStep}>
                  <h3>Upload de Vídeos e Legendas {isEditMode ? '(Opcional - Manter existentes)' : '(Opcional)'}</h3>
                  <p className={styles.stepDescription}>
                    {isEditMode 
                      ? 'Faça upload de novos vídeos para substituir os existentes, ou deixe em branco para manter os vídeos atuais. Opcionalmente, faça upload de legendas (.vtt) específicas por dispositivo.'
                      : 'Faça upload dos vídeos e, opcionalmente, de três ficheiros de legendas (.vtt) específicos por dispositivo.'
                    }
                  </p>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="backgroundVideo">Vídeo Principal (Background)</label>
                    {isEditMode && existingAssets.background && (
                      <div style={{ 
                        background: '#f0f8ff', 
                        border: '1px solid #b3d9ff', 
                        borderRadius: 4, 
                        padding: 8, 
                        marginBottom: 8,
                        fontSize: 13,
                        color: '#0066cc'
                      }}>
                        📹 Vídeo atual: {existingAssets.background.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      id="backgroundVideo"
                      accept="video/*"
                      onChange={(e) => setBackgroundVideoFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      {isEditMode 
                        ? 'Selecione um novo vídeo para substituir o atual, ou deixe em branco para manter o vídeo existente.'
                        : 'Vídeo que será reproduzido em loop no fundo da página do guia.'
                      }
                    </small>
                    {backgroundVideoFile && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                        Selecionado: {backgroundVideoFile.name} ({(backgroundVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                    {backgroundUploadProgress > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          width: '100%',
                          height: 8,
                          background: '#eee',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${backgroundUploadProgress}%`,
                            height: '100%',
                            background: '#1f6feb',
                            transition: 'width 200ms ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>{backgroundUploadProgress}%</div>
                      </div>
                    )}
                    {backgroundUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Vídeo processado e pronto para uso
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="welcomeVideo">Vídeo de Boas‑vindas</label>
                    {isEditMode && existingAssets.welcome && (
                      <div style={{ 
                        background: '#f0f8ff', 
                        border: '1px solid #b3d9ff', 
                        borderRadius: 4, 
                        padding: 8, 
                        marginBottom: 8,
                        fontSize: 13,
                        color: '#0066cc'
                      }}>
                        📹 Vídeo atual: {existingAssets.welcome.split('/').pop()}
                      </div>
                    )}
                    <input
                      type="file"
                      id="welcomeVideo"
                      accept="video/*"
                      onChange={(e) => setWelcomeVideoFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      {isEditMode 
                        ? 'Selecione um novo vídeo para substituir o atual, ou deixe em branco para manter o vídeo existente.'
                        : 'Vídeo de apresentação que será reproduzido quando o utilizador entrar na página.'
                      }
                    </small>
                    {welcomeVideoFile && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                        Selecionado: {welcomeVideoFile.name} ({(welcomeVideoFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                    {welcomeUploadProgress > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{
                          width: '100%',
                          height: 8,
                          background: '#eee',
                          borderRadius: 6,
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${welcomeUploadProgress}%`,
                            height: '100%',
                            background: '#1f6feb',
                            transition: 'width 200ms ease',
                          }} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>{welcomeUploadProgress}%</div>
                      </div>
                    )}
                    {welcomeUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Vídeo processado e pronto para uso
                      </div>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>Legendas (.vtt) por dispositivo</label>
                    <div style={{ display: 'grid', gap: 16 }}>
                      <div>
                        <label htmlFor="captionsDesktop">Desktop</label>
                        <input
                          type="file"
                          id="captionsDesktop"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsDesktopFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsDesktopFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsDesktopFile.name} ({(captionsDesktopFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.desktop === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas desktop processadas</div>
                        )}
                      </div>
                      <div>
                        <label htmlFor="captionsTablet">Tablet</label>
                        <input
                          type="file"
                          id="captionsTablet"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsTabletFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsTabletFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsTabletFile.name} ({(captionsTabletFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.tablet === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas tablet processadas</div>
                        )}
                      </div>
                      <div>
                        <label htmlFor="captionsMobile">Mobile</label>
                        <input
                          type="file"
                          id="captionsMobile"
                          accept=".vtt,text/vtt"
                          onChange={(e) => setCaptionsMobileFile(e.target.files?.[0] || null)}
                          className={styles.formInput}
                        />
                        {captionsMobileFile && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
                            Selecionado: {captionsMobileFile.name} ({(captionsMobileFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {captionsUploadProgress.mobile === 100 && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>✅ Legendas mobile processadas</div>
                        )}
                      </div>
                    </div>
                    <small className={styles.formHelp}>Formatos suportados: .vtt. Estes ficheiros serão servidos a partir de /guides/{guideData.slug}/</small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Resumo das Legendas:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Desktop:</strong> {captionsDesktopFile ? captionsDesktopFile.name : 'Nenhum (opcional)'}</p>
                      <p><strong>Tablet:</strong> {captionsTabletFile ? captionsTabletFile.name : 'Nenhum (opcional)'}</p>
                      <p><strong>Mobile:</strong> {captionsMobileFile ? captionsMobileFile.name : 'Nenhum (opcional)'}</p>
                    </div>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Resumo dos Vídeos:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Vídeo Principal:</strong> {backgroundVideoFile ? backgroundVideoFile.name : 'Nenhum selecionado (opcional)'}</p>
                      <p><strong>Vídeo de Boas‑vindas:</strong> {welcomeVideoFile ? welcomeVideoFile.name : 'Nenhum selecionado (opcional)'}</p>
                      <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
                        💡 <strong>Nota:</strong> Os vídeos são opcionais. Podes criar o guia sem vídeos e adicioná-los depois.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 5: Upload do Ícone do Chat */}
              {currentStep === 5 && (
                <div className={styles.formStep}>
                  <h3>Ícone do Chat (avatar do guia real)</h3>
                  <p className={styles.stepDescription}>
                    Faça upload da imagem que será usada como ícone do guia real no chat. Recomenda-se uma imagem quadrada com fundo transparente.
                  </p>
                  <div className={styles.formGroup}>
                    <label htmlFor="chatIcon">Imagem do Ícone do Chat (PNG/JPG/SVG)</label>
                    <input
                      type="file"
                      id="chatIcon"
                      accept="image/*"
                      onChange={(e) => setChatIconFile(e.target.files?.[0] || null)}
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Tamanho recomendado: 80x80px ou superior, formato quadrado. Fundo transparente (PNG) preferível.
                    </small>
                    {chatIconFile && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                          src={URL.createObjectURL(chatIconFile)}
                          alt="Pré-visualização do ícone"
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }}
                        />
                        <span style={{ fontSize: 13, color: '#666' }}>{chatIconFile.name}</span>
                      </div>
                    )}
                    {chatIconUploadProgress === 100 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: '#0a7f28' }}>
                        ✅ Ícone processado e pronto para uso
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passo 6: Configuração do Chat (botões e título abaixo do bem-vindo) */}
              {currentStep === 6 && (
                <div className={styles.formStep}>
                  <h3>Configuração do Chat (IA)</h3>
                  <p className={styles.stepDescription}>
                    Define o título que aparece abaixo de "BEM-VINDO AO GUIA VIRTUAL" e configura os botões rápidos que enviam perguntas para o chat com AI.
                  </p>

                  <div className={styles.formGroup}>
                    <label htmlFor="welcomeTitle">Título abaixo do Bem‑vindo *</label>
                    <input
                      type="text"
                      id="welcomeTitle"
                      value={chatConfig.welcomeTitle}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, welcomeTitle: e.target.value }))}
                      placeholder="Ex: PORTUGAL DOS PEQUENITOS"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Este texto aparecerá abaixo de "BEM-VINDO AO GUIA VIRTUAL" no cabeçalho e ecrã de boas-vindas.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Botões Rápidos do Chat (AI)</h4>
                    <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
                      Estes botões enviam perguntas diretamente para o chat com AI. O utilizador clica e a pergunta é automaticamente enviada.
                    </p>
                    <div className={styles.previewContent}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <label>Texto do Botão 1 *</label>
                          <input
                            type="text"
                            value={chatConfig.button1Text}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button1Text: e.target.value }))}
                            placeholder="O que visitar"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Texto que aparece no botão</small>
                          <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                          <input
                            type="text"
                            value={chatConfig.button1Function}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button1Function: e.target.value }))}
                            placeholder="O que visitar no parque?"
                            className={styles.formInput}
                            style={{ marginTop: 6 }}
                          />
                          <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                        </div>
                        <div>
                          <label>Texto do Botão 2 *</label>
                          <input
                            type="text"
                            value={chatConfig.button2Text}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button2Text: e.target.value }))}
                            placeholder="O que comer"
                            className={styles.formInput}
                          />
                          <small className={styles.formHelp}>Texto que aparece no botão</small>
                          <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                          <input
                            type="text"
                            value={chatConfig.button2Function}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, button2Function: e.target.value }))}
                            placeholder="O que comer no parque?"
                            className={styles.formInput}
                            style={{ marginTop: 6 }}
                          />
                          <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                        </div>
                        <div>
                          <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={chatConfig.downloadVideoEnabled}
                                onChange={(e) => setChatConfig(prev => ({ ...prev, downloadVideoEnabled: e.target.checked }))}
                              />
                              Ativar botão de download de vídeo
                            </label>
                            <small className={styles.formHelp}>
                              Quando ativado, o botão 3 permitirá fazer download do vídeo de boas-vindas em vez de enviar uma pergunta para o chat.
                            </small>
                          </div>
                          
                          {!chatConfig.downloadVideoEnabled ? (
                            <>
                              <label>Texto do Botão 3 *</label>
                              <input
                                type="text"
                                value={chatConfig.button3Text}
                                onChange={(e) => setChatConfig(prev => ({ ...prev, button3Text: e.target.value }))}
                                placeholder="Download vídeo"
                                className={styles.formInput}
                              />
                              <small className={styles.formHelp}>Texto que aparece no botão</small>
                              <label style={{ marginTop: 12, display: 'block' }}>Pergunta a enviar *</label>
                              <input
                                type="text"
                                value={chatConfig.button3Function}
                                onChange={(e) => setChatConfig(prev => ({ ...prev, button3Function: e.target.value }))}
                                placeholder="Como posso fazer download de vídeos?"
                                className={styles.formInput}
                                style={{ marginTop: 6 }}
                              />
                              <small className={styles.formHelp}>Pergunta que será enviada ao chat quando clicar</small>
                            </>
                          ) : (
                            <div style={{ padding: 16, backgroundColor: '#f0f8ff', borderRadius: 8, border: '1px solid #d1e7dd' }}>
                              <p style={{ margin: 0, color: '#0a7f28', fontWeight: 500 }}>
                                ✅ Botão de download de vídeo ativado
                              </p>
                              <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#666' }}>
                                O botão 3 permitirá aos utilizadores fazer download do vídeo de boas-vindas.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Chat com Guia Real</h4>
                    <div className={styles.previewContent}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={humanChatEnabled}
                          onChange={(e) => setHumanChatEnabled(e.target.checked)}
                        />
                        Ativar chat com guia real neste guia
                      </label>
                      <small className={styles.formHelp}>
                        Quando desativado, o botão para falar com guia real e o popup não serão mostrados.
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 7: Pontos de Ajuda */}
              {currentStep === 7 && (
                <div className={styles.formStep}>
                  <h3>Pontos de Ajuda</h3>
                  <p className={styles.stepDescription}>
                    Define os pontos que aparecem abaixo de "Como posso ajudar hoje?" no ecrã de boas-vindas do chat.
                  </p>

                  <div className={styles.formGroup}>
                    <label htmlFor="helpPoint1">Ponto 1 *</label>
                    <input
                      type="text"
                      id="helpPoint1"
                      value={helpPoints.point1}
                      onChange={(e) => setHelpPoints(prev => ({ ...prev, point1: e.target.value }))}
                      placeholder="Ex: O que visitar ?"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Primeiro ponto de ajuda que aparece na lista.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="helpPoint2">Ponto 2 *</label>
                    <input
                      type="text"
                      id="helpPoint2"
                      value={helpPoints.point2}
                      onChange={(e) => setHelpPoints(prev => ({ ...prev, point2: e.target.value }))}
                      placeholder="Ex: O que comer ?"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Segundo ponto de ajuda que aparece na lista.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="helpPoint3">Ponto 3 *</label>
                    <input
                      type="text"
                      id="helpPoint3"
                      value={helpPoints.point3}
                      onChange={(e) => setHelpPoints(prev => ({ ...prev, point3: e.target.value }))}
                      placeholder="Ex: Horários e bilhetes"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Terceiro ponto de ajuda que aparece na lista.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="helpPoint4">Ponto 4 *</label>
                    <input
                      type="text"
                      id="helpPoint4"
                      value={helpPoints.point4}
                      onChange={(e) => setHelpPoints(prev => ({ ...prev, point4: e.target.value }))}
                      placeholder="Ex: Como chegar"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Quarto ponto de ajuda que aparece na lista.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="helpPoint5">Ponto 5 *</label>
                    <input
                      type="text"
                      id="helpPoint5"
                      value={helpPoints.point5}
                      onChange={(e) => setHelpPoints(prev => ({ ...prev, point5: e.target.value }))}
                      placeholder="Ex: Acessibilidade"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Quinto ponto de ajuda que aparece na lista.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Pré-visualização dos Pontos de Ajuda:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Como posso ajudar hoje?</strong></p>
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        <li>{helpPoints.point1 || 'Ponto 1'}</li>
                        <li>{helpPoints.point2 || 'Ponto 2'}</li>
                        <li>{helpPoints.point3 || 'Ponto 3'}</li>
                        <li>{helpPoints.point4 || 'Ponto 4'}</li>
                        <li>{helpPoints.point5 || 'Ponto 5'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 8: Configuração das FAQs */}
              {currentStep === 8 && (
                <div className={styles.formStep}>
                  <h3>Configuração das FAQs</h3>
                  <p className={styles.stepDescription}>
                    Adicione categorias e perguntas para a FAQ do guia.
                  </p>

                  <div className={styles.faqCategories}>
                    {faqData.map((category, categoryIndex) => (
                      <div key={categoryIndex} className={styles.faqCategory}>
                        <div className={styles.faqCategoryHeader}>
                          <input
                            type="text"
                            value={category.name}
                            onChange={(e) => updateFaqCategoryName(categoryIndex, e.target.value)}
                            placeholder="Nova Categoria"
                            className={styles.faqCategoryNameInput}
                          />
                          <button 
                            onClick={() => removeFaqCategory(categoryIndex)}
                            className={styles.removeFaqCategoryButton}
                          >
                            ×
                          </button>
                        </div>
                        {category.questions.map((question, questionIndex) => (
                          <div key={questionIndex} className={styles.faqQuestion}>
                            <input
                              type="text"
                              value={question.question}
                              onChange={(e) => updateFaqQuestion(categoryIndex, questionIndex, 'question', e.target.value)}
                              placeholder="Nova Pergunta"
                              className={styles.faqQuestionInput}
                            />
                            <input
                              type="text"
                              value={question.answer}
                              onChange={(e) => updateFaqQuestion(categoryIndex, questionIndex, 'answer', e.target.value)}
                              placeholder="Nova Resposta"
                              className={styles.faqAnswerInput}
                            />
                            <button 
                              onClick={() => removeFaqQuestion(categoryIndex, questionIndex)}
                              className={styles.removeFaqButton}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button onClick={() => addFaqQuestion(categoryIndex)}>+ Adicionar Pergunta</button>
                      </div>
                    ))}
                    <button onClick={addFaqCategory}>+ Adicionar Categoria</button>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Pré-visualização da FAQ:</h4>
                    <div className={styles.previewContent}>
                      {faqData.map((category, categoryIndex) => (
                        <div key={categoryIndex} style={{ marginBottom: 20 }}>
                          <h5>{category.name}</h5>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {category.questions.map((question, questionIndex) => (
                              <li key={questionIndex}>
                                <strong>{question.question}:</strong> {question.answer}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Passo 9: Configuração de Contactos */}
              {currentStep === 9 && (
                <div className={styles.formStep}>
                  <h3>Configuração de Contactos</h3>
                  <p className={styles.stepDescription}>
                    Configure as informações de contacto e ative/desative a secção na página do guia.
                  </p>

                  <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={contactsEnabled}
                        onChange={(e) => setContactsEnabled(e.target.checked)}
                      />
                      Ativar zona de contactos
                    </label>
                    <small className={styles.formHelp}>
                      Desative para esconder completamente a secção de contactos neste guia.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="phoneNumber">Número de Telefone</label>
                    <input
                      type="text"
                      id="phoneNumber"
                      value={contactInfo.phoneNumber}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="+351 239 801 170"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Número de telefone para o qual os visitantes podem ligar.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="address">Endereço</label>
                    <input
                      type="text"
                      id="address"
                      value={contactInfo.address}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Largo Rossio de Santa Clara, 3040-256 Coimbra, Portugal"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Endereço completo do parque para os visitantes.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="callUsTitle">Título para "Ligue-nos"</label>
                    <input
                      type="text"
                      id="callUsTitle"
                      value={contactInfo.callUsTitle}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, callUsTitle: e.target.value }))}
                      placeholder="Ligue-nos"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Título que aparece no botão "Ligue-nos".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="callUsDescription">Descrição para "Ligue-nos"</label>
                    <textarea
                      id="callUsDescription"
                      value={contactInfo.callUsDescription}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, callUsDescription: e.target.value }))}
                      placeholder="Entre em contacto connosco para esclarecer dúvidas ou solicitar informações sobre os nossos produtos e serviços."
                      className={styles.formInput}
                      style={{ minHeight: 100 }}
                    />
                    <small className={styles.formHelp}>
                      Descrição que aparece abaixo do título "Ligue-nos".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="visitUsTitle">Título para "Visite-nos"</label>
                    <input
                      type="text"
                      id="visitUsTitle"
                      value={contactInfo.visitUsTitle}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, visitUsTitle: e.target.value }))}
                      placeholder="Visite-nos"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Título que aparece no botão "Visite-nos".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="visitUsDescription">Descrição para "Visite-nos"</label>
                    <textarea
                      id="visitUsDescription"
                      value={contactInfo.visitUsDescription}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, visitUsDescription: e.target.value }))}
                      placeholder="Visite o nosso parque e descubra mais sobre Portugal."
                      className={styles.formInput}
                      style={{ minHeight: 100 }}
                    />
                    <small className={styles.formHelp}>
                      Descrição que aparece abaixo do título "Visite-nos".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="liveChatTitle">Título para "Chat ao Vivo"</label>
                    <input
                      type="text"
                      id="liveChatTitle"
                      value={contactInfo.liveChatTitle}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, liveChatTitle: e.target.value }))}
                      placeholder="Chat ao Vivo"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Título que aparece no botão "Chat ao Vivo".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="liveChatDescription">Descrição para "Chat ao Vivo"</label>
                    <textarea
                      id="liveChatDescription"
                      value={contactInfo.liveChatDescription}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, liveChatDescription: e.target.value }))}
                      placeholder="Fale com o nosso guia virtual em tempo real."
                      className={styles.formInput}
                      style={{ minHeight: 100 }}
                    />
                    <small className={styles.formHelp}>
                      Descrição que aparece abaixo do título "Chat ao Vivo".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="liveChatButtonText">Texto do Botão "Chat ao Vivo"</label>
                    <input
                      type="text"
                      id="liveChatButtonText"
                      value={contactInfo.liveChatButtonText}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, liveChatButtonText: e.target.value }))}
                      placeholder="FALE COM O GUIA VIRTUAL"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Texto que aparece no botão "Chat ao Vivo".
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="mapEmbedUrl">URL do Embed do Mapa</label>
                    <input
                      type="text"
                      id="mapEmbedUrl"
                      value={contactInfo.mapEmbedUrl}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, mapEmbedUrl: e.target.value }))}
                      placeholder="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3048.1234567890!2d-8.4194!3d40.2033!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd23f8b5e5b5b5b5%3A0x5b5b5b5b5b5b5b5b!2sLargo%20Rossio%20de%20Santa%20Clara%2C%20Coimbra!5e0!3m2!1spt-PT!2spt!4v1234567890"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      URL do iframe do Google Maps para o endereço do parque.
                    </small>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      id="email"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="geral@empresa.pt"
                      className={styles.formInput}
                    />
                    <small className={styles.formHelp}>
                      Email de contacto para ser mostrado com link mailto.
                    </small>
                  </div>

                  <div className={styles.previewBox}>
                    <h4>Pré-visualização das Informações de Contacto:</h4>
                    <div className={styles.previewContent}>
                      <p><strong>Zona de Contactos:</strong> {contactsEnabled ? 'Ativada' : 'Desativada'}</p>
                      <p><strong>Número de Telefone:</strong> {contactInfo.phoneNumber}</p>
                      <p><strong>Endereço:</strong> {contactInfo.address}</p>
                      <p><strong>Título "Ligue-nos":</strong> {contactInfo.callUsTitle}</p>
                      <p><strong>Descrição "Ligue-nos":</strong> {contactInfo.callUsDescription}</p>
                      <p><strong>Título "Visite-nos":</strong> {contactInfo.visitUsTitle}</p>
                      <p><strong>Descrição "Visite-nos":</strong> {contactInfo.visitUsDescription}</p>
                      <p><strong>Título "Chat ao Vivo":</strong> {contactInfo.liveChatTitle}</p>
                      <p><strong>Descrição "Chat ao Vivo":</strong> {contactInfo.liveChatDescription}</p>
                      <p><strong>Texto do Botão "Chat ao Vivo":</strong> {contactInfo.liveChatButtonText}</p>
                      <p><strong>URL do Mapa:</strong> {contactInfo.mapEmbedUrl}</p>
                      <p><strong>Email:</strong> {contactInfo.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className={styles.modalFooter}>
              {(currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5 || currentStep === 6 || currentStep === 7 || currentStep === 8 || currentStep === 9) && (
                <button 
                  className={styles.secondaryButton}
                  onClick={handleBackStep}
                >
                  Voltar
                </button>
              )}
              
               <button 
                className={styles.secondaryButton}
                onClick={() => setShowCreateGuideModal(false)}
              >
                Cancelar
              </button>
              
               <button 
                className={styles.primaryButton}
                onClick={handleNextStep}
                disabled={creating 
                  || (currentStep === 2 && !isGuideFormValid()) 
                  || (currentStep === 3 && systemPrompt.trim() === '')
                  || (currentStep === 4 && !isEditMode && !backgroundVideoFile && !welcomeVideoFile)
                  || (currentStep === 4 && isEditMode && !backgroundVideoFile && !welcomeVideoFile && !existingAssets.background && !existingAssets.welcome)
                  || (currentStep === 6 && (!chatConfig.welcomeTitle.trim() || !chatConfig.button1Text.trim() || !chatConfig.button1Function.trim() || !chatConfig.button2Text.trim() || !chatConfig.button2Function.trim() || (!chatConfig.downloadVideoEnabled && (!chatConfig.button3Text.trim() || !chatConfig.button3Function.trim()))))
                  || (currentStep === 7 && (!helpPoints.point1.trim() || !helpPoints.point2.trim() || !helpPoints.point3.trim() || !helpPoints.point4.trim() || !helpPoints.point5.trim()))
                  || (currentStep === 8 && faqData.length === 0)
                  || (currentStep === 8 && faqData.some(category => category.questions.length === 0))
                  || (currentStep === 8 && faqData.some(category => category.name.trim() === ''))
                  || (currentStep === 8 && faqData.some(category => category.questions.some(q => q.question.trim() === '')))
                  || (currentStep === 8 && faqData.some(category => category.questions.some(q => q.answer.trim() === '')))
                  || (currentStep === 9 && (!contactInfo.address.trim() || !contactInfo.liveChatButtonText.trim() || !contactInfo.mapEmbedUrl.trim()))
                  }
              >
                 {isEditMode
                  ? (currentStep === 9 ? (creating ? 'A guardar...' : 'Guardar Alterações')
                    : (currentStep === 2 ? 'Seguir para System Prompt'
                      : currentStep === 3 ? 'Seguir para Vídeos'
                      : currentStep === 4 ? 'Seguir para Ícone do Chat'
                      : currentStep === 5 ? 'Seguir para Configuração do Chat'
                      : currentStep === 6 ? 'Seguir para Pontos de Ajuda'
                      : currentStep === 7 ? 'Seguir para Configuração das FAQs'
                      : 'Seguir para Configuração de Contactos'))
                  : (currentStep === 1
                    ? 'Seguir para Informações do Guia'
                    : currentStep === 2
                    ? 'Seguir para System Prompt'
                    : currentStep === 3
                    ? 'Seguir para Vídeos'
                    : currentStep === 4
                    ? 'Seguir para Ícone do Chat'
                    : currentStep === 5
                    ? 'Seguir para Configuração do Chat'
                    : currentStep === 6
                    ? 'Seguir para Pontos de Ajuda'
                    : currentStep === 7
                    ? 'Seguir para Configuração das FAQs'
                    : currentStep === 8
                    ? 'Seguir para Configuração de Contactos'
                    : (creating ? 'A criar...' : 'Criar Guia'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </BackofficeAuthGuard>
  );
}

