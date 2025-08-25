'use client';
import styles from "./page.module.css";
import React, { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import Image from "next/image";
import { saveContactRequest, createConversation, sendMessage, listenToConversation, closeConversation, type Conversation, type ChatMessage, getConversation } from "../../../firebase/services";

// Tipo local que estende ChatMessage com metadata para compatibilidade com GuideChatMessage
type ExtendedChatMessage = ChatMessage & {
  metadata?: {
    showWhenOpenedByGuide?: boolean;
    isTransitionMessage?: boolean;
    guideResponse?: boolean;
    closingMessage?: boolean;
    messageType?: 'text' | 'image' | 'file';
    fileUrl?: string;
    responseTime?: number;
  };
};
import { createGuideConversation, sendGuideMessage, listenToGuideConversation, getGuideConversation, closeGuideConversation } from "../../../firebase/guideServices";

// Interface para os vídeos do guia
interface GuideVideos {
  backgroundVideoURL: string | null;
  welcomeVideoURL: string | null;
  systemPrompt: string | null;
  chatConfig?: {
    welcomeTitle?: string | null;
    button1Text?: string | null;
    button1Function?: string | null;
    button2Text?: string | null;
    button2Function?: string | null;
    button3Text?: string | null;
    button3Function?: string | null;
    downloadVideoEnabled?: boolean | null;
  } | null;
  faq?: {
    name: string;
    questions: {
      question: string;
      answer: string;
    }[];
  }[];
  chatIconURL?: string | null;
  captions?: { desktop?: string | null; tablet?: string | null; mobile?: string | null } | null;
}

// Props do componente
// Props do componente inline no export default (mantido para alinhar com tipos já usados no ficheiro)

// Estrutura de gestão de memória de conversa
type ConversationMessage = { role: "system" | "user" | "assistant"; content: string };
const conversation: ConversationMessage[] = [];

// (Removido: prompt estático antigo; agora usamos sempre o systemPrompt do Firestore)

// Função para obter sumário da conversa (opcional)
async function getSummary(conversation: ConversationMessage[]): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "Faz um resumo conciso da conversa em português de Portugal. Máximo 128 tokens."
          },
          ...conversation
        ],
        model: "meta-llama/llama-3.1-8b-instruct",
        max_tokens: 128,
        temperature: 0.3,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      return "Resumo da conversa anterior";
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content;
    }
    
    return "Resumo da conversa anterior";
  } catch (error) {
    console.error('Erro ao obter sumário:', error);
    return "Resumo da conversa anterior";
  }
}

// Funções para persistência longa (bónus)
function saveConversationToStorage() {
  try {
    localStorage.setItem('chatbot_conversation', JSON.stringify(conversation));
  } catch (error) {
    console.error('Erro ao guardar conversa:', error);
  }
}

function loadConversationFromStorage() {
  try {
    const saved = localStorage.getItem('chatbot_conversation');
    if (saved) {
      const parsed = JSON.parse(saved);
      conversation.length = 0; // Limpar array atual
      conversation.push(...parsed);
    }
  } catch (error) {
    console.error('Erro ao carregar conversa:', error);
  }
}

// Funções para gerir cookies
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
}

// Componentes SVG das bandeiras
function PortugalFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#006600"/>
      <rect x="8" width="16" height="16" fill="#FF0000"/>
      <circle cx="10" cy="8" r="3" fill="#FFFF00"/>
      <circle cx="10" cy="8" r="2.5" fill="#006600"/>
      <circle cx="10" cy="8" r="1.5" fill="#FFFF00"/>
    </svg>
  );
}

function EnglandFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#012169"/>
      <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3"/>
      <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="2"/>
      <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5"/>
      <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3"/>
    </svg>
  );
}

function SpainFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="16" fill="#FF0000"/>
      <rect y="4" width="24" height="8" fill="#FFCC00"/>
    </svg>
  );
}

function FranceFlag() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="8" height="16" fill="#002395"/>
      <rect x="8" width="8" height="16" fill="#FFFFFF"/>
      <rect x="16" width="8" height="16" fill="#ED2939"/>
    </svg>
  );
}

// MicIcon component for audio recording functionality - Commented out to fix ESLint warning
/* function MicIcon({active}: {active?: boolean}) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="11" fill={active ? "#cb3c58" : "rgba(255,255,255,0.18)"} />
      <path d="M11 15.5C13.2091 15.5 15 13.7091 15 11.5V8.5C15 6.29086 13.2091 4.5 11 4.5C8.79086 4.5 7 6.29086 7 8.5V11.5C7 13.7091 8.79086 15.5 11 15.5Z" stroke="#51aecd" strokeWidth="1.5"/>
      <path d="M5.5 11.5C5.5 14.2614 7.73858 16.5 10.5 16.5C13.2614 16.5 15.5 14.2614 15.5 11.5" stroke="#51aecd" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 16.5V18" stroke="#51aecd" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
} */

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" rx="11" fill="rgba(255,255,255,0.18)" />
      <path d="M6 11L16 6L11 16L10 12L6 11Z" fill="#ffffff" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 4.5L13.5 13.5M4.5 13.5L13.5 4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 12H5M12 19L5 12L12 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// GuideIcon component for guide functionality - Commented out to fix ESLint warning
/* function GuideIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 16V16.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
} */

function RewindIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.39" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path fill="white" d="m6.01,144.55c4.29-1.12,8.67,1.46,9.79,5.75,34.37,120.48,207.81,98.3,210.75-27.06.7-83.75-94.88-135.92-164.88-90.17l7.79,11.05c1.61,2.28.14,5.44-2.63,5.69l-47.4,4.29c-2.78.25-4.78-2.6-3.61-5.13L35.79,5.78c1.17-2.53,4.64-2.84,6.25-.57l10.36,14.7c82.01-52.88,189.94,5.69,190.19,103.32.71,67.04-56.1,123.86-123.15,123.15-54.96.68-105.9-38.77-119.18-92.04-1.12-4.29,1.46-8.67,5.74-9.79Z"/>
        <g>
          <path fill="white" d="m103.13,159.36h-14.05v-52.93c-5.13,4.8-11.18,8.35-18.14,10.65v-12.75c3.67-1.2,7.65-3.47,11.95-6.82,4.3-3.35,7.25-7.26,8.85-11.72h11.4v73.58Z"/>
          <path fill="white" d="m147.87,85.78c7.1,0,12.65,2.53,16.65,7.6,4.77,6,7.15,15.95,7.15,29.84s-2.4,23.83-7.2,29.89c-3.97,5-9.5,7.5-16.6,7.5s-12.88-2.74-17.24-8.22c-4.37-5.48-6.55-15.25-6.55-29.32s2.4-23.73,7.2-29.79c3.97-5,9.5-7.5,16.6-7.5Zm0,11.65c-1.7,0-3.22.54-4.55,1.62-1.33,1.08-2.37,3.02-3.1,5.82-.97,3.63-1.45,9.75-1.45,18.34s.43,14.5,1.3,17.72c.87,3.22,1.96,5.36,3.27,6.42,1.32,1.07,2.82,1.6,4.52,1.6s3.22-.54,4.55-1.62c1.33-1.08,2.37-3.02,3.1-5.82.97-3.6,1.45-9.7,1.45-18.29s-.43-14.5-1.3-17.72c-.87-3.22-1.96-5.36-3.27-6.45-1.32-1.08-2.82-1.62-4.52-1.62Z"/>
        </g>
      </g>
    </svg>
  );
}

function FastForwardIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.39" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="white" d="m236.59,144.55c-4.29-1.12-8.67,1.46-9.79,5.75-34.37,120.48-207.81,98.3-210.75-27.06C15.36,39.48,110.94-12.69,180.93,33.06l-7.79,11.05c-1.61,2.28-.14,5.44,2.63,5.69l47.4,4.29c2.78.25,4.78-2.6,3.61-5.13l-19.98-43.19c-1.17-2.53-4.64-2.84-6.25-.57l-10.36,14.7C108.18-32.96.25,25.6,0,123.23c-.71,67.04,56.1,123.86,123.15,123.15,54.96.68,105.9-38.77,119.18-92.04,1.12-4.29-1.46-8.67-5.74-9.79Z"/>
      <g>
        <path fill="white" d="m103.13,159.36h-14.05v-52.93c-5.13,4.8-11.18,8.35-18.14,10.65v-12.75c3.67-1.2,7.65-3.47,11.95-6.82,4.3-3.35,7.25-7.26,8.85-11.72h11.4v73.58Z"/>
        <path fill="white" d="m147.87,85.78c7.1,0,12.65,2.53,16.65,7.6,4.77,6,7.15,15.95,7.15,29.84s-2.4,23.83-7.2,29.89c-3.97,5-9.5,7.5-16.6,7.5s-12.88-2.74-17.24-8.22c-4.37-5.48-6.55-15.25-6.55-29.32s2.4-23.73,7.2-29.79c3.97-5,9.5-7.5,16.6-7.5Zm0,11.65c-1.7,0-3.22.54-4.55,1.62-1.33,1.08-2.37,3.02-3.1,5.82-.97,3.63-1.45,9.75-1.45,18.34s.43,14.5,1.3,17.72c.87,3.22,1.96,5.36,3.27,6.42,1.32,1.07,2.82,1.6,4.52,1.6s3.22-.54,4.55-1.62c1.33-1.08,2.37-3.02,3.1-5.82.97-3.6,1.45-9.7,1.45-18.29s-.43-14.5-1.3-17.72c-.87-3.22-1.96-5.36-3.27-6.45-1.32-1.08-2.82-1.62-4.52-1.62Z"/>
      </g>
    </svg>
  );
}

function VolumeIcon({ muted }: { muted?: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {muted ? (
        <>
          <path d="M15 8L21 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21 8L15 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 10.5V13.5C3 13.9142 3.33579 14.25 3.75 14.25H7.5L12 18V6L7.5 9.75H3.75C3.33579 9.75 3 10.0858 3 10.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <>
          <path d="M3 10.5V13.5C3 13.9142 3.33579 14.25 3.75 14.25H7.5L12 18V6L7.5 9.75H3.75C3.33579 9.75 3 10.0858 3 10.5Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16.5 7.5C18.1569 7.5 19.5 9.567 19.5 12C19.5 14.433 18.1569 16.5 16.5 16.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15 10.5C15.5523 10.5 16 11.1716 16 12C16 12.8284 15.5523 13.5 15 13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
    </svg>
  );
}

function PlayPauseIcon({ playing }: { playing?: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {playing ? (
        <>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9.5 8.5V15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14.5 8.5V15.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15.5 12L10 8V16L15.5 12Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      )}
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 242.6 246.4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.3,154.3c13.3,53.3,64.2,92.7,119.2,92c67.1,0.7,123.9-56.1,123.2-123.2C242.3,25.6,134.4-33,52.4,19.9L42,5.2c-1.6-2.3-5.1-2-6.2,0.6L15.8,49c-1.2,2.5,0.8,5.4,3.6,5.1l47.4-4.3c2.8-0.2,4.2-3.4,2.6-5.7l-7.8-11c70-45.8,165.6,6.4,164.9,90.2c-2.9,125.4-176.4,147.5-210.8,27.1c-1.1-4.3-5.5-6.9-9.8-5.8C1.7,145.7-0.9,150.1,0.3,154.3z" fill="white"/>
      <polygon points="157,126.3 157,182.6 108.2,154.5 59.5,126.3 108.2,98.2 157,70" fill="none" stroke="white" strokeWidth="11.3386" strokeMiterlimit="10"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 6V12M12 12L9 9M12 12L15 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 16H16" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ExpandIcon component - Commented out to fix ESLint warning
/* function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 3H19C20.1046 3 21 3.89543 21 5V8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 21H19C20.1046 21 21 20.1046 21 19V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 21H5C3.89543 21 3 20.1046 3 19V16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
} */



// ChatIcon component for chat functionality - Commented out to fix ESLint warning
/* function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/>
    </svg>
  );
} */

export default function Home({ guideVideos, guideSlug }: { guideVideos: { backgroundVideoURL: string | null; welcomeVideoURL: string | null; systemPrompt: string | null; chatConfig?: { welcomeTitle?: string | null; button1Text?: string | null; button1Function?: string | null; button2Text?: string | null; button2Function?: string | null; button3Text?: string | null; button3Function?: string | null; downloadVideoEnabled?: boolean | null } | null; helpPoints?: { point1?: string | null; point2?: string | null; point3?: string | null; point4?: string | null; point5?: string | null } | null; humanChatEnabled?: boolean | null; faq?: { name: string; questions: { question: string; answer: string; }[] }[] | null; contactInfo?: { phoneNumber: string; address: string; callUsTitle: string; callUsDescription: string; visitUsTitle: string; visitUsDescription: string; liveChatTitle: string; liveChatDescription: string; liveChatButtonText: string; mapEmbedUrl: string; email?: string | null } | null; chatIconURL?: string | null }, guideSlug: string }) {
  // UI state variables
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showGuidePopup, setShowGuidePopup] = useState(false);
  const [isPromoMode, setIsPromoMode] = useState(false);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [showStartButton, setShowStartButton] = useState(true);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [showChatbotPopup, setShowChatbotPopup] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<Array<{from: 'user' | 'bot', text: string, metadata?: { fromChatbot?: boolean }}>>([]);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showChatbotWelcome, setShowChatbotWelcome] = useState(true);
  const [isAndroid, setIsAndroid] = useState(false);
  const [androidWelcomeHidden, setAndroidWelcomeHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Estados do vídeo principal
  const [mainVideoLoaded, setMainVideoLoaded] = useState(false);
  const [mainVideoLoading, setMainVideoLoading] = useState(false);
  const [mainVideoError, setMainVideoError] = useState(false);
  const [mainVideoProgress, setMainVideoProgress] = useState(0);

  // Estados de readiness dos vídeos de fundo (e progresso para compor a barra inicial)
  const [bgVideoReady, setBgVideoReady] = useState(false);
  const [welcomeBgReady, setWelcomeBgReady] = useState(false);
  const [bgVideoError, setBgVideoError] = useState(false);
  const [welcomeBgError, setWelcomeBgError] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [welcomeBgProgress, setWelcomeBgProgress] = useState(0);

  // Reescrever URL para streamer PHP quando vídeo estiver em visitfoods.pt
  const toStreamUrl = (url?: string | null) => {
    if (!url) return '';
    try {
      // Idempotência: se já está a usar o proxy `/vg-video/`, devolver como está
      if (url.includes('/vg-video/')) return url;
      const u = new URL(url, window.location.origin);
      // Apenas aplicar proxy para ficheiros hospedados em visitfoods
      if ((u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') && u.pathname !== '/vg-video/') {
        const pathOnly = u.pathname; // garantir que só passamos o caminho
        return `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(pathOnly)}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState(0);
  const [formName, setFormName] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreatingNewConversation, setIsCreatingNewConversation] = useState(false);
  
  // Contador de entradas no chat com guia real (para limite de 4 entradas)
  const [guideChatEntryCount, setGuideChatEntryCount] = useState(0);
  
  // Estado para bloquear sugestões de pergunta até receber resposta
  const [suggestionsBlocked, setSuggestionsBlocked] = useState(false);
  
  // Estado para controlar quando mostrar a mensagem de transição do guia real
  const [showTransitionMessage, setShowTransitionMessage] = useState(false);
  const [transitionMessageShown, setTransitionMessageShown] = useState<{[key: string]: boolean}>({});
  
  // Estados para o chat humano
  const [showHumanChat, setShowHumanChat] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [humanChatMessages, setHumanChatMessages] = useState<ExtendedChatMessage[]>([]);
  const [humanChatInput, setHumanChatInput] = useState('');
  
  // Flag para exigir formulário novamente quando regressa ao AI após ter usado o chat real
  const [returnedFromAiAfterHuman, setReturnedFromAiAfterHuman] = useState(false);

  const [humanChatSubmitting, setHumanChatSubmitting] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false); // Sempre começar com som ativado
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [pipVideoPlaying, setPipVideoPlaying] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  
  // Função para resetar a posição do PiP para a posição inicial
  const resetPipPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      // Detectar se é tablet (768px - 1024px) e ajustar posição
      const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
      const xOffset = isTablet ? 180 : 120; // Mais à esquerda em tablets
      setPipPosition({ x: window.innerWidth - xOffset, y: 20 });
    } else {
      setPipPosition({ x: 20, y: 20 });
    }
  }, []);
  
  // Atualizar posição inicial do PiP após montagem do componente (quando window está disponível)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      resetPipPosition();
    }
  }, [resetPipPosition]);

  // Resetar posição do PiP quando a orientação do dispositivo muda
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      // Aguardar um pouco para que o resize seja processado
      setTimeout(() => {
        resetPipPosition();
      }, 100);
    };

    const handleResize = () => {
      // Resetar posição do PiP quando a janela é redimensionada
      resetPipPosition();
    };

    // Adicionar listeners para mudanças de orientação e resize
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [resetPipPosition]);

  // Definir modo promo (mantém comportamento anterior sem afetar loaders)
  useEffect(() => {
    (async () => {
      try {
        setIsPromoMode(false);
      } catch {
        setIsPromoMode(false);
      }
    })();
  }, []);
  
  // Carregar contador de entradas no chat do localStorage
  useEffect(() => {
    const savedCount = localStorage.getItem('guideChatEntryCount');
    if (savedCount) {
      setGuideChatEntryCount(parseInt(savedCount, 10));
    }
  }, []);

  // Ligar eventos para saber quando os vídeos de fundo estão prontos
  useEffect(() => {
    const bg = bgVideoRef.current;
    const welcome = welcomeBgVideoRef.current;

    const onBgCanPlay = () => { setBgVideoReady(true); setBgProgress(100); };
    const onWelcomeCanPlay = () => { setWelcomeBgReady(true); setWelcomeBgProgress(100); };

    if (bg) {
      bg.addEventListener('canplaythrough', onBgCanPlay, { once: true });
    }
    if (welcome) {
      welcome.addEventListener('canplaythrough', onWelcomeCanPlay, { once: true });
    }

    return () => {
      if (bg) bg.removeEventListener('canplaythrough', onBgCanPlay as EventListener);
      if (welcome) welcome.removeEventListener('canplaythrough', onWelcomeCanPlay as EventListener);
    };
  }, [guideVideos?.backgroundVideoURL]);

  // Atualizar a barra de progresso inicial com base no progresso real dos vídeos
  useEffect(() => {
    const hasWelcomeVideo = !!(guideVideos?.welcomeVideoURL);
    const mainPart = hasWelcomeVideo ? (mainVideoError ? 100 : mainVideoProgress) : 100;
    const clamped = Math.max(0, Math.min(mainPart, 99));
    setLoadingProgress((prev) => (mainPart >= 100 ? 100 : Math.max(prev, clamped)));

    const mainReady = mainVideoLoaded || !hasWelcomeVideo || mainVideoError;
    if (mainReady) {
      setLoadingProgress(100);
      setIsLoading(false);
    }
  }, [guideVideos?.welcomeVideoURL, mainVideoProgress, mainVideoLoaded, mainVideoError]);

  // Carregar conversa do localStorage no início
  useEffect(() => {
    loadConversationFromStorage();
  }, []);

  // Estado de rede lenta deve existir antes de efeitos que o usam
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  // Pré-carregar o vídeo principal ao abrir o site
  useEffect(() => {
    const url = toStreamUrl(guideVideos?.welcomeVideoURL || '') || '';
    if (!url) return;

    setMainVideoLoading(true);
    setMainVideoError(false);
    setMainVideoProgress(10);

    // Em redes rápidas, ajudar com <link rel="preload">; em redes lentas, evitar overhead
    const link = document.createElement('link');
    if (!isSlowNetwork) {
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }

    // Vídeo oculto para pré-carregar
    const pre = document.createElement('video');
    pre.preload = isSlowNetwork ? 'metadata' : 'auto';
    pre.muted = true;
    pre.playsInline = true;
    pre.crossOrigin = 'anonymous';
    pre.src = url;
    pre.style.display = 'none';
    document.body.appendChild(pre);

    const onMeta = () => setMainVideoProgress(30);
    const onProgress = () => {
      if (pre.buffered.length > 0 && Number.isFinite(pre.duration) && pre.duration > 0) {
        const end = pre.buffered.end(pre.buffered.length - 1);
        const ratio = end / pre.duration;
        setMainVideoProgress(Math.min(99, 30 + ratio * 69));
        if (ratio >= 0.999) {
          setMainVideoProgress(100);
          setMainVideoLoaded(true);
          setMainVideoLoading(false);
        }
      }
    };
    const onCanPlay = () => {
      setMainVideoProgress(100);
      setMainVideoLoaded(true);
      setMainVideoLoading(false);
    };
    const onError = () => {
      setMainVideoError(true);
      setMainVideoLoading(false);
    };

    pre.addEventListener('loadedmetadata', onMeta);
    pre.addEventListener('progress', onProgress);
    pre.addEventListener('canplaythrough', onCanPlay);
    pre.addEventListener('error', onError);
    pre.load();

    // Em redes rápidas, pequeno HEAD para aquecer cache; em lentas, evitar pedido extra
    if (!isSlowNetwork) {
      fetch(url, { method: 'HEAD', mode: 'cors' }).catch(() => {});
    }

    return () => {
      try {
        pre.removeEventListener('loadedmetadata', onMeta);
        pre.removeEventListener('progress', onProgress);
        pre.removeEventListener('canplay', onCanPlay);
        pre.removeEventListener('error', onError);
        document.body.removeChild(pre);
        try { if (!isSlowNetwork) document.head.removeChild(link); } catch {}
      } catch {}
    };
  }, [guideVideos?.welcomeVideoURL, isSlowNetwork]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pipExpanded, setPipExpanded] = useState(false);
  const [pipVisible, setPipVisible] = useState(false);
  // Removido pipMuted pois o PiP sempre segue o vídeo principal
  const [savedVideoTime, setSavedVideoTime] = useState(0);
  const [shouldSaveTime, setShouldSaveTime] = useState(false);
  const [videoStateBeforeBlur, setVideoStateBeforeBlur] = useState({
    wasPlaying: false,
    currentTime: 0,
    wasMuted: false
  });
  const [pipStateBeforeBlur, setPipStateBeforeBlur] = useState({
    wasPlaying: false,
    currentTime: 0,
    wasMuted: false
  });
  const [pipManuallyClosed, setPipManuallyClosed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [preferHold, setPreferHold] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Guardar estado de som antes de abrir o formulário para restaurar depois
  const preFormMutedRef = useRef<boolean | null>(null);

  // Controlar vídeos quando popup de promoção estiver aberto
  useEffect(() => {
    // Em PC, não fazer nada - vídeos continuam sempre a reproduzir
    if (isDesktop) {
      return;
    }

    const forcePauseAll = () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
      if (bgVideoRef.current && !bgVideoRef.current.paused) {
        bgVideoRef.current.pause();
      }
      if (welcomeBgVideoRef.current && !welcomeBgVideoRef.current.paused) {
        welcomeBgVideoRef.current.pause();
      }
    };

    if (showPromoPopup) {
      // Pausar imediatamente e com retries curtos
      forcePauseAll();
      const t1 = setTimeout(forcePauseAll, 50);
      const t2 = setTimeout(forcePauseAll, 200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [showPromoPopup, isDesktop]);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const welcomeBgVideoRef = useRef<HTMLVideoElement>(null);
  const chatbotInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Âncoras para auto-scroll nas listas de mensagens
  const chatbotEndRef = useRef<HTMLDivElement | null>(null);
  const humanEndRef = useRef<HTMLDivElement | null>(null);
  // Chaves de cache em sessão para dados do formulário do chat humano
  const SESSION_NAME_KEY = 'vg_user_name';
  const SESSION_CONTACT_KEY = 'vg_user_contact';
  // preferHold controlado por estado dos chats (sem temporizador)

  // Helpers para atualizar estado e cache de sessão
  const updateFormName = (value: string) => {
    setFormName(value);
    try { sessionStorage.setItem(SESSION_NAME_KEY, value); } catch {}
  };
  const updateFormContact = (value: string) => {
    setFormContact(value);
    try { sessionStorage.setItem(SESSION_CONTACT_KEY, value); } catch {}
  };

  // Forçar legendas sempre ativas no vídeo principal e desativadas no PiP
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const enableCaptions = () => {
      try {
        const tracks = Array.from(videoEl.textTracks || []);
        tracks.forEach((track) => {
          track.mode = 'showing';
        });
      } catch {}
    };

    enableCaptions();
    videoEl.addEventListener('loadedmetadata', enableCaptions);
    videoEl.addEventListener('loadeddata', enableCaptions);

    return () => {
      videoEl.removeEventListener('loadedmetadata', enableCaptions);
      videoEl.removeEventListener('loadeddata', enableCaptions);
    };
  }, []);

  useEffect(() => {
    const pipEl = pipVideoRef.current;
    if (!pipEl) return;

    const disableCaptions = () => {
      try {
        const tracks = Array.from(pipEl.textTracks || []);
        tracks.forEach((track) => {
          track.mode = 'disabled';
        });
      } catch {}
    };

    disableCaptions();
    pipEl.addEventListener('loadedmetadata', disableCaptions);
    pipEl.addEventListener('loadeddata', disableCaptions);

    return () => {
      pipEl.removeEventListener('loadedmetadata', disableCaptions);
      pipEl.removeEventListener('loadeddata', disableCaptions);
    };
  }, []);

  // Otimização: preconnect/dns-prefetch para o host de vídeos (reduz handshake)
  useEffect(() => {
    try {
      const addLink = (rel: string, href: string, as?: string) => {
        const el = document.createElement('link');
        el.rel = rel;
        el.href = href;
        if (as) el.as = as as any;
        el.crossOrigin = 'anonymous';
        document.head.appendChild(el);
        return () => { try { document.head.removeChild(el); } catch {} };
      };
      const cleanups: Array<() => void> = [];
      cleanups.push(addLink('preconnect', 'https://visitfoods.pt'));
      cleanups.push(addLink('dns-prefetch', 'https://visitfoods.pt'));
      return () => { cleanups.forEach(fn => fn()); };
    } catch {}
  }, []);

  // Otimização: preload do vídeo do PiP e prewarm de conexão
  useEffect(() => {
    const url = toStreamUrl(guideVideos?.welcomeVideoURL || '') || '';
    if (!url || isDesktop || isSlowNetwork) return; // Em redes lentas, não fazer prewarm
    try {
      // Inserir <link rel="preload" as="video">
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);

      // Tentar um prewarm leve com Range 0-0 para abrir a ligação e popular cache
      fetch(url, { headers: { Range: 'bytes=0-0' } }).catch(() => {});

      return () => { try { document.head.removeChild(link); } catch {} };
    } catch {}
  }, [guideVideos?.welcomeVideoURL, isDesktop, isSlowNetwork]);

  // Pré-carregar o vídeo do PiP: agressivo em redes rápidas, conservador em redes lentas
  useEffect(() => {
    const v = pipVideoRef.current;
    if (!v) return;
    try {
      if (isSlowNetwork) {
        v.preload = 'metadata';
        // Em redes lentas, não chamar load() proactivamente
      } else {
        v.preload = 'auto';
        // Forçar o browser a preparar o vídeo (não bloqueante)
        if (v.readyState < 2) v.load();
      }
    } catch {}
  }, [guideVideos?.welcomeVideoURL, isSlowNetwork]);

  // Verificação inicial de cookies - limpar cookies inválidos
  useEffect(() => {
    let conversationId: string | null = getCookie('chat_conversation_id');
    const userName = getCookie('chat_user_name');
    const userContact = getCookie('chat_user_contact');
    
    // Se há cookies parciais (alguns existem, outros não), limpar todos
    if ((conversationId && !userName) || (conversationId && !userContact) || 
        (userName && !conversationId) || (userContact && !conversationId)) {
      deleteCookie('chat_conversation_id');
      deleteCookie('chat_user_name');
      deleteCookie('chat_user_contact');
      setHasActiveSession(false);
      setHumanChatMessages([]);
      setCurrentConversation(null);
    }
  }, []);

  // Capturar cliques em links antes do PiP interferir
  useEffect(() => {
    const handleLinkClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
        event.stopPropagation();
        event.preventDefault();
        // Não abrir link específico de PP
        return;
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
        event.stopPropagation();
        event.preventDefault();
        return; // bloquear link de PP
      }
      // Não prevenir eventos touch para outros elementos - permitir scroll normal
    };

    // Adicionar event listeners ao documento com capture para capturar antes do PiP
    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('touchstart', handleTouchStart, true);
    document.addEventListener('mousedown', handleLinkClick, true);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('mousedown', handleLinkClick, true);
    };
  }, []);

  // Log dos links encontrados - Commented out to fix ESLint warning
  /* useEffect(() => {
    const logLinks = () => {
      const links = document.querySelectorAll('a[href*="bymeoblueticket"]');
      // Logs removidos para limpeza do console
    };

    // Executar após um pequeno delay para garantir que o DOM foi atualizado
    const timer = setTimeout(logLinks, 100);
    
    // Também executar quando as mensagens mudarem
    const observer = new MutationObserver(logLinks);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [chatbotMessages, humanChatMessages]); */

  // Deteção de Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/.test(userAgent);
    setIsAndroid(isAndroidDevice);
  }, []);

  // Pré-preencher formulário do chat humano a partir de cookies/sessionStorage
  useEffect(() => {
    try {
      const cookieName = getCookie('chat_user_name');
      const cookieContact = getCookie('chat_user_contact');
      const ssName = sessionStorage.getItem(SESSION_NAME_KEY) || '';
      const ssContact = sessionStorage.getItem(SESSION_CONTACT_KEY) || '';
      if (!formName && (cookieName || ssName)) setFormName(cookieName || ssName);
      if (!formContact && (cookieContact || ssContact)) setFormContact(cookieContact || ssContact);
    } catch {}
  }, []);

  // Auto-scroll: chatbot (AI)
  useEffect(() => {
    try {
      const el = chatbotEndRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch {}
  }, [chatbotMessages, showChatbotPopup]);

  // Auto-scroll: chat humano
  useEffect(() => {
    try {
      const el = humanEndRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch {}
  }, [humanChatMessages, showHumanChat]);

  // Em desktop, manter hold enquanto não houver nenhum chat aberto
  useEffect(() => {
    if (!isDesktop) return;
    // Se qualquer chat estiver aberto, não preferir hold; caso contrário, preferir
    setPreferHold(!showHumanChat && !showChatbotPopup);
    return () => {};
  }, [showHumanChat, showChatbotPopup, isDesktop]);

  // Deteção de rede lenta (2g/3g, poupança de dados, downlink baixo)
  useEffect(() => {
    try {
      const nav: any = navigator as any;
      const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
      const et: string | undefined = conn?.effectiveType;
      const saveData: boolean | undefined = conn?.saveData;
      const downlink: number | undefined = conn?.downlink;
      const slow = (et && /2g|3g/.test(et)) || saveData === true || (typeof downlink === 'number' && downlink > 0 && downlink < 2);
      setIsSlowNetwork(!!slow);
      if (conn && typeof conn.addEventListener === 'function') {
        const handler = () => {
          const et2: string | undefined = conn?.effectiveType;
          const save2: boolean | undefined = conn?.saveData;
          const dl2: number | undefined = conn?.downlink;
          const slow2 = (et2 && /2g|3g/.test(et2)) || save2 === true || (typeof dl2 === 'number' && dl2 > 0 && dl2 < 2);
          setIsSlowNetwork(!!slow2);
        };
        conn.addEventListener('change', handler);
        return () => conn.removeEventListener('change', handler);
      }
    } catch {}
  }, []);



  // Detectar refresh da página e limpar mensagens do chatbot
  useEffect(() => {
    // Detectar refresh usando múltiplos métodos para compatibilidade
    const isRefresh = (
      // Método 1: performance.navigation (deprecated mas ainda funciona em alguns browsers)
      (performance.navigation && performance.navigation.type === 1) ||
      // Método 2: Verificar se a página foi carregada do cache
      (performance.getEntriesByType && (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload') ||
      // Método 3: Verificar se há entrada de navigation
      (performance.getEntriesByType && performance.getEntriesByType('navigation').length > 0)
    );
    
    // Detectar se é iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isRefresh || isIOS) {
      setChatbotMessages([]);
      setShowInstructions(true);
      setShowChatbotWelcome(true);
      
      // Em qualquer refresh, encerrar sessão ativa do chat humano
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada no refresh').catch(error => {
          console.error('Erro ao encerrar conversa no refresh:', error);
        });
        
        // Limpar cookies e estado local
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
        
        setHasActiveSession(false);
        setHumanChatMessages([]);
        setCurrentConversation(null);
        setShowHumanChat(false);
        
        // Limpeza adicional em iOS
        if (isIOS) {
          sessionStorage.removeItem('mobile_session_checked');
        }
      }
    }
  }, []);
  
  // Detectar se é um carregamento inicial em mobile com sessão existente
  useEffect(() => {
    // Só executar uma vez no carregamento inicial
    const isInitialLoad = !sessionStorage.getItem('mobile_session_checked');
    
    if (isInitialLoad && isMobile) {
      const conversationId = getCookie('chat_conversation_id');
      const userName = getCookie('chat_user_name');
      const userContact = getCookie('chat_user_contact');
      
      // Se há uma sessão completa em mobile, marcar como verificada
      if (conversationId && userName && userContact) {
        sessionStorage.setItem('mobile_session_checked', 'true');
      }
    }
  }, [isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpeza específica para iOS no carregamento inicial
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isIOS) {
      // Em iOS, sempre limpar sessão no carregamento inicial para evitar problemas
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        // Encerrar conversa no servidor
        closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada no carregamento iOS').catch(error => {
          console.error('Erro ao encerrar conversa no carregamento iOS:', error);
        });
        
        // Limpar cookies e estado
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
        
        setHasActiveSession(false);
        setHumanChatMessages([]);
        setCurrentConversation(null);
        setShowHumanChat(false);
        
        // Limpar sessionStorage
        sessionStorage.removeItem('mobile_session_checked');
      }
    }
  }, []);

  // Função global para abrir guia real
  useEffect(() => {
    (window as { openGuiaReal?: () => void }).openGuiaReal = () => {
      // Fechar o chatbot AI se estiver aberto
      if (showChatbotPopup) {
        setShowChatbotPopup(false);
      }
      
      // Verificar se já existe uma sessão ativa
      const conversationId = getCookie('chat_conversation_id');
      const userName = getCookie('chat_user_name');
      const userContact = getCookie('chat_user_contact');
      
      if (conversationId && userName && userContact) {
        // Se regressou do AI após ter usado o guia real, exigir formulário novamente
        if (returnedFromAiAfterHuman) {
          setShowGuidePopup(true);
          setShowHumanChat(false);
          setShowActionButtons(false);
          return;
        }
        // Se já existe sessão, abrir o chat diretamente
        setShowHumanChat(true);
        setShowActionButtons(true); // Mostrar controladores quando chat humano abre
        
        // Em PC, continuar o vídeo de onde está quando o chat do guia real for aberto
        if (videoRef.current) {
          if (isDesktop) {
            // Desktop: Continuar o vídeo de onde está
            if (videoRef.current.paused) {
              videoRef.current.play();
              setVideoPlaying(true);
            }
          } else {
            // Mobile: Guardar o tempo atual para sincronização com PiP
            const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
            // Não pausar o vídeo principal aqui - deixar o useEffect do PiP gerenciar
          }
        }
        
        // Configurar listener para a conversa existente
        if (!currentConversation) {
          unsubscribeRef.current = listenToGuideConversation('virtualguide-teste', conversationId, (conv) => {
            setCurrentConversation(conv as unknown as Conversation);
            setHumanChatMessages((conv as any).messages as unknown as ChatMessage[]);
            
            // Verificar se a conversa foi encerrada pelo backoffice
            if ((conv as any).status === 'closed') {
              
              // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
              const conversationAge = Date.now() - (conv.createdAt ? (conv.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
              const isRecentlyCreated = conversationAge < 30000; // 30 segundos
              
              if (isRecentlyCreated) {
                console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
                return; // Não fechar conversas recém-criadas
              }
              
              // Fechar o chat após alguns segundos
              setTimeout(() => {
                              // Limpar listener
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
              
              // Restaurar scroll
              document.body.style.overflow = 'auto';
              // No Android, forçar um reflow para garantir que o scroll seja restaurado
              if (/android/i.test(navigator.userAgent)) {
                void document.body.offsetHeight; // Trigger reflow
              }
              
              // Fechar chat e limpar estado
              setShowHumanChat(false);
              setCurrentConversation(null);
              setHumanChatMessages([]);
              setHumanChatInput('');
              setHasActiveSession(false);
              
              // Limpar cookies
              deleteCookie('chat_conversation_id');
              deleteCookie('chat_user_name');
              deleteCookie('chat_user_contact');
              
              // Controlar vídeo baseado no dispositivo
              if (videoRef.current) {
                if (isDesktop) {
                  // PC: Parar vídeo
                  videoRef.current.pause();
                  setVideoPlaying(false);
                } else {
                  // Smartphone: Continuar vídeo onde estava
                  videoRef.current.muted = videoMuted; // Respeitar preferência salva
                  setVideoMuted(videoMuted);
                  videoRef.current.play();
                  setVideoPlaying(true);
                }
              }
              
              // Fechar outros popups se estiverem abertos
              if (showGuidePopup) {
                setShowGuidePopup(false);
              }
              if (showChatbotPopup) {
                setShowChatbotPopup(false);
              }
              
            }, 3000); // Aguardar 3 segundos antes de fechar
            }
          });
        }
      } else {
        // Se não existe sessão, mostrar popup para preencher dados
        setShowGuidePopup(true);
        
        // Parar o vídeo principal quando o formulário for aberto (não alterar estado global de som)
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            setVideoPlaying(false);
          } catch {}
        }
      }
    };
    
    return () => {
      delete (window as { openGuiaReal?: () => void }).openGuiaReal;
    };
  }, [showChatbotPopup, currentConversation, isDesktop, showGuidePopup, returnedFromAiAfterHuman]);

  // Detectar se é desktop
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
        setIsDesktop(width >= 1025);
        setIsTablet(width >= 768 && width <= 1024);
        setIsMobile(width < 768);
    };
    
    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    
    return () => {
      window.removeEventListener('resize', checkDeviceType);
    };
  }, []);

  // Controlar scroll da página quando chatbot está aberto
  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    
    if (showChatbotPopup || showHumanChat) {
      document.body.style.overflow = 'hidden';
              // No Android, forçar um reflow para garantir que o scroll seja bloqueado
        if (isAndroid) {
          void document.body.offsetHeight; // Trigger reflow
        }
    } else {
      document.body.style.overflow = 'auto';
      // No Android, forçar um reflow para garantir que o scroll seja restaurado
      if (isAndroid) {
        void document.body.offsetHeight; // Trigger reflow
      }
    }

    // Cleanup quando componente desmonta
    return () => {
      document.body.style.overflow = 'auto';
      // No Android, garantir que o scroll seja restaurado no cleanup
      if (isAndroid) {
        void document.body.offsetHeight; // Trigger reflow
      }
    };
  }, [showChatbotPopup, showHumanChat]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Pausar vídeo quando popups estiverem abertos
  useEffect(() => {
    if (videoRef.current) {
      if (showGuidePopup || showPromoPopup) {
        // Pausar vídeo quando popups abrem
        if (!videoRef.current.paused) {
          videoRef.current.pause();
          setVideoPlaying(false);
        }
      } else {
        // Retomar vídeo quando popups fecham (apenas se não estiver em modo desktop)
        if (videoRef.current.paused && !isDesktop) {
          videoRef.current.play();
          setVideoPlaying(true);
        }
      }
    }
  }, [showGuidePopup, showPromoPopup, isDesktop]);
  
  // Detectar dispositivos iOS e aplicar correções específicas
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as {MSStream?: boolean}).MSStream;
    
    if (isIOS) {
      
      // Adicionar meta viewport para evitar problemas com zoom
      let viewportMeta = document.querySelector('meta[name="viewport"]');
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.setAttribute('name', 'viewport');
        document.head.appendChild(viewportMeta);
      }
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      
      // Adicionar classe específica para iOS no body
      document.body.classList.add('ios-device');
      
      // Corrigir o problema de altura em iOS
      const setIOSHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
      };
      
      setIOSHeight();
      window.addEventListener('resize', setIOSHeight);
      window.addEventListener('orientationchange', setIOSHeight);
      
      // Adicionar regras CSS específicas para iOS
      const style = document.createElement('style');
      style.innerHTML = `
        .ios-device .fixedBottomContainer,
        .ios-device .page-module___8aEwW__fixedBottomContainer {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 9999 !important;
          display: flex !important;
          flex-direction: column !important;
          background: rgba(255, 255, 255, 0.95) !important;
          padding-bottom: env(safe-area-inset-bottom, 0px) !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .ios-device .chatbotInputBar,
        .ios-device .page-module___8aEwW__chatbotInputBar {
          position: relative !important;
          bottom: auto !important;
          left: auto !important;
          right: auto !important;
          z-index: auto !important;
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
          background: rgba(255, 255, 255, 0.9) !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin-bottom: 0 !important;
        }
        
        .ios-device .guideRealLinkContainer,
        .ios-device .page-module___8aEwW__guideRealLinkContainer {
          display: flex !important;
          justify-content: center !important;
          padding: 12px 20px !important;
          background: rgba(255, 255, 255, 0.95) !important;
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
          padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: relative !important;
        }
        
        .ios-device .guideRealLink,
        .ios-device .page-module___8aEwW__guideRealLink {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          background: #000000 !important;
          color: #ffffff !important;
          border: none !important;
          padding: 12px 24px !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          font-size: 14px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }
        
        .ios-device .chatbotPopup {
          height: 100vh !important;
          height: calc(var(--vh, 1vh) * 100) !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          border-bottom: none !important;
          background-color: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        /* Remover qualquer barra cinzenta no fundo do chat */
        .ios-device .chatbotBottomBar,
        .ios-device .page-module___8aEwW__chatbotBottomBar {
          display: none !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          background: transparent !important;
        }
        
        .ios-device .chatbotContent,
        .ios-device .page-module___8aEwW__chatbotContent {
          height: calc(100vh - 120px) !important;
          height: calc(var(--vh, 1vh) * 100 - 120px) !important;
          padding-bottom: 0 !important;
        }
        
        .ios-device .chatbotMessages,
        .ios-device .page-module___8aEwW__chatbotMessages {
          padding-bottom: 0 !important;
          border-bottom: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          margin-bottom: 0 !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
      `;      
      document.head.appendChild(style);
      
      return () => {
        window.removeEventListener('resize', setIOSHeight);
        window.removeEventListener('orientationchange', setIOSHeight);
        document.head.removeChild(style);
      };
    }
  }, []);

  // Verificar se há uma sessão ativa do chat
  useEffect(() => {
    let conversationId: string | null = getCookie('chat_conversation_id');
    const userName = getCookie('chat_user_name');
    const userContact = getCookie('chat_user_contact');
    
    if (conversationId && userName && userContact) {
      setHasActiveSession(true);
      
              // Configurar listener para a conversa existente quando o chat estiver aberto
        if (showHumanChat && !isCreatingNewConversation) {
          console.log('🔍 Configurando listener para conversa existente:', conversationId);
          unsubscribeRef.current = listenToGuideConversation('virtualguide-teste', conversationId, (conversation) => {
          // Verificar se a conversa foi fechada no backoffice
            if ((conversation as any).status === 'closed') {
            
            // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
            const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
            const isRecentlyCreated = conversationAge < 30000; // 30 segundos
            
            if (isRecentlyCreated) {
              console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
              return; // Não fechar conversas recém-criadas
            }
            
            // Verificar se já existe a mensagem de despedida (independente de 'agent'/'guide')
              const closingMessageText = "Agradecemos o seu contacto. Esta conversa fica agora encerrada. Caso necessite de mais informações, estaremos sempre ao dispor. Desejamos-lhe um excelente dia!";
              const hasClosingMessage = (conversation as any).messages?.some((m: any) => (
                (m?.metadata?.closingMessage === true) || ((m.from === 'agent' || m.from === 'guide') && m.text === closingMessageText)
              ));

              // Atualizar as mensagens para mostrar todas, incluindo a de despedida
              setCurrentConversation(conversation as unknown as Conversation);
              setHumanChatMessages((conversation as any).messages as unknown as ChatMessage[]);

            // Se ainda não existir mensagem de despedida, adicioná-la
            if (!hasClosingMessage) {
              // Enviar a mensagem de despedida usando guideServices
              sendGuideMessage('virtualguide-teste', conversationId, {
                from: 'guide',
                text: closingMessageText,
                metadata: { guideResponse: true, closingMessage: true }
              }).catch(err => console.error('Erro ao enviar mensagem de despedida:', err));
              
              // Não fechar o chat ainda, deixar o usuário ver a mensagem
              return;
            }
            
            // Definir um timeout para fechar o chat após 10 segundos
            setTimeout(() => {
              // Limpar a sessão local
              deleteCookie('chat_conversation_id');
              deleteCookie('chat_user_name');
              deleteCookie('chat_user_contact');
              
              setHasActiveSession(false);
              setShowHumanChat(false);
              setCurrentConversation(null);
              setHumanChatMessages([]);
              
              // Limpar o listener
              if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
              }
              
              // Controlar vídeo baseado no dispositivo
              if (videoRef.current) {
                if (isDesktop) {
                  // PC: Parar vídeo
                  videoRef.current.pause();
                  setVideoPlaying(false);
                } else {
                  // Smartphone: Continuar vídeo onde estava
                  videoRef.current.muted = videoMuted; // Respeitar preferência salva
                  setVideoMuted(videoMuted);
                  videoRef.current.play();
                  setVideoPlaying(true);
                }
              }
              
              // Fechar outros popups se estiverem abertos
              if (showGuidePopup) {
                setShowGuidePopup(false);
              }
              if (showChatbotPopup) {
                setShowChatbotPopup(false);
              }
              
            }, 10000); // 10 segundos
            
            return; // Sair para não atualizar os estados novamente
          }
          
          // Atualizar estados normalmente se a conversa ainda estiver ativa
          // Converter mensagens para o formato local para garantir compatibilidade
          const localMessages = (conversation as any).messages?.map((msg: any) => ({
            id: msg.id,
            from: msg.from === 'guide' ? 'agent' : 'user',
            text: msg.text,
            timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            read: msg.read || false,
            metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
          })) || [];
          
          console.log('🔍 Listener recebeu conversa:', conversation);
          console.log('🔍 Mensagens convertidas:', localMessages);
          console.log('🔍 Número de mensagens:', localMessages.length);
          
          setCurrentConversation(conversation as unknown as Conversation);
          // Filtrar mensagem de transição gravada anteriormente caso não exista interação real com o chatbot
          const hasChatbotQuestion = (conversation as any).messages?.some((msg: any) =>
            msg.from === 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
          );
          const hasChatbotAnswer = (conversation as any).messages?.some((msg: any) =>
            (msg.from === 'guide' || msg.from === 'agent') && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
          );
          const hasChatbotInteraction = Boolean(hasChatbotQuestion && hasChatbotAnswer);

          const transitionText = 'Vejo que já falou com o nosso guia virtual. A partir daqui será a guia real a responder';
          const filteredLocalMessages = hasChatbotInteraction
            ? localMessages
            : localMessages.filter((m: any) => (
                m?.metadata?.isTransitionMessage === true
                  ? false
                  : (typeof m?.text === 'string' ? m.text.trim() !== transitionText : true)
              ));
          setHumanChatMessages(filteredLocalMessages as ExtendedChatMessage[]);
          
          // Verificar se o gestor abriu a conversa (para mostrar a mensagem de transição)
          // Só mostrar quando o gestor realmente abrir a conversa no backoffice E se o utilizador falou com o guia AI
          if ((conversation as any).status === 'active' && (conversation as any).metadata?.viewedByGuide === true) {
            console.log('🔍 Verificando se gestor abriu conversa:', {
              status: (conversation as any).status,
              metadata: (conversation as any).metadata,
              viewedByGuide: (conversation as any).metadata?.viewedByGuide
            });
            
            // Verificar se existiu uma interação real com o chatbot (pergunta do utilizador e resposta do bot)
            const hasChatbotQuestion = (conversation as any).messages.some((msg: any) =>
              msg.from === 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
            );
            const hasChatbotAnswer = (conversation as any).messages.some((msg: any) =>
              (msg.from === 'guide' || msg.from === 'agent') && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
            );
            const hasChatbotInteraction = hasChatbotQuestion && hasChatbotAnswer;
            
            if (hasChatbotInteraction) {
              // O gestor abriu a conversa no backoffice, adicionar a mensagem de transição
              const transitionMessage: ExtendedChatMessage = {
                from: 'agent',
                text: 'Vejo que já falou com o nosso guia virtual. A partir daqui será a guia real a responder',
                timestamp: new Date().toISOString(),
                read: false,
                metadata: { 
                  showWhenOpenedByGuide: true,
                  isTransitionMessage: true 
                }
              };
              
              // Verificar se a mensagem já foi mostrada para esta conversa
              const conversationId = (conversation as any).id;
              if (!transitionMessageShown[conversationId]) {
                // Adicionar a mensagem de transição ao estado local
                setHumanChatMessages(prev => {
                  const hasTransitionMessage = prev.some(msg => 
                    msg.metadata?.isTransitionMessage === true
                  );
                  
                  if (!hasTransitionMessage) {
                    console.log('🔍 Adicionando mensagem de transição ao estado local');
                    // Marcar que a mensagem foi mostrada para esta conversa
                    setTransitionMessageShown(prev => ({
                      ...prev,
                      [conversationId]: true
                    }));
                    return [...prev, transitionMessage];
                  }
                  console.log('🔍 Mensagem de transição já existe, não adicionando duplicada');
                  return prev;
                });
              } else {
                console.log('🔍 Mensagem de transição já foi mostrada para esta conversa');
              }
              
              setShowTransitionMessage(true);
            } else {
              console.log('🔍 Utilizador não falou com guia AI - não mostrando mensagem de transição');
            }
          }
        });
      }
    } else {
      setHasActiveSession(false);
      // Garantir que as mensagens estão limpas se não há sessão ativa
      setHumanChatMessages([]);
      setCurrentConversation(null);
    }
    
    // Limpar listener e estado quando o componente desmontar ou quando o chat fechar
    return () => {
      console.log('🧹 Limpando recursos ao desmontar componente');
      if (unsubscribeRef.current) {
        console.log('🔄 Removendo listener de conversa');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // Garantir que flags de estado são limpas
      setIsCreatingNewConversation(false);
      setShowTransitionMessage(false);
      // Limpar estado da mensagem de transição para esta conversa
      const conversationId = getCookie('chat_conversation_id');
      if (conversationId) {
        setTransitionMessageShown(prev => {
          const newState = { ...prev };
          delete newState[conversationId];
          return newState;
        });
      }
    };
  }, [showHumanChat, hasActiveSession]); // Executar quando o estado do chat ou sessão mudar

      // Verificar periodicamente se a conversa ainda está ativa, mas apenas quando o chat NÃO está aberto
  useEffect(() => {
    let conversationId: string | null = getCookie('chat_conversation_id');
    
    // Se não houver uma conversa ativa, se o chat estiver aberto, ou se estiver criando uma nova conversa, não verificar
    // Se o ID da conversa tiver sido marcado como 'CLOSED' previamente, limpar para não fechar o chat ao reabrir
    if (conversationId === 'CLOSED') {
      deleteCookie('chat_conversation_id');
      conversationId = null as any;
    }

    if (!conversationId || showHumanChat || isCreatingNewConversation) {
      console.log('🔍 Pulando verificação de status:', 
        !conversationId ? 'sem conversa' : 
        showHumanChat ? 'chat aberto' : 
        'criando conversa'
      );
      return;
    }
    
    // Verificar o estado da conversa imediatamente
    const checkConversationStatus = async () => {
      try {
        // Usar getGuideConversation para verificar o estado da conversa no Firebase virtualguide-teste
        const conversation = await getGuideConversation('virtualguide-teste', conversationId);
        
        // Se a conversa foi fechada no backoffice
        if ((conversation as any).status === 'closed') {
          console.log('Conversa foi fechada no backoffice.');
          
          // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
          const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
          const isRecentlyCreated = conversationAge < 30000; // 30 segundos
          
          if (isRecentlyCreated) {
            console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
            return; // Não fechar conversas recém-criadas
          }
          
          // Se o chat não estiver aberto, simplesmente limpar os cookies
          if (!showHumanChat) {
            deleteCookie('chat_conversation_id');
            deleteCookie('chat_user_name');
            deleteCookie('chat_user_contact');
            
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }
          // Se o chat estiver aberto, não fazemos nada aqui, pois o outro useEffect já cuida disso
        } else {
          // Se a conversa ainda está ativa, verificar se os cookies ainda existem
          const currentConversationId = getCookie('chat_conversation_id');
          if (!currentConversationId) {
            console.log('Cookies foram limpos - limpando estado local');
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar estado da conversa:', error);
        
        // IMPORTANTE: Se a conversa não for encontrada, pode ser uma conversa recém-criada
        // ou um problema de sincronização. Vamos aguardar um pouco antes de limpar tudo
        if (error instanceof Error && error.message.includes('Conversa não encontrada')) {
          console.log('🔄 Conversa não encontrada - pode ser uma conversa recém-criada. Aguardando...');
          
          // Se o chat estiver aberto, não limpar imediatamente
          if (showHumanChat) {
            console.log('💬 Chat está aberto - mantendo estado atual por mais tempo');
            return;
          }
          
          // Se o chat não estiver aberto, aguardar um pouco mais antes de limpar
          setTimeout(() => {
            console.log('⏰ Verificação atrasada - limpando cookies após conversa não encontrada');
            deleteCookie('chat_conversation_id');
            deleteCookie('chat_user_name');
            deleteCookie('chat_user_contact');
            
            setHasActiveSession(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
          }, 10000); // Aguardar 10 segundos antes de limpar
        }
      }
    };
    
    // Verificar após um delay inicial de 10 segundos
    const initialTimeout = setTimeout(checkConversationStatus, 10000);
    
    // Configurar verificação periódica (a cada 5 minutos)
    const intervalId = setInterval(checkConversationStatus, 300000); // 5 minutos
    
    // Limpar o intervalo e o timeout quando o componente desmontar
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [hasActiveSession, showHumanChat, showChatbotPopup, showGuidePopup, isCreatingNewConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Controlar vídeo PiP quando chats abrem em mobile
  useEffect(() => {

    // Visibilidade do PiP: só mostrar em mobile quando um chat está aberto
    const shouldShowPip = !isDesktop && (showChatbotPopup || showHumanChat) && !showGuidePopup && !pipManuallyClosed;
    const shouldHidePip = !shouldShowPip;
    
    // 1. Formulário guia: pausar vídeo principal (sem PiP)
    if (!isDesktop && showGuidePopup) {
      setPipVisible(false);
      if (videoRef.current) {
        try {
          const currentTime = videoRef.current.currentTime;
          setSavedVideoTime(currentTime);
          videoRef.current.pause();
          setVideoPlaying(false);
        } catch {}
      }
    }
    // 2. Chats abertos: mostrar PiP e PAUSAR o principal (garantir um de cada vez)
    else if (shouldShowPip) {
      // Pausar o vídeo principal para não coexistirem dois vídeos em reprodução
      if (videoRef.current && !videoRef.current.paused) {
        try { videoRef.current.pause(); } catch {}
        setVideoPlaying(false);
      }
      // Mostrar PiP se ainda não visível
      if (!pipVisible) {
        console.log('🎬 Mostrando PiP para chat');
        setPipVisible(true);
        setShouldSaveTime(true);
      }
      // Tentar garantir que o PiP está a reproduzir do ponto correto
      if (pipVideoRef.current) {
        const pip = pipVideoRef.current;
        try {
          // Sincronizar tempo com o último conhecido do principal
          const t = (videoRef.current?.currentTime ?? savedVideoTime ?? 0);
          if (!Number.isNaN(t) && Math.abs((pip.currentTime || 0) - t) > 0.2) {
            pip.currentTime = t;
          }
          // Se está pausado, tentar iniciar (mute se necessário por política)
          if (pip.paused) {
            // Usar o estado de mute anterior
            const targetMuted = preFormMutedRef.current ?? videoMuted;
            pip.muted = targetMuted;
            pip.volume = targetMuted ? 0 : 1;
            console.log('🔊 PiP - Restaurando estado de som:', targetMuted);
            
            // Otimista: mostrar ícone de pausa enquanto tentamos iniciar
            setPipVideoPlaying(true);
            pip.play()
              .then(() => {
                setPipVideoPlaying(true);
                setVideoMuted(targetMuted); // Sincronizar estado
              })
              .catch(() => {
                // fallback: tentar em mute e depois restaurar
                pip.muted = true;
                pip.volume = 0;
                pip.play()
                  .then(() => {
                    // Tentar restaurar o som após um pequeno delay
                    setTimeout(() => {
                      if (!targetMuted) {
                        try {
                          pip.muted = false;
                          pip.volume = 1;
                          setVideoMuted(false);
                        } catch {}
                      }
                    }, 100);
                    setPipVideoPlaying(true);
                  })
                  .catch(() => setPipVideoPlaying(false));
              });
          } else {
            // Já está a reproduzir
            setPipVideoPlaying(true);
          }
        } catch {}
      }
    }
    // 3. Chats fechados: esconder PiP e RETOMAR principal
    else if (shouldHidePip && pipVisible) {
      console.log('🎬 Escondendo PiP e retomando vídeo principal');
      setPipVisible(false);
      
      // Resetar o flag de fechamento manual quando todos os chats fecham
      if (!showChatbotPopup && !showHumanChat && !showGuidePopup) {
        setPipManuallyClosed(false);
      }
      
      // Retomar o vídeo principal quando chat ou formulário fecha em mobile
      if (!isDesktop && videoRef.current && !showGuidePopup && !showChatbotPopup && !showHumanChat) {
        try {
          // Usar o tempo do PiP se disponível, ou o tempo salvo anteriormente
          const currentTime = pipVideoRef.current?.currentTime || savedVideoTime || 0;
          // Ajuste fino para compensar latência
          videoRef.current.currentTime = Math.max(0, currentTime - 0.05);
          
          // Restaurar estado de som do vídeo principal
          const targetMuted = preFormMutedRef.current ?? videoMuted;
          videoRef.current.muted = targetMuted;
          videoRef.current.volume = targetMuted ? 0 : 1;
          console.log('🔊 Restaurando estado de som ao fechar PiP:', targetMuted);
          
          // Retomar reprodução do vídeo principal se não estiver em mute
          if (!targetMuted) {
            videoRef.current.play()
              .then(() => {
                setVideoPlaying(true);
                setVideoMuted(targetMuted);
              })
              .catch(error => console.error('Erro ao retomar vídeo principal:', error));
          }
          
          // Limpar a referência do estado de som
          setTimeout(() => {
            preFormMutedRef.current = null;
            console.log('🔊 Estado de som limpo após fechar PiP');
          }, 200);
        } catch (e) {
          console.error('Erro ao retomar vídeo principal:', e);
        }
      }

      // Parar vídeo PiP quando chat fecha
      if (pipVideoRef.current) {
        try { 
          pipVideoRef.current.pause();
          setPipVideoPlaying(false);
        } catch {}
      }
    }
  }, [showChatbotPopup, showHumanChat, showGuidePopup, isDesktop, pipVisible, pipManuallyClosed]);

  // Guardar o tempo do vídeo quando o chat ou formulário fecha (não quando PiP é fechado manualmente)
  useEffect(() => {
    // Só guardar o tempo se o PiP estava visível e o chat fechou (não quando PiP é fechado manualmente)
    if (!isDesktop && !showChatbotPopup && !showHumanChat && !showGuidePopup && videoRef.current && shouldSaveTime) {
      const currentTime = videoRef.current.currentTime;
      setSavedVideoTime(currentTime);
      setShouldSaveTime(false);
    }
  }, [showChatbotPopup, showHumanChat, showGuidePopup, isDesktop, shouldSaveTime, savedVideoTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garantir em smartphone: quando o formulário de contacto abre, o vídeo principal é pausado e silenciado
  useEffect(() => {
    if (isDesktop) return;
    
    if (showGuidePopup) {
      (async () => {
      try {
        // Sempre guardar o estado atual do som quando o formulário abre
        const currentMuted = videoRef.current ? videoRef.current.muted : videoMuted;
        preFormMutedRef.current = currentMuted;
        console.log('🔊 Estado de som guardado antes do formulário:', currentMuted);
        
        // Pausar e silenciar todos os vídeos possíveis em mobile de forma segura
        const safelyPauseAndMute = async (v: HTMLVideoElement | null) => {
          if (!v) return;
          try {
            // Primeiro mutar o vídeo para evitar problemas de autoplay
            v.volume = 0;
            v.muted = true;
            
            // Esperar um momento antes de pausar para evitar AbortError
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Só pausar se ainda estiver a tocar
            if (!v.paused) {
              try {
                await v.pause();
              } catch {}
            }
            
            console.log('🔊 Vídeo pausado e mutado com sucesso:', {
              paused: v.paused,
              muted: v.muted,
              volume: v.volume
            });
          } catch (error) {
            console.error('Erro ao pausar e mutar vídeo:', error);
          }
        };
        
        // Executar as operações em sequência para evitar conflitos
        await safelyPauseAndMute(videoRef.current);
        await safelyPauseAndMute(pipVideoRef.current);
        await safelyPauseAndMute(bgVideoRef.current);
        await safelyPauseAndMute(welcomeBgVideoRef.current);
        
        setVideoPlaying(false);
        setVideoMuted(true);
      } catch (error) {
        console.error('Erro ao controlar som do formulário:', error);
      }
      })();
    }
    // Não limpar preFormMutedRef.current aqui - será limpo após restauração
  }, [showGuidePopup, isDesktop, videoMuted]);

  // Restaurar automaticamente o estado de som quando o formulário fecha SEM submissão
  useEffect(() => {
    if (isDesktop) return;
    if (!showGuidePopup && preFormMutedRef.current !== null) {
      try {
        const targetMuted = preFormMutedRef.current ?? false;
        preFormMutedRef.current = null;
        if (videoRef.current) {
          videoRef.current.muted = targetMuted;
          videoRef.current.volume = targetMuted ? 0 : 1;
        }
        if (pipVideoRef.current) {
          pipVideoRef.current.muted = targetMuted;
          pipVideoRef.current.volume = targetMuted ? 0 : 1;
        }
        setVideoMuted(targetMuted);
        setVideoPlaying(!targetMuted);
      } catch {}
    }
  }, [showGuidePopup, isDesktop]);

  // Garantir que o vídeo mantenha o seu estado de mute quando o chat humano abre
  useEffect(() => {
    if (isDesktop) return;
    if (showHumanChat) {
      try {
        // Usar o estado guardado ou atual
        const targetMuted = preFormMutedRef.current ?? videoMuted;
        console.log('🔊 Chat humano aberto - estado de som:', {
          targetMuted,
          preFormMuted: preFormMutedRef.current,
          videoMuted
        });
        
        // Quando o chat humano abre, garantir que o vídeo mantenha o seu estado de mute atual
        // NÃO forçar mute se o utilizador não o colocou em mute antes
        if (videoRef.current) {
          // Aplicar o estado de mute atual (não forçar mute)
          videoRef.current.muted = targetMuted;
          videoRef.current.volume = targetMuted ? 0 : 1;
          
          // Em mobile, quando o chat humano abre, manter o vídeo principal pausado
          // para evitar conflito com o PiP (que é o vídeo visível durante o chat)
          if (!videoRef.current.paused) {
            try { videoRef.current.pause(); } catch {}
          }
          setVideoPlaying(false);
        }
        
        if (pipVideoRef.current) {
          // O PiP sempre segue o estado do vídeo principal
          pipVideoRef.current.muted = targetMuted;
          pipVideoRef.current.volume = targetMuted ? 0 : 1;
          console.log('🔊 PiP - estado sincronizado:', {
            muted: pipVideoRef.current.muted,
            volume: pipVideoRef.current.volume
          });
          
          // Se o PiP estiver visível e o som estiver ativado, tentar tocar
          if (pipVisible && !targetMuted) {
            safePlay(pipVideoRef.current);
          }
        }
        
        // Atualizar estados do React
        setVideoMuted(targetMuted);
        setVideoPlaying(!targetMuted);
        setPipVideoPlaying(!targetMuted && pipVisible);
      } catch (error) {
        console.error('Erro ao controlar som do chat:', error);
      }
    }
  }, [showHumanChat, isDesktop, videoMuted, pipVisible]);

  // Sincronizar estado do vídeo PiP com eventos de play/pause
  useEffect(() => {
    const pipVideo = pipVideoRef.current;
    if (!pipVideo) return;

    const handlePlay = () => setPipVideoPlaying(true);
    const handlePause = () => setPipVideoPlaying(false);

    pipVideo.addEventListener('play', handlePlay);
    pipVideo.addEventListener('pause', handlePause);

    return () => {
      pipVideo.removeEventListener('play', handlePlay);
      pipVideo.removeEventListener('pause', handlePause);
    };
  }, []);

  // Pré-aquecer o vídeo do PiP em background para comutação instantânea
  useEffect(() => {
    if (isDesktop) return; // PiP só é relevante em mobile
    const pip = pipVideoRef.current;
    const main = videoRef.current;
    if (!pip || !main) return;

    try {
      // Não forçar src aqui para evitar descarregar; o src já vem do JSX.
      pip.preload = 'auto';
      pip.muted = true; // autoplay em mobile exige mute
      // manter tempo próximo do principal para evitar seeks longos
      const sync = () => {
        try {
          const t = main.currentTime || 0;
          if (Math.abs((pip.currentTime || 0) - t) > 0.5) {
            pip.currentTime = t;
          }
        } catch {}
      };
      const onTime = () => sync();
      main.addEventListener('timeupdate', onTime);

      // após primeira interação do utilizador na página, dar um play curto e pausar,
      // isto aquece o pipeline e torna o play seguinte instantâneo
      const warmup = () => {
        // Não fazer warmup se o formulário estiver aberto
        if (showGuidePopup) return;
        document.removeEventListener('touchstart', warmup);
        document.removeEventListener('click', warmup);
        safePlay(pip).then(() => {
          setTimeout(() => { try { pip.pause(); } catch {} }, 50);
        });
      };
      document.addEventListener('touchstart', warmup, { once: true, passive: true });
      document.addEventListener('click', warmup, { once: true, passive: true });

      return () => {
        main.removeEventListener('timeupdate', onTime);
        document.removeEventListener('touchstart', warmup as any);
        document.removeEventListener('click', warmup as any);
      };
    } catch {}
  }, [isDesktop]);



  // Função auxiliar para dar play em segurança (não executa se o formulário estiver aberto)
  const safePlay = (video: HTMLVideoElement | null): Promise<void> => {
    if (!video) return Promise.resolve();
    if (showGuidePopup) return Promise.resolve();
    try {
      const result = video.play();
      // Alguns browsers devolvem Promise
      if (result && typeof (result as any).catch === 'function') {
        return (result as Promise<void>).catch(() => { /* ignorar AbortError */ });
      }
      return Promise.resolve();
    } catch {
      return Promise.resolve();
    }
  };

  // Função simplificada para drag and drop do PiP
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Verificar se o clique foi num botão ou controlo
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest(`.${styles.pipControls}`)) {
      return; // Não iniciar drag se clicou num botão
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: clientX - rect.left,
      y: clientY - rect.top
    });
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    // Apenas prevenir default se estiver realmente a fazer drag
    if (isDragging) {
      e.preventDefault();
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - dragOffset.x;
    const newY = clientY - dragOffset.y;
    
    // Limitar aos limites da janela baseado no tamanho atual
    const currentWidth = pipExpanded ? 180 : 120;
    const currentHeight = pipExpanded ? 320 : 213;
    const maxX = window.innerWidth - currentWidth;
    const maxY = window.innerHeight - currentHeight;
    
    const clampedX = Math.max(0, Math.min(newX, maxX));
    const clampedY = Math.max(0, Math.min(newY, maxY));
    
    // Usar requestAnimationFrame para animação mais suave
    requestAnimationFrame(() => {
      setPipPosition({
        x: clampedX,
        y: clampedY
      });
    });
  }, [isDragging, dragOffset, pipExpanded]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Função para fechar apenas o PiP sem fechar o chat
  const handleClosePiP = () => {
    // Parar o vídeo PiP
    if (pipVideoRef.current) {
      pipVideoRef.current.pause();
      setPipVideoPlaying(false);
    }
    // Resetar posição do PiP para a posição inicial
    resetPipPosition();
    setPipExpanded(false);
    // Marcar que foi fechado manualmente
    setPipManuallyClosed(true);
    // Esconder o PiP completamente
    setPipVisible(false);
  };

  // Clicar no PiP: voltar ao ecrã inicial (welcome) sem quebrar UX em mobile
  const handlePipBackToHome = (e: React.MouseEvent) => {
    try {
      // Evitar acionar quando a intenção é arrastar ou clicar em controlos
      const target = e.target as HTMLElement;
      if (isDragging) return;
      if (target.closest('button') || target.closest(`.${styles.pipControls}`)) return;

      // Parar PiP e vídeo principal
      try { pipVideoRef.current?.pause(); } catch {}
      if (videoRef.current) {
        try { videoRef.current.pause(); } catch {}
        setVideoPlaying(false);
        try { videoRef.current.currentTime = 0; } catch {}
      }

      // Fechar chats e popups
      setShowChatbotPopup(false);
      setShowHumanChat(false);
      setShowGuidePopup(false);
      setPipVisible(false);

      // Ir para o ecrã imediatamente após "Começar a conversa"
      setShowStartButton(false);

      // Preparar e iniciar o vídeo principal a partir do ponto do PiP
      try {
        const pipTime = pipVideoRef.current?.currentTime || 0;
        if (videoRef.current) {
          if (!Number.isNaN(pipTime) && pipTime > 0) {
            try { videoRef.current.currentTime = pipTime; } catch {}
          }
          // Respeitar preferência de som atual
          try { videoRef.current.muted = videoMuted; } catch {}
          safePlay(videoRef.current).then(() => setVideoPlaying(true));
        }
      } catch {}

      // Em desktop, preferir hold até nova interação
      if (isDesktop) setPreferHold(true);
    } catch {}
  };

  // Função para alternar o mute do vídeo PiP
  const handleTogglePiPMute = () => {
    // O PiP sempre segue o vídeo principal, então alternar o vídeo principal
    const newMutedState = !videoMuted;
      setVideoMuted(newMutedState);
      
    // Aplicar imediatamente aos vídeos
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.muted = newMutedState;
    }
    
    // Não salvar preferência - resetar sempre no refresh
  };

  // Event listeners para drag and drop
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove, { passive: false });
      document.addEventListener('touchend', handleDragEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
        document.removeEventListener('touchmove', handleDragMove);
        document.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, dragOffset, handleDragMove]);

  // Lidar com o fechamento do browser para encerrar a sessão do chat (guia real)
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Verificar se há uma sessão ativa do chat humano
      const conversationId = getCookie('chat_conversation_id');
      
      if (conversationId && hasActiveSession) {
        try {
          // Tentar encerrar a conversa do guia diretamente primeiro
          await closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada ao fechar separador');
        } catch (error) {
          console.error('Erro ao encerrar conversa diretamente:', error);
          
          // Fallback: usar sendBeacon para garantir que a mensagem seja enviada
          const closingData = {
            projectId: 'virtualguide-teste',
            conversationId: conversationId,
            message: "O utilizador fechou o browser. Sessão encerrada.",
            action: 'close_session'
          };
          
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/close-guide-session', JSON.stringify(closingData));
          }
        }
        
        // Limpar os cookies locais imediatamente
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
      }
    };

    const handlePageHide = async () => {
      // Verificar se há uma sessão ativa do chat humano
      const conversationId = getCookie('chat_conversation_id');
      
      if (conversationId && hasActiveSession) {
        try {
          // Tentar encerrar a conversa do guia diretamente primeiro
          await closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada ao sair da página');
        } catch (error) {
          console.error('Erro ao encerrar conversa diretamente:', error);
          
          // Fallback: usar sendBeacon para garantir que a mensagem seja enviada
          const closingData = {
            projectId: 'virtualguide-teste',
            conversationId: conversationId,
            message: "O utilizador saiu da página. Sessão encerrada.",
            action: 'close_session'
          };
          
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/close-guide-session', JSON.stringify(closingData));
          }
        }
        
        // Limpar os cookies locais imediatamente
        deleteCookie('chat_conversation_id');
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
      }
    };



    // Adicionar event listeners para beforeunload, unload e pagehide
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload); // Evento adicional para maior fiabilidade
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [hasActiveSession]); // Executar quando o status da sessão mudar

    // GESTÃO DE VÍDEOS - SOLUÇÃO HÍBRIDA
    // Desktop: Controlo 100% manual (sem pausa automática)
    // iOS: visibilitychange ativo APENAS para evitar travamento (vídeo fica pausado após desbloquear)
    
    useEffect(() => {
      // Detectar se é iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // SÓ ativar para iOS para resolver problema de zoom/travamento
      if (!isIOS) {
        return; // Desktop e Android: sem pausa automática
      }
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          // iPhone foi bloqueado ou app foi para background
          if (videoRef.current && !videoRef.current.paused) {
            setVideoStateBeforeBlur({
              wasPlaying: true,
              currentTime: videoRef.current.currentTime,
              wasMuted: videoRef.current.muted
            });
            videoRef.current.pause();
            setVideoPlaying(false);
          }

          if (pipVideoRef.current) {
            setPipStateBeforeBlur({
              wasPlaying: !pipVideoRef.current.paused,
              currentTime: pipVideoRef.current.currentTime || 0,
              wasMuted: pipVideoRef.current.muted
            });
            if (!pipVideoRef.current.paused) {
              pipVideoRef.current.pause();
              setPipVideoPlaying(false);
            }
          }
        } else {
          // iPhone voltou do bloqueio/background
          const video = videoRef.current;
          if (video) {
            const savedTime = videoStateBeforeBlur.wasPlaying
              ? videoStateBeforeBlur.currentTime
              : (Number.isFinite(video.currentTime) ? video.currentTime : 0);
            const wasMuted = videoStateBeforeBlur.wasMuted;
            try { video.pause(); } catch {}
            setVideoPlaying(false);

            const srcAttr = video.getAttribute('src');
            if (srcAttr) {
              video.removeAttribute('src');
              video.load();
              video.setAttribute('src', srcAttr);
            } else {
              const currentSrc = video.src;
              video.src = '';
              video.load();
              video.src = currentSrc;
            }

            const restore = () => {
              try {
                if (!Number.isNaN(savedTime) && Number.isFinite(savedTime)) {
                  video.currentTime = savedTime;
                }
                if (typeof wasMuted === 'boolean') {
                  video.muted = wasMuted;
                }
              } catch {}
            };

            let restored = false;
            const onLoaded = () => {
              if (restored) return;
              restored = true;
              restore();
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
            video.addEventListener('canplay', onLoaded, { once: true });

            setVideoStateBeforeBlur({ wasPlaying: false, currentTime: 0, wasMuted: false });
          }

          const pip = pipVideoRef.current;
          if (pip) {
            const pipSavedTime = pipStateBeforeBlur.currentTime || 0;
            const pipWasMuted = pipStateBeforeBlur.wasMuted;
            try { pip.pause(); } catch {}
            setPipVideoPlaying(false);

            const pipSrcAttr = pip.getAttribute('src');
            if (pipSrcAttr) {
              pip.removeAttribute('src');
              pip.load();
              pip.setAttribute('src', pipSrcAttr);
            } else {
              const currentSrc = pip.src;
              pip.src = '';
              pip.load();
              pip.src = currentSrc;
            }

            const restorePip = () => {
              try {
                pip.currentTime = pipSavedTime;
                pip.muted = pipWasMuted;
              } catch {}
            };
            let pipRestored = false;
            const onPipLoaded = () => {
              if (pipRestored) return;
              pipRestored = true;
              restorePip();
            };
            pip.addEventListener('loadedmetadata', onPipLoaded, { once: true });
            pip.addEventListener('canplay', onPipLoaded, { once: true });

            setPipStateBeforeBlur({ wasPlaying: false, currentTime: 0, wasMuted: false });
          }
        }
      };
      
      // Adicionar listeners para iOS
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Event listeners diretos no vídeo para sincronização de estado no iOS
      const handleVideoPlay = () => {
        setVideoPlaying(true);
        console.log('iOS: Vídeo play detectado');
      };
      
      const handleVideoPause = () => {
        setVideoPlaying(false);
        console.log('iOS: Vídeo pause detectado');
      };
      
      if (videoRef.current) {
        videoRef.current.addEventListener('play', handleVideoPlay);
        videoRef.current.addEventListener('pause', handleVideoPause);
      }
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (videoRef.current) {
          videoRef.current.removeEventListener('play', handleVideoPlay);
          videoRef.current.removeEventListener('pause', handleVideoPause);
        }
      };
      
    }, [videoStateBeforeBlur]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar PiP com o vídeo principal
  useEffect(() => {
    if (pipVideoRef.current) {
      pipVideoRef.current.muted = videoMuted;
    }
  }, [videoMuted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aplicar preferência de som aos vídeos quando carregam
  useEffect(() => {
    // Garantir que os vídeos tenham o estado correto de som
    if (videoRef.current) {
      videoRef.current.muted = videoMuted;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.muted = videoMuted; // Sempre seguir o vídeo principal
    }
  }, [videoMuted]); // eslint-disable-line react-hooks/exhaustive-deps

      // Garantir que o som seja aplicado quando os vídeos são carregados
  useEffect(() => {
    const applyMuteState = () => {
      if (videoRef.current) {
        videoRef.current.muted = videoMuted;
      }
      if (pipVideoRef.current) {
        pipVideoRef.current.muted = videoMuted;
      }
    };

    // Aplicar quando os vídeos carregam
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', applyMuteState);
      videoRef.current.addEventListener('canplay', applyMuteState);
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.addEventListener('loadedmetadata', applyMuteState);
      pipVideoRef.current.addEventListener('canplay', applyMuteState);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', applyMuteState);
        videoRef.current.removeEventListener('canplay', applyMuteState);
      }
      if (pipVideoRef.current) {
        pipVideoRef.current.removeEventListener('loadedmetadata', applyMuteState);
        pipVideoRef.current.removeEventListener('canplay', applyMuteState);
      }
    };
  }, [videoMuted]); // eslint-disable-line react-hooks/exhaustive-deps

      // Sincronizar estado do vídeo com o estado React quando o vídeo carrega
  useEffect(() => {
    const syncVideoMuted = () => {
      if (videoRef.current) {
        if (videoRef.current.muted !== videoMuted) {
          videoRef.current.muted = videoMuted;
        }
      }
      if (pipVideoRef.current) {
        if (pipVideoRef.current.muted !== videoMuted) {
          pipVideoRef.current.muted = videoMuted;
        }
      }
    };

    // Sincronizar quando o vídeo carrega
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', syncVideoMuted);
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.addEventListener('loadedmetadata', syncVideoMuted);
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', syncVideoMuted);
      }
      if (pipVideoRef.current) {
        pipVideoRef.current.removeEventListener('loadedmetadata', syncVideoMuted);
      }
    };
  }, [videoMuted]); // eslint-disable-line react-hooks/exhaustive-deps



  // Banco de conhecimento local para o chatbot (limpo de conteúdo específico)
  const knowledgeBase = {
    parque: {
      info: "",
      historia: "",
      missao: ""
    },
    atracoes: {
      monumentos: "",
      areas: "",
      interativas: ""
    },
    visitas: {
      duracao: "",
      melhor_epoca: "",
      acessibilidade: ""
    },
    bilhetes: {
      precos: "",
      online: "",
      grupos: ""
    },
    contacto: {
      morada: "",
      telefone: "",
      email: ""
    },
    horarios: {
      funcionamento: "",
      epocas: "",
      fechado: ""
    },
    servicos: {
      restaurantes: "",
      lojas: "",
      estacionamento: ""
    }
  };

  // Função para formatar respostas do chat com HTML
  function formatChatResponse(text: string): string {
    
    const formatted = text
      // Remover símbolos # em vez de converter para cabeçalhos HTML
      .replace(/^### (.*$)/gim, '<p style="font-weight: 600; margin: 15px 0 10px 0; font-size: 18px;">$1</p>')
      .replace(/^## (.*$)/gim, '<p style="font-weight: 700; margin: 15px 0 10px 0; font-size: 19px;">$1</p>')
      .replace(/^# (.*$)/gim, '<p style="font-weight: 800; margin: 15px 0 10px 0; font-size: 20px;">$1</p>')
      
      // Converter negrito e itálico
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: #2c3e50;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="font-style: italic; color: #7f8c8d;">$1</em>')
      
      // Converter listas (sem pontos)
      .replace(/^\* (.*$)/gim, '<li style="margin: 8px 0; padding-left: 0;">$1</li>')
      .replace(/^- (.*$)/gim, '<li style="margin: 8px 0; padding-left: 0;">$1</li>')
      
      // Converter links especiais (guia real)
      .replace(/\[([^\]]+)\]\(#guia-real\)/g, '<button onclick="window.openGuiaReal()" style="color: #3498db; text-decoration: none; border-bottom: 1px dotted #3498db; background: none; border: none; cursor: pointer; font-size: inherit; font-family: inherit;">$1</button>')
      
      // Converter links normais
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        return `<a href="${url}" style="color: #3498db; text-decoration: none; border-bottom: 1px dotted #3498db;" target="_blank" rel="noopener noreferrer">${text}</a>`;
      })
      
      // Converter código inline
      .replace(/`([^`]+)`/g, '<code style="background: #f8f9fa; color: #e74c3c; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px;">$1</code>')
      
      // Converter blocos de código
      .replace(/```([\s\S]*?)```/g, '<pre style="background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 8px; overflow-x: auto; margin: 15px 0; font-family: monospace; font-size: 14px; line-height: 1.4;">$1</pre>')
      
      // Converter quebras de linha em parágrafos
      .replace(/\n\n/g, '</p><p style="margin: 12px 0; line-height: 1.6; color: #2c3e50;">')
      .replace(/^(.*)$/gm, '<p style="margin: 12px 0; line-height: 1.6; color: #2c3e50;">$1</p>')
      
      // Limpar parágrafos vazios
      .replace(/<p style="margin: 12px 0; line-height: 1.6; color: #2c3e50;"><\/p>/g, '')
      
      // Adicionar espaçamento entre elementos
      .replace(/<\/h([1-3])><p/g, '</h$1><div style="margin: 15px 0;"><p')
      .replace(/<\/p><\/div>/g, '</p></div>');
    
    return formatted;
  }

  // Converter HTML (gerado pelo chatbot AI) para texto simples legível
  function htmlToPlainText(html: string): string {
    try {
      if (!html) return '';
      let text = html;
      // Remover blocos <think>
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
      // Converter listas
      text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, item) => `• ${item}\n`);
      // Converter quebras de linha e encerramentos de parágrafo/div
      text = text.replace(/<(br|BR)\s*\/?>(\s*)/g, '\n');
      text = text.replace(/<\/(p|div|h\d)>/gi, '\n');
      // Remover todas as restantes tags
      text = text.replace(/<[^>]+>/g, '');
      // Descodificar entidades comuns
      text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      // Normalizar espaços e linhas
      text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      return text;
    } catch {
      return html;
    }
  }

  // Função minimal de fallback
  function generateLocalResponse(): string {
    return "Obrigado pela sua pergunta! Já estou a analisar e responderei de seguida.";
  }

  // Função para chamar a API de IA (via OpenRouter na rota interna)
  async function callOpenRouterAI(userMessage: string) {
    try {
      // Verificar se a mensagem contém pedidos de bilhetes
      const message = userMessage.toLowerCase();
      const bilheteKeywords: string[] = [];
      
      const guiaRealKeywords: string[] = [
        'falar com humano', 'humano', 'pessoa real', 'guia real', 'assistente humano',
        'atendente', 'operador', 'falar com pessoa', 'falar com alguém',
        'ser humano', 'apoio humano', 'suporte humano'
      ];
      
      const isBilheteRequest = bilheteKeywords.some(keyword => message.includes(keyword));
      const isGuiaRealRequest = guiaRealKeywords.some(keyword => message.includes(keyword));
      
      if (isBilheteRequest) {
        return formatChatResponse("ℹ️ Informação de bilhetes não disponível.");
      }
      
      // Guardar intenção do utilizador para fallback do botão
      const userAskedHuman = isGuiaRealRequest;
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            // Prompt base do guia
            ...(guideVideos?.systemPrompt ? [{ role: 'system', content: guideVideos.systemPrompt }] as ConversationMessage[] : []),
            // Instruções para integração com chat humano
            { role: 'system', content: (
              `Contexto do Guia:\n` +
              `- chat_humano_disponivel: ${guideVideos?.humanChatEnabled ? 'SIM' : 'NAO'}.\n\n` +
              `Instruções ao assistente:\n` +
              `- Se o utilizador pedir para falar com humano/guia real/atendente e chat_humano_disponivel=SIM, coloca NA PRIMEIRA LINHA apenas [[OPEN_HUMAN_CHAT]].\n` +
              `- Após essa linha, escreve uma frase muito curta a informar que o vais encaminhar para um humano.\n` +
              `- Se chat_humano_disponivel=NAO, nunca coloques [[OPEN_HUMAN_CHAT]] e explica educadamente que o chat humano não está disponível, continuando a ajudar como IA.\n` +
              `- Responde sempre em português de Portugal.`
            ) },
            ...conversation
          ],
          model: "meta-llama/llama-3.1-8b-instruct",
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.9
        })
      });

      if (!response.ok) {
        console.error('Erro na API:', await response.text());
        // Fallback para resposta local
        return generateLocalResponse();
      }

      const data = await response.json();
      
      // Verificar o formato da resposta
      if (data.choices && data.choices[0]) {
        let responseText = "";
        if (data.choices[0].message && data.choices[0].message.content) {
          responseText = data.choices[0].message.content;
        } else if (data.choices[0].text) {
          responseText = data.choices[0].text;
        } else {
          return generateLocalResponse();
        }
        
        // Limpar marcações indesejadas e converter markdown para HTML formatado
        responseText = responseText
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<think>[\s\S]*?/g, '')
          .replace(/[\s\S]*?<\/think>/g, '')
          .replace(/<[^>]*>/g, '')
          .trim();
        
        // Sinal para apresentar CTA de chat humano
        const OPEN_TAG = '[[OPEN_HUMAN_CHAT]]';
        let shouldShowHumanCTA = false;
        if (responseText.includes(OPEN_TAG)) {
          shouldShowHumanCTA = true;
          responseText = responseText.replace(OPEN_TAG, '').trim();
        }

        // Converter markdown para HTML formatado
        responseText = formatChatResponse(responseText);

        // Fallback: se a IA não devolver marcador, detetar intenção do utilizador ou menção na resposta
        if (!shouldShowHumanCTA) {
          const responsePlain = responseText.toLowerCase();
          const botMentionsHuman = guiaRealKeywords.some(k => responsePlain.includes(k));
          shouldShowHumanCTA = userAskedHuman || botMentionsHuman;
        }

        // Anexar botão "FALAR COM GUIA REAL" dentro da mensagem do bot quando aplicável
        if (shouldShowHumanCTA && (guideVideos?.humanChatEnabled === true)) {
          const ctaButtonHtml = `\n\n<div style="margin-top:12px;display:flex;justify-content:flex-start">\n  <button class="vg-open-human-chat-btn" style="padding:10px 16px;background:#000;color:#fff;border:none;border-radius:16px;font-weight:600;cursor:pointer">FALAR COM GUIA REAL</button>\n</div>`;
          responseText += ctaButtonHtml;
        }
        
        // Verificar se a resposta parece estar em inglês
        const englishIndicators = ['the', 'and', 'for', 'with', 'this', 'that', 'what', 'where', 'when', 'how', 'which', 'who'];
        const words = responseText.toLowerCase().split(/\s+/);
        const englishWordCount = words.filter(word => englishIndicators.includes(word)).length;
        
        // Se parecer inglês, usar resposta local
        if (englishWordCount > 2 || responseText.length < 10) {
          return generateLocalResponse();
        }
        
        return responseText || generateLocalResponse();
      }
      
      // Se não conseguir extrair a resposta, usar o fallback
      return generateLocalResponse();
    } catch (error) {
      console.error('Erro ao chamar a API:', error);
      // Fallback para resposta local
      return generateLocalResponse();
    }
  }

  // FAQ: usar apenas os dados vindos do Firestore; sem fallback
  const faqData = Array.isArray(guideVideos.faq) ? guideVideos.faq : [];

  async function handleGuideClick(e: React.MouseEvent) {
    e.preventDefault();
    
    // Impedir scroll quando o chat do guia real estiver aberto
    document.body.style.overflow = 'hidden';
    
    // Fechar o chatbot AI se estiver aberto
    if (showChatbotPopup) {
      setShowChatbotPopup(false);
    }
    
    // Se estiver em Modo Promoção, mostrar sempre o formulário e não abrir chat direto
    if (isPromoMode) {
      setShowGuidePopup(true);
      if (!isDesktop) {
        const pauseAndMute = (v: HTMLVideoElement | null) => { try { v?.pause(); if (v) { v.muted = true; v.volume = 0; } } catch {} };
        pauseAndMute(videoRef.current);
        pauseAndMute(pipVideoRef.current);
        pauseAndMute(bgVideoRef.current);
        pauseAndMute(welcomeBgVideoRef.current);
        setVideoPlaying(false);
        setVideoMuted(true);
      }
      // Em smartphone, pausar e silenciar o vídeo principal quando o formulário abre
      if (!isDesktop && videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.muted = true;
          setVideoPlaying(false);
          setVideoMuted(true);
        } catch {}
      }
      setShowHumanChat(false);
      setShowActionButtons(false);
      return;
    }

    // Verificar se já existe uma sessão ativa ou dados do utilizador em cache
    const conversationId = getCookie('chat_conversation_id');
    const userName = getCookie('chat_user_name');
    const userContact = getCookie('chat_user_contact');
    
    // Nova regra: se o utilizador voltou ao AI depois de usar o chat real,
    // obrigar a revalidar os dados de contacto antes de regressar ao chat real
    if (returnedFromAiAfterHuman) {
      // Fechar conversa anterior, se existir, para evitar conflitos
      if (conversationId && conversationId !== 'CLOSED') {
        try {
          await closeGuideConversation('virtualguide-teste', conversationId, 'system', 'Reabertura após chat IA');
        } catch {}
        deleteCookie('chat_conversation_id');
        setHasActiveSession(false);
        setCurrentConversation(null);
        setHumanChatMessages([]);
      }
      setShowGuidePopup(true);
      if (!isDesktop) {
        const pauseAndMute = (v: HTMLVideoElement | null) => { try { v?.pause(); if (v) { v.muted = true; v.volume = 0; } } catch {} };
        pauseAndMute(videoRef.current);
        pauseAndMute(pipVideoRef.current);
        pauseAndMute(bgVideoRef.current);
        pauseAndMute(welcomeBgVideoRef.current);
        setVideoPlaying(false);
        setVideoMuted(true);
      }
      if (!isDesktop && videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.muted = true;
          setVideoPlaying(false);
          setVideoMuted(true);
        } catch {}
      }
      setShowHumanChat(false);
      setShowActionButtons(false);
      return;
    }
    
    if (conversationId && conversationId !== 'CLOSED' && userName && userContact) {
      // Caso 1: Sessão ativa existente
      // Se já existe sessão, abrir o chat diretamente
      setShowHumanChat(true);
      setShowActionButtons(true); // Mostrar controladores quando chat humano abre
      
      // Em PC, continuar o vídeo de onde está quando o chat do guia real for aberto
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Continuar o vídeo de onde está
          if (videoRef.current.paused) {
            videoRef.current.play();
            setVideoPlaying(true);
          }
        } else {
          // Mobile: Guardar o tempo atual para sincronização com PiP
          const currentTime = videoRef.current.currentTime;
          setSavedVideoTime(currentTime);
          
          // Pausar o vídeo principal imediatamente para evitar reprodução dupla
          videoRef.current.pause();
          setVideoPlaying(false);
        }
      }
      
              // Configurar listener para a conversa existente
        if (!currentConversation) {
        unsubscribeRef.current = listenToGuideConversation('virtualguide-teste', conversationId, (conv) => {
          setCurrentConversation(conv as unknown as Conversation);
          setHumanChatMessages((conv as any).messages as unknown as ChatMessage[]);
          
                      // Verificar se a conversa foi encerrada pelo backoffice
            if ((conv as any).status === 'closed') {
              console.log('Conversa encerrada pelo backoffice - fechando chat e controlando vídeo');
              
              // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
              const conversationAge = Date.now() - (conv.createdAt ? (conv.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
              const isRecentlyCreated = conversationAge < 30000; // 30 segundos
              
              if (isRecentlyCreated) {
                console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
                return; // Não fechar conversas recém-criadas
              }
              
              // Fechar o chat após alguns segundos
              setTimeout(() => {
                // Limpar listener
                if (unsubscribeRef.current) {
                  unsubscribeRef.current();
                  unsubscribeRef.current = null;
                }
                
                // Restaurar scroll
                document.body.style.overflow = 'auto';
                
                // Fechar chat e limpar estado
                setShowHumanChat(false);
                setCurrentConversation(null);
                setHumanChatMessages([]);
                setHumanChatInput('');
                setHasActiveSession(false);
                
                // Limpar apenas o ID da conversa, manter dados do utilizador em cache
                deleteCookie('chat_conversation_id');
                // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
              
              // Controlar vídeo baseado no dispositivo
              if (videoRef.current) {
                if (isDesktop) {
                  // PC: Parar vídeo
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  console.log('PC: Vídeo pausado após conversa encerrada pelo backoffice');
                } else {
                  // Smartphone: Continuar vídeo onde estava
                  videoRef.current.muted = false;
                  setVideoMuted(false);
                  videoRef.current.play();
                  setVideoPlaying(true);
                  console.log('Smartphone: Vídeo continuando após conversa encerrada pelo backoffice');
                }
              }
              
              // Fechar outros popups se estiverem abertos
              if (showGuidePopup) {
                setShowGuidePopup(false);
              }
              if (showChatbotPopup) {
                setShowChatbotPopup(false);
              }
              
            }, 3000); // Aguardar 3 segundos antes de fechar
          }
        });
      }
    } else if (userName && userContact) {
      // Caso 2: Dados do utilizador em cache mas sem sessão ativa
      
      // IMPORTANTE: Verificar se o utilizador atingiu o limite de 4 entradas
      if (guideChatEntryCount >= 4) {
        console.log('🚫 Limite de 4 entradas no chat atingido - forçando preenchimento de dados');
        
        // Limpar dados em cache para forçar preenchimento
        deleteCookie('chat_user_name');
        deleteCookie('chat_user_contact');
        
        // Resetar contador
        setGuideChatEntryCount(0);
        localStorage.setItem('guideChatEntryCount', '0');
        
        // Mostrar popup para preencher dados novamente
        setShowGuidePopup(true);
        if (!isDesktop) {
          const pauseAndMute = (v: HTMLVideoElement | null) => { try { v?.pause(); if (v) { v.muted = true; v.volume = 0; } } catch {} };
          pauseAndMute(videoRef.current);
          pauseAndMute(pipVideoRef.current);
          pauseAndMute(bgVideoRef.current);
          pauseAndMute(welcomeBgVideoRef.current);
          setVideoPlaying(false);
          setVideoMuted(true);
        }
        if (!isDesktop && videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.muted = true;
            setVideoPlaying(false);
            setVideoMuted(true);
          } catch {}
        }
        return;
      }
      
      console.log('🔄 Dados do utilizador encontrados em cache, criando nova conversa automaticamente...');
      console.log('📊 Entrada número:', guideChatEntryCount + 1, 'de 4');
      
      // Incrementar contador de entradas
      const newCount = guideChatEntryCount + 1;
      setGuideChatEntryCount(newCount);
      localStorage.setItem('guideChatEntryCount', newCount.toString());
      
      // Criar nova conversa automaticamente com os dados em cache
      const formData = {
        name: userName,
        contact: userContact
      };
      
      // Reutilizar a lógica de criação de conversa
      handleGuideFormSubmitWithCachedData(formData);
    } else {
      // Caso 3: Sem dados - mostrar popup para preencher dados
      
      // Incrementar contador de entradas (primeira vez ou após reset)
      const newCount = guideChatEntryCount + 1;
      setGuideChatEntryCount(newCount);
      localStorage.setItem('guideChatEntryCount', newCount.toString());
      
      console.log('📝 Primeira entrada ou dados limpos - entrada número:', newCount, 'de 4');
      
      setShowGuidePopup(true);
      
      // Parar vídeo e mostrar imagem de fundo quando o formulário for aberto
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Parar vídeo e mostrar imagem de fundo
          videoRef.current.pause();
          setVideoPlaying(false);
        } else {
          // Mobile: Continuar vídeo automaticamente com som
          videoRef.current.muted = videoMuted; // Respeitar preferência salva
          setVideoMuted(videoMuted);
          videoRef.current.play();
          setVideoPlaying(true);
        }
      }
    }
  }

  // Commented out to fix ESLint warning - function not used
  /* function handleStartExperience() {
    setShowStartButton(false);
    setShowActionButtons(true);
    setVideoPlaying(true);
    
    // Iniciar o vídeo com som
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play();
    }
    

  } */

  // Commented out to fix ESLint warning
  /* function handleWatchAgain() {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }

  } */

  function handleTalkToMe() {
    setShowActionButtons(true); // Manter os botões visíveis
    setShowStartButton(false); // Esconder o botão inicial
    
    // Fechar o chat humano se estiver aberto
    if (showHumanChat) {
      setShowHumanChat(false);
    }
    
    // Em desktop, abrir o chatbot automaticamente. Em mobile, não abrir.
    if (isDesktop) {
      setShowChatbotPopup(true);
      setReturnedFromAiAfterHuman(true);
    }
    
    // Comportamento diferente para desktop e mobile
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Reiniciar o vídeo apenas se for a primeira vez que se abre o chat
        if (!showChatbotPopup && !showHumanChat) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
          setVideoPlaying(true);
        } else {
          // Se já há um chat aberto, continuar o vídeo de onde está
          if (videoRef.current.paused) {
            videoRef.current.play();
            setVideoPlaying(true);
          }
        }
      } else {
        // Mobile: Iniciar o vídeo se não estiver tocando
        if (videoRef.current.paused) {
          videoRef.current.play();
          setVideoPlaying(true);
        }
        
        // Importante: Se o chat vai abrir em mobile, preparar para PiP
        if (!isDesktop && showChatbotPopup) {
          // Marcar para pausar o vídeo principal quando o PiP estiver pronto
          setTimeout(() => {
            if (videoRef.current && showChatbotPopup) {
              videoRef.current.pause();
              setVideoPlaying(false);
            }
          }, 200);
        }
      }
    } else {
      // Se o vídeo ainda não estiver carregado, tentar novamente após um momento
      setTimeout(() => {
        if (videoRef.current) {
          if (isDesktop) {
            if (!showChatbotPopup && !showHumanChat) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
              setVideoPlaying(true);
            } else {
              if (videoRef.current.paused) {
                videoRef.current.play();
                setVideoPlaying(true);
              }
            }
          } else {
            if (videoRef.current.paused) {
              videoRef.current.play();
              setVideoPlaying(true);
            }
          }
        }
      }, 100);
    }
    

  }

  function handleSearchBarClick() {
    setShowActionButtons(true); // Manter os botões visíveis
    setShowStartButton(false); // Esconder o botão inicial
    
    // Fechar o chat humano se estiver aberto
    if (showHumanChat) {
      setShowHumanChat(false);
    }
    
    // Sempre abrir o chatbot quando clicar na barra de pesquisa (tanto desktop quanto mobile)
    setShowChatbotPopup(true);
    setReturnedFromAiAfterHuman(true);
    
    // Comportamento diferente para desktop e mobile
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Reiniciar o vídeo apenas se for a primeira vez que se abre o chat
        if (!showChatbotPopup && !showHumanChat) {
          videoRef.current.currentTime = 0;
          videoRef.current.play();
          setVideoPlaying(true);
        } else {
          // Se já há um chat aberto, continuar o vídeo de onde está
          if (videoRef.current.paused) {
            videoRef.current.play();
            setVideoPlaying(true);
          }
        }
      } else {
        // Mobile: Guardar o tempo atual para sincronização com PiP
        const currentTime = videoRef.current.currentTime;
        setSavedVideoTime(currentTime);
        
        // Pausar o vídeo principal imediatamente para evitar reprodução dupla
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    } else {
      // Se o vídeo ainda não estiver carregado, tentar novamente após um momento
      setTimeout(() => {
        if (videoRef.current) {
          if (isDesktop) {
            if (!showChatbotPopup && !showHumanChat) {
              videoRef.current.currentTime = 0;
              videoRef.current.play();
              setVideoPlaying(true);
            } else {
              if (videoRef.current.paused) {
                videoRef.current.play();
                setVideoPlaying(true);
              }
            }
          } else {
            // Mobile: Guardar o tempo atual para sincronização com PiP (no timeout)
            const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
            // Não pausar o vídeo principal aqui - deixar o useEffect do PiP gerenciar
          }
        }
      }, 100);
    }
    
    // Focar no input do chatbot apenas em desktop
    if (isDesktop) {
      setTimeout(() => {
        chatbotInputRef.current?.focus();
      }, 300);
    }
    // Em mobile, não focar automaticamente para evitar que o teclado abra

  }

  function handleRewind() {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
  }

  function handleFastForward() {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10);
    }
  }

  function handleToggleMute() {
    const newMutedState = !videoMuted;
      setVideoMuted(newMutedState);
      
    // Aplicar imediatamente aos vídeos
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.muted = newMutedState;
    }
    
    // Não salvar preferência - resetar sempre no refresh
  }

  function handlePlayPause() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const attemptPlay = async () => {
        try {
          await video.play();
          setVideoPlaying(true);
        } catch {
          try {
            // Recuperação para iOS/Safari após background: reanexar a fonte e fazer load
            const savedTime = video.currentTime || 0;
            const srcAttr = video.getAttribute('src');

            if (srcAttr) {
              video.removeAttribute('src');
              video.load();
              video.setAttribute('src', srcAttr);
            } else {
              const currentSrc = video.src;
              video.src = '';
              video.load();
              video.src = currentSrc;
            }

            await new Promise<void>((resolve) => {
              const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay);
                resolve();
              };
              video.addEventListener('canplay', onCanPlay, { once: true });
            });

            video.currentTime = savedTime;
            await video.play();
            setVideoPlaying(true);
          } catch (recoverError) {
            console.log('iOS: falha ao recuperar reprodução:', recoverError);
            setVideoPlaying(false);
          }
        }
      };

      void attemptPlay();
    } else {
      video.pause();
      setVideoPlaying(false);
    }
  }

  function handleRestart() {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setVideoPlaying(true);
    }
  }

  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    const url = guideVideos?.welcomeVideoURL || (videoRef.current ? videoRef.current.src : '');
    if (!url || isDownloading) return;
    setIsDownloading(true);
    try {
      const proxied = `/api/download-video?url=${encodeURIComponent(url)}`;
      const nameFromUrl = url.split('/').pop() || 'video.mp4';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // iOS precisa de blob/objectURL para evitar comportamento de navegação
        const res = await fetch(proxied, { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha no download');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = nameFromUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } else {
        // Outros browsers: usar iframe escondido para iniciar o download imediatamente (sem bloquear a UI)
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = proxied;
        document.body.appendChild(iframe);
        // Remover iframe após algum tempo
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 10000);
      }
    } catch {
      // ignorar erros silenciosamente para não bloquear UI
    } finally {
      setIsDownloading(false);
    }
  }



  function handleCloseChatbot() {
    setShowChatbotPopup(false);
    
    // Só resetar a mensagem de boas-vindas se não houver mensagens na conversa
    if (chatbotMessages.length === 0) {
      setShowInstructions(true);
      setShowChatbotWelcome(true);
    } else {
      // Se já há mensagens, manter o estado atual (não mostrar boas-vindas novamente)
      setShowInstructions(false);
      setShowChatbotWelcome(false);
    }
    
    // Garantir que o scroll da página seja restaurado
    document.body.style.overflow = 'auto';
    
    // Garantir que o popup do guia também seja fechado se estiver aberto
    if (showGuidePopup) {
      setShowGuidePopup(false);
    }
    
    // Comportamento diferente para desktop e mobile ao fechar chat
    if (videoRef.current) {
      if (isDesktop) {
        // Desktop: Parar vídeo principal e voltar ao estado inicial
        videoRef.current.pause();
        setVideoPlaying(false);
        
        // NO PC: Voltar ao estado inicial (não welcome overlay) quando o chat for fechado
        // Isso mostra a barra de pesquisa + "Falar com guia real"
        setShowStartButton(false);
      } else {
        // Mobile: Continuar vídeo automaticamente com som
        videoRef.current.muted = videoMuted; // Respeitar preferência salva
        setVideoMuted(videoMuted);
        videoRef.current.play();
        setVideoPlaying(true);
      }
    }
  }

  function handleChatbotSend(e: React.FormEvent) {
    e.preventDefault();
    const chatbotInput = chatbotInputRef.current?.value;
    if (!chatbotInput?.trim()) return;
    
    // IMPORTANTE: Bloquear sugestões até receber resposta
    setSuggestionsBlocked(true);
    
    // Adicionar mensagem do utilizador ao histórico de conversa
    conversation.push({ role: "user", content: chatbotInput });
    
    // Adicionar mensagem do utilizador
    setChatbotMessages(prev => [...prev, { from: 'user', text: chatbotInput, metadata: { fromChatbot: true } }]);
    
    // Limpar input
    if (chatbotInputRef.current) {
      chatbotInputRef.current.value = "";
    }
    
    // Esconder div de boas-vindas em Android após primeira mensagem
    if (isAndroid && !androidWelcomeHidden) {
      setAndroidWelcomeHidden(true);
    }
    
    // Mostrar indicador de digitação
    setChatbotMessages(prev => [...prev, { from: 'bot', text: '...', metadata: { fromChatbot: true } }]);
    
    // Chamar API e atualizar resposta
    callOpenRouterAI(chatbotInput)
      .then(response => {
        // Adicionar resposta do assistente ao histórico de conversa
        conversation.push({ role: "assistant", content: response });
        
        // Controlo de tamanho de histórico
        const MAX_MSG = 20; // janela deslizante (ajusta à vontade)
        if (conversation.length > MAX_MSG) {
          conversation.shift(); // remove a mais antiga
        }
        
        // Sumário automático (opcional)
        if (conversation.length >= 40) {
          getSummary(conversation).then(summary => {
            conversation.splice(0, conversation.length - 10, // mantém só 10 recentes
              { role: "assistant", content: `[RESUMO]\n${summary}` });
          });
        }
        
        // Guardar conversa no localStorage
        saveConversationToStorage();
        
        // Remover indicador de digitação e adicionar resposta real
        setChatbotMessages(prev => {
          const newMessages = [...prev];
          // Substituir o último "..." pela resposta real
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === '...') {
            newMessages[newMessages.length - 1] = { from: 'bot', text: response, metadata: { fromChatbot: true } };
          } else {
            newMessages.push({ from: 'bot', text: response, metadata: { fromChatbot: true } });
          }
          return newMessages;
        });
        
        // IMPORTANTE: Desbloquear sugestões após receber resposta
        setSuggestionsBlocked(false);
      })
      .catch(error => {
        console.error('Erro ao processar resposta:', error);
        // Remover indicador de digitação e adicionar mensagem de erro
        setChatbotMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].text === '...') {
            newMessages[newMessages.length - 1] = { 
              from: 'bot', 
              text: "Desculpe, estou com dificuldades técnicas neste momento. Pode tentar novamente ou contactar-nos diretamente através do telefone +351 239 801 170.",
              metadata: { fromChatbot: true }
            };
          }
          return newMessages;
        });
        
        // IMPORTANTE: Desbloquear sugestões mesmo em caso de erro
        setSuggestionsBlocked(false);
      });
  }

  function handleChatbotInputChange() {
    if (showInstructions) {
      setShowInstructions(false);
    }
    // Removido: if (showChatbotWelcome) { setShowChatbotWelcome(false); }
    // O cabeçalho agora permanece visível mesmo quando se começa a escrever
  }

  function handleFaqToggle(index: number) {
    setExpandedFaq(expandedFaq === index ? null : index);
  }

  function handleCategoryChange(categoryIndex: number) {
    setActiveCategory(categoryIndex);
    setExpandedFaq(null); // Fechar perguntas abertas ao mudar categoria
  }
  
  // Função para validar email
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Função para validar telefone (formato internacional) - Commented out to fix ESLint warning
  /* function isValidPhone(phone: string): boolean {
    // Remove espaços, hífens e parênteses
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    // Valida números de telefone internacionais: + seguido de código do país e número, ou apenas números
    const phoneRegex = /^(\+\d{1,4})?[\d\s\-\(\)]{7,15}$/;
    return phoneRegex.test(cleanPhone);
  } */

  async function handleGuideFormSubmit(e: FormEvent) {
    e.preventDefault();
    
    // Validação básica
    if (!formName.trim() || !formContact.trim()) {
      setFormError('Por favor, preencha todos os campos.');
      return;
    }

    // Validação do contacto (apenas email)
    const contact = formContact.trim();
    if (!isValidEmail(contact)) {
      setFormError('Por favor, insira um email válido.');
      return;
    }
    
    setFormSubmitting(true);
    setFormError(null);
    
    try {
      // Se promoção ativa: apenas guardar contacto e mostrar popup "FUNCIONALIDADE EXTRA"
      if (isPromoMode) {
        await saveContactRequest({ name: formName, contact: formContact });
        setShowPromoPopup(true);
        setShowGuidePopup(false);
        setFormName('');
        setFormContact('');
        setFormSubmitting(false);
        
        // Pausar o vídeo quando o popup de promoção abrir
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.pause();
            setVideoPlaying(false);
          }
        }, 100);
        return;
      }
      // Enviar dados para o Firebase
      await saveContactRequest({
        name: formName,
        contact: formContact
      });
      
      // Verificar se existem mensagens do chatbot para transferir
      let initialMessages: ChatMessage[] = [
        {
          from: 'agent',
          text: `Olá ${formName}! Sou o seu guia real. Como posso ajudar hoje?`,
          timestamp: new Date().toISOString(),
          read: false
        },
        {
          from: 'agent',
          text: `ℹ️ Informações importantes:\n\n🕐 Horário de atendimento: das 9h às 18h\n\n⏱️ Tempo médio de resposta em horário de atendimento: 5 minutos\n\n⏰ Tempo médio de resposta fora do horário de atendimento: 24 horas`,
          timestamp: new Date().toISOString(),
          read: false
        }
      ];
      
      // Verificar se há histórico de chatbot para transferir
      // Verificar se houve uma interação real (pelo menos uma mensagem do usuário e uma resposta do bot)
      const hasUserMessage = chatbotMessages.some(msg => msg.from === 'user' && msg.text.trim().length > 0);
      const hasBotResponse = chatbotMessages.some(msg => msg.from === 'bot' && msg.text.trim().length > 0 && msg.text !== '...');
      
      if (hasUserMessage && hasBotResponse) {
        console.log('🔍 Encontrada interação real com o chatbot');
        // Converter as mensagens do chatbot para o formato do chat humano
        const chatbotHistoryMessages: ChatMessage[] = chatbotMessages.map(msg => ({
          from: (msg.from === 'user' ? 'user' : 'agent'),
          // Mensagens do bot vêm formatadas em HTML -> converter para texto simples para o backoffice
          text: msg.from === 'user' ? msg.text : htmlToPlainText(msg.text),
          timestamp: new Date().toISOString(),
          read: true,
          metadata: { fromChatbot: true, messageType: 'text' as const }
        }));
        
        // Adicionar ao início da conversa para manter a ordem cronológica
        initialMessages = [...chatbotHistoryMessages, ...initialMessages];
        
        // NÃO adicionar a mensagem de transição aqui - ela será adicionada dinamicamente
        // quando o gestor abrir a conversa no backoffice
      }
      
      // Criar conversa no Firebase virtualguide-teste usando guideServices
      const conversationData = {
        guideSlug,
        projectId: 'virtualguide-teste',
        userId: `user_${Date.now()}`,
        userName: formName,
        userContact: formContact,
        userEmail: formContact,
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: initialMessages.map(msg => {
          const base: any = {
            from: (msg.from === 'agent' ? 'guide' : 'user') as 'user' | 'guide',
            text: msg.text,
            timestamp: new Date(msg.timestamp),
            read: msg.read || false
          };
          const fromChatbot = Boolean((msg as any).metadata?.fromChatbot);
          const guideResponse = msg.from === 'agent';
          // Só adicionar metadata quando necessário para evitar undefined
          if (fromChatbot || guideResponse) {
            base.metadata = {
              guideResponse,
              messageType: 'text' as const,
              ...(fromChatbot ? { fromChatbot: true } : {})
            };
          }
          return base;
        })
      };

      const conversationId = await createGuideConversation('virtualguide-teste', conversationData);
      
      // Salvar dados da sessão em cookies
      setCookie('chat_conversation_id', conversationId, 7);
      setCookie('chat_user_name', formName, 7);
      setCookie('chat_user_contact', formContact, 7);
      
      // Resetar contador de entradas quando dados são preenchidos novamente
      setGuideChatEntryCount(1); // Primeira entrada com novos dados
      localStorage.setItem('guideChatEntryCount', '1');
      console.log('🔄 Contador de entradas resetado para 1 após preenchimento de dados');
      
      // Sucesso: resetar a flag, já validou novamente os dados
      setReturnedFromAiAfterHuman(false);
      setFormSubmitted(true);
      setFormName('');
      setFormContact('');
      
              // Fechar o popup do formulário e abrir o chat humano
        setTimeout(() => {
          setShowGuidePopup(false);
          // Em smartphone, restaurar sincronização de som conforme o estado antes do formulário
          if (!isDesktop) {
            // Usar o estado guardado ou manter unmuted por padrão
            const targetMuted = preFormMutedRef.current ?? false;
            console.log('🔊 Restaurando estado de som após formulário:', targetMuted, 'Estado guardado:', preFormMutedRef.current);
            
            try {
              // Primeiro restaurar o estado do vídeo principal
              if (videoRef.current) {
                videoRef.current.muted = targetMuted;
                videoRef.current.volume = targetMuted ? 0 : 1;
                console.log('🔊 Vídeo principal - muted:', videoRef.current.muted, 'volume:', videoRef.current.volume);
                
                // Garantir que o vídeo toca se não estiver em mute
                if (!targetMuted) {
                  videoRef.current.play()
                    .then(() => console.log('🔊 Vídeo principal iniciado com sucesso'))
                    .catch(error => console.error('Erro ao iniciar vídeo principal:', error));
                }
              }
              
              // Depois sincronizar o PiP com o mesmo estado
              if (pipVideoRef.current) {
                pipVideoRef.current.muted = targetMuted;
                pipVideoRef.current.volume = targetMuted ? 0 : 1;
                console.log('🔊 PiP - muted:', pipVideoRef.current.muted, 'volume:', pipVideoRef.current.volume);
                
                // Se o PiP estiver visível e o som estiver ativado, garantir que está a tocar
                if (pipVisible && !targetMuted) {
                  pipVideoRef.current.play()
                    .then(() => console.log('🔊 PiP iniciado com sucesso'))
                    .catch(error => console.error('Erro ao iniciar PiP:', error));
                }
              }
              
              // Atualizar estados do React
              setVideoPlaying(!targetMuted);
              setVideoMuted(targetMuted);
              setPipVideoPlaying(!targetMuted && pipVisible);
              
              // Só limpar a referência depois de tudo estar sincronizado
              setTimeout(() => {
                const oldState = preFormMutedRef.current;
                preFormMutedRef.current = null;
                console.log('🔊 Estado de som limpo. Anterior:', oldState, 'Atual video:', videoRef.current?.muted, 'Atual PiP:', pipVideoRef.current?.muted);
              }, 500); // Aumentado para 500ms para garantir sincronização
            } catch (error) {
              console.error('Erro ao restaurar estado de som:', error);
            }
          }
          setFormSubmitted(false);
          // Garantir que o chatbot AI seja fechado antes de abrir o chat humano
          if (showChatbotPopup) {
            setShowChatbotPopup(false);
          }
          // Impedir scroll quando o chat do guia real estiver aberto
          document.body.style.overflow = 'hidden';
          setShowHumanChat(true);
          setShowActionButtons(true); // Mostrar controladores quando chat humano abre
          setHasActiveSession(true);
          
          // Comportamento diferente para desktop e mobile quando o chat humano abre
          if (videoRef.current) {
            if (isDesktop) {
              // Desktop: Continuar o vídeo de onde está
              if (videoRef.current.paused) {
                videoRef.current.play();
                setVideoPlaying(true);
              }
            } else {
              // Mobile: Guardar o tempo atual para sincronização com PiP
                          const currentTime = videoRef.current.currentTime;
            setSavedVideoTime(currentTime);
              // Não pausar o vídeo principal aqui - deixar o useEffect do PiP gerenciar
            }
          }
        
        // Inicializar a conversa
        const initialConversation: Conversation = {
          id: conversationId,
          userId: `user_${Date.now()}`,
          userName: formName,
          userContact: formContact,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: initialMessages
        };
        
        setCurrentConversation(initialConversation);
        setHumanChatMessages(initialConversation.messages);
        
        // IMPORTANTE: Verificar se a conversa foi criada corretamente no Firebase antes de configurar o listener
        const verifyConversationExists = async () => {
          try {
            console.log('🔍 Verificando se conversa existe no Firebase:', conversationId);
            const existingConversation = await getGuideConversation('virtualguide-teste', conversationId);
            
            if (existingConversation) {
              console.log('✅ Conversa confirmada no Firebase, configurando listener...');
              setupConversationListener();
            } else {
              console.log('❌ Conversa não encontrada no Firebase, tentando novamente...');
              // Tentar novamente após 2 segundos
              setTimeout(verifyConversationExists, 2000);
            }
          } catch (error) {
            console.log('🔄 Erro ao verificar conversa, tentando novamente...', error);
            // Tentar novamente após 2 segundos
            setTimeout(verifyConversationExists, 2000);
          }
        };
        
        // Função para configurar o listener após verificação
        const setupConversationListener = () => {
          console.log('=== LISTENER 1 ATIVADO ===');
          unsubscribeRef.current = listenToGuideConversation('virtualguide-teste', conversationId, (conversation) => {
                      // Converter mensagens para o formato local
          const localMessages = conversation.messages.map(msg => ({
            id: msg.id,
            from: msg.from === 'guide' ? 'agent' : 'user',
            text: msg.text,
            timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            read: msg.read || false,
            metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
          }));
          
          // IMPORTANTE: Preservar a mensagem de boas-vindas se ela existir
          const welcomeMessage = localMessages.find(msg => 
            msg.from === 'agent' && 
            msg.text.includes('Bem-vindo(a) de volta') && 
            msg.metadata?.guideResponse === true
          );
          
          // Se não houver mensagem de boas-vindas, adicionar uma
          if (!welcomeMessage && localMessages.length === 0) {
            localMessages.unshift({
              id: `welcome_${Date.now()}`,
              from: 'agent',
              text: `Olá! Bem-vindo(a) de volta. Sou o seu guia virtual. Como posso ajudá-lo hoje?`,
              timestamp: new Date().toISOString(),
              read: false,
              metadata: { guideResponse: true }
            });
          }
          
          setCurrentConversation({
            id: conversation.id,
            userId: conversation.userId,
            userName: conversation.userName,
            userContact: conversation.userContact,
            status: conversation.status === 'closed' ? 'closed' : 'active',
            createdAt: conversation.createdAt ? (conversation.createdAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            updatedAt: conversation.updatedAt ? (conversation.updatedAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
            messages: localMessages as ExtendedChatMessage[]
          });
          setHumanChatMessages(localMessages as ExtendedChatMessage[]);
            
            // Verificar se a conversa foi encerrada pelo backoffice
            if (conversation.status === 'closed') {
              console.log('Conversa encerrada pelo backoffice - fechando chat e controlando vídeo');
              
              // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
              const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
              const isRecentlyCreated = conversationAge < 30000; // 30 segundos
              
              if (isRecentlyCreated) {
                console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
                return; // Não fechar conversas recém-criadas
              }
              
              // Fechar o chat após alguns segundos
              setTimeout(() => {
                // Limpar listener
                if (unsubscribeRef.current) {
                  unsubscribeRef.current();
                  unsubscribeRef.current = null;
                }
                
                // Restaurar scroll
                document.body.style.overflow = 'auto';
                
                // Fechar chat e limpar estado
                setShowHumanChat(false);
                setCurrentConversation(null);
                setHumanChatMessages([]);
                setHumanChatInput('');
                setHasActiveSession(false);
                
                // Limpar apenas o ID da conversa, manter dados do utilizador em cache
                deleteCookie('chat_conversation_id');
                // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
              
              // Controlar vídeo baseado no dispositivo
              if (videoRef.current) {
                if (isDesktop) {
                  // PC: Parar vídeo
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  console.log('PC: Vídeo pausado após conversa encerrada pelo backoffice');
                } else {
                  // Smartphone: Continuar vídeo onde estava
                  videoRef.current.muted = false;
                  setVideoMuted(false);
                  videoRef.current.play();
                  setVideoPlaying(true);
                  console.log('Smartphone: Vídeo continuando após conversa encerrada pelo backoffice');
                }
              }
              
              // Fechar outros popups se estiverem abertos
              if (showGuidePopup) {
                setShowGuidePopup(false);
              }
              if (showChatbotPopup) {
                setShowChatbotPopup(false);
              }
              
              // Setar o estado de retorno ao AI após conversa com humano
              setReturnedFromAiAfterHuman(true);
            }, 3000); // Aguardar 3 segundos antes de fechar
            }
          });
        };
        
        // Iniciar verificação da conversa após 2 segundos
        setTimeout(verifyConversationExists, 2000);
        
        }); // Fechar o setTimeout do setShowGuidePopup
      } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      console.error('Detalhes completos do erro:', error);
      
      // Verificar se é um erro de permissão
      if (error instanceof Error) {
        if (error.message.includes('permission') || error.message.includes('Permission')) {
          setFormError('Erro de permissão. Verifique as regras de segurança do Firebase.');
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          setFormError('Erro de conexão. Verifique a sua ligação à internet.');
        } else {
          setFormError(`Erro: ${error.message}`);
        }
      } else {
        setFormError('Ocorreu um erro ao enviar o formulário. Por favor, tente novamente.');
      }
    } finally {
      setFormSubmitting(false);
    }
  }

  // Função para criar nova conversa com dados em cache
  async function handleGuideFormSubmitWithCachedData(formData: { name: string; contact: string }) {
    try {
      setIsCreatingNewConversation(true);
      setFormSubmitting(true);
      setFormError('');

      // Incluir histórico do chatbot se existir interação real
      let cachedInitialMessages: ChatMessage[] = [
        {
          from: 'agent',
          text: `Olá ${formData.name}! Bem-vindo(a) de volta. Sou o seu guia virtual. Como posso ajudá-lo hoje?`,
          timestamp: new Date().toISOString(),
          read: false,
          metadata: { guideResponse: true }
        }
      ];

      const cachedHasUserMessage = chatbotMessages.some(msg => msg.from === 'user' && msg.text.trim().length > 0);
      const cachedHasBotResponse = chatbotMessages.some(msg => msg.from === 'bot' && msg.text.trim().length > 0 && msg.text !== '...');
      if (cachedHasUserMessage && cachedHasBotResponse) {
        const chatbotHistoryMessages: ChatMessage[] = chatbotMessages.map(msg => ({
          from: (msg.from === 'user' ? 'user' : 'agent'),
          text: msg.from === 'user' ? msg.text : htmlToPlainText(msg.text),
          timestamp: new Date().toISOString(),
          read: true,
          metadata: { fromChatbot: true, messageType: 'text' as const }
        }));
        cachedInitialMessages = [...chatbotHistoryMessages, ...cachedInitialMessages];
      }

      const conversationData = {
        guideSlug,
        projectId: 'virtualguide-teste',
        userId: `user_${Date.now()}`,
        userName: formData.name,
        userContact: formData.contact,
        userEmail: formData.contact,
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: cachedInitialMessages.map(msg => {
          const base: any = {
            from: (msg.from === 'agent' ? 'guide' : 'user') as 'user' | 'guide',
            text: msg.text,
            timestamp: new Date(msg.timestamp),
            read: msg.read || false
          };
          if (msg.metadata) {
            const meta: any = {};
            if (msg.metadata.guideResponse === true) meta.guideResponse = true;
            if (msg.metadata.fromChatbot === true) meta.fromChatbot = true;
            if (msg.metadata.messageType) meta.messageType = msg.metadata.messageType as 'text' | 'image' | 'file';
            if (Object.keys(meta).length > 0) base.metadata = meta;
          }
          return base;
        })
      };

      const conversationId = await createGuideConversation('virtualguide-teste', conversationData);
      
      console.log('🆔 ID da conversa criada:', conversationId);
      console.log('📊 Dados da conversa criada:', conversationData);
      
      // Verificar se a conversa foi criada corretamente
      if (!conversationId) {
        throw new Error('Falha ao criar conversa: ID não foi retornado');
      }
      
      // Salvar dados da sessão em cookies (os dados do utilizador já estão em cache)
      setCookie('chat_conversation_id', conversationId, 7);
      
      console.log('✅ Nova conversa criada automaticamente com dados em cache:', conversationId);
      
      // Abrir o chat humano diretamente
      setShowHumanChat(true);
      setShowActionButtons(true);
      setHasActiveSession(true);
      
      // Controlar vídeo baseado no dispositivo
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Continuar o vídeo de onde está
          if (videoRef.current.paused) {
            videoRef.current.play();
            setVideoPlaying(true);
          }
        } else {
          // Mobile: Guardar o tempo atual para sincronização com PiP
          const currentTime = videoRef.current.currentTime;
          setSavedVideoTime(currentTime);
          // Pausar o vídeo principal imediatamente para evitar reprodução dupla
          videoRef.current.pause();
          setVideoPlaying(false);
        }
      }
      
      // Inicializar a conversa com as mensagens usadas na criação (para UI local)
      const initialMessages: ChatMessage[] = cachedInitialMessages.map(m => ({
        ...m,
        metadata: m.metadata ? { ...m.metadata, messageType: 'text' as const } : undefined
      }));

      const initialConversation: Conversation = {
        id: conversationId,
        userId: `user_${Date.now()}`,
        userName: formData.name,
        userContact: formData.contact,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: initialMessages
      };
      
      setCurrentConversation(initialConversation);
      setHumanChatMessages(initialMessages);
      
      // IMPORTANTE: Verificar se a conversa foi criada corretamente no Firebase antes de configurar o listener
      const verifyConversationExists = async () => {
        try {
          console.log('🔍 Verificando se conversa existe no Firebase:', conversationId);
          const existingConversation = await getGuideConversation('virtualguide-teste', conversationId);
          
          if (existingConversation) {
            console.log('✅ Conversa confirmada no Firebase, configurando listener...');
            setupConversationListener();
          } else {
            console.log('❌ Conversa não encontrada no Firebase, tentando novamente...');
            // Tentar novamente após 2 segundos
            setTimeout(verifyConversationExists, 2000);
          }
        } catch (error) {
          console.log('🔄 Erro ao verificar conversa, tentando novamente...', error);
          // Tentar novamente após 2 segundos
          setTimeout(verifyConversationExists, 2000);
        }
      };
      
      // Função para configurar o listener após verificação
      const setupConversationListener = () => {
        console.log('⏰ Configurando listener para conversa:', conversationId);
        
        // IMPORTANTE: Verificar se ainda estamos a criar a conversa (evitar conflitos)
        if (!isCreatingNewConversation) {
          console.log('⚠️ Conversa não está mais a ser criada, cancelando configuração do listener');
          return;
        }
        
        // Limpar qualquer listener existente antes de configurar um novo
        if (unsubscribeRef.current) {
          console.log('🧹 Limpando listener existente antes de configurar novo');
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        // Configurar listener em tempo real para a nova conversa
        unsubscribeRef.current = listenToGuideConversation('virtualguide-teste', conversationId, (conversation) => {
        console.log('🔄 Listener recebeu atualização da conversa:', conversation);
        console.log('🔄 Status da conversa:', conversation.status);
        
        // Limpar flag de criação após primeira atualização
        if (isCreatingNewConversation) {
          console.log('✅ Conversa criada e atualizada com sucesso, limpando flag');
          setIsCreatingNewConversation(false);
        }
        
        const localMessages = conversation.messages.map(msg => ({
          id: msg.id,
          from: msg.from === 'guide' ? 'agent' : 'user',
          text: msg.text,
          timestamp: msg.timestamp ? (msg.timestamp as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          read: msg.read || false,
          metadata: (msg.metadata || {}) as ExtendedChatMessage['metadata']
        }));
        
        // IMPORTANTE: Preservar a mensagem de boas-vindas se ela existir
        const welcomeMessage = localMessages.find(msg => 
          msg.from === 'agent' && 
          msg.text.includes('Bem-vindo(a) de volta') && 
          msg.metadata?.guideResponse === true
        );
        
        // Se não houver mensagem de boas-vindas, adicionar uma
        if (!welcomeMessage && localMessages.length === 0) {
          localMessages.unshift({
            id: `welcome_${Date.now()}`,
            from: 'agent',
            text: `Olá! Bem-vindo(a) de volta. Sou o seu guia virtual. Como posso ajudá-lo hoje?`,
            timestamp: new Date().toISOString(),
            read: false,
            metadata: { guideResponse: true }
          });
        }
        
        setCurrentConversation({
          id: conversation.id,
          userId: conversation.userId,
          userName: conversation.userName,
          userContact: conversation.userContact,
          status: conversation.status === 'closed' ? 'closed' : 'active',
          createdAt: conversation.createdAt ? (conversation.createdAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          updatedAt: conversation.updatedAt ? (conversation.updatedAt as any).toDate?.().toISOString() || new Date().toISOString() : new Date().toISOString(),
          messages: localMessages as ChatMessage[]
        });
        setHumanChatMessages(localMessages as ChatMessage[]);
        
        // Verificar se a conversa foi encerrada pelo backoffice
        if (conversation.status === 'closed') {
          console.log('⚠️ Conversa encerrada pelo backoffice - fechando chat');
          
          // IMPORTANTE: Verificar se esta conversa foi criada recentemente (evitar fechamento prematuro)
          const conversationAge = Date.now() - (conversation.createdAt ? (conversation.createdAt as any).toDate?.().getTime() || Date.now() : Date.now());
          const isRecentlyCreated = conversationAge < 30000; // 30 segundos
          
          if (isRecentlyCreated) {
            console.log('🆕 Conversa criada recentemente, ignorando status closed do backoffice');
            return; // Não fechar conversas recém-criadas
          }
          
          setTimeout(() => {
            if (unsubscribeRef.current) {
              unsubscribeRef.current();
              unsubscribeRef.current = null;
            }
            document.body.style.overflow = 'auto';
            setShowHumanChat(false);
            setCurrentConversation(null);
            setHumanChatMessages([]);
            setHumanChatInput('');
            setHasActiveSession(false);
            deleteCookie('chat_conversation_id');
          }, 3000);
        } else if (conversation.status === 'active') {
          console.log('✅ Conversa ativa - mantendo chat aberto');
        }
      });
      };
      
      // Iniciar verificação da conversa
      verifyConversationExists();
      
      // Marcar que a criação da conversa foi concluída
      setIsCreatingNewConversation(false);
      
    } catch (error) {
      console.error('Erro ao criar conversa com dados em cache:', error);
      // Em caso de erro, mostrar popup para preencher dados novamente
      setShowGuidePopup(true);
    } finally {
      setFormSubmitting(false);
      setIsCreatingNewConversation(false);
    }
  }

  // Funções para o chat humano
  function handleHumanChatClose() {
    // Mostrar popup de confirmação
    setShowCloseConfirmation(true);
  }

  async function handleConfirmClose() {
    try {
      // Obter o ID da conversa atual do cookie
      const conversationId = getCookie('chat_conversation_id');
      
      // IMPORTANTE: Aguardar um momento para garantir que não há criação de nova conversa em andamento
      if (isCreatingNewConversation) {
        console.log('⏳ Aguardando criação de nova conversa antes de encerrar...');
        return; // Não encerrar se estiver a criar nova conversa
      }
      
      // Se existir uma conversa ativa (não marcada como CLOSED), marcá-la como fechada no Firebase
      if (conversationId && conversationId !== 'CLOSED') {
        await closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada pelo utilizador');
      }
      
      // Limpar listener em tempo real (não limpar cache de identidade)
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Restaurar o scroll quando o chat do guia real for fechado
      document.body.style.overflow = 'auto';
      // No Android, forçar um reflow para garantir que o scroll seja restaurado
      if (/android/i.test(navigator.userAgent)) {
        void document.body.offsetHeight; // Trigger reflow
      }
      
      // Fechar o chat e limpar estados
      setShowHumanChat(false);
      // Em desktop, manter preferHold ativo para evitar que o vídeo principal apareça
      if (isDesktop) {
        setPreferHold(true);
        // Não resetar preferHold automaticamente - será resetado quando necessário
      }
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      
      // Fechar popup de confirmação
      setShowCloseConfirmation(false);
      
      // Garantir que o popup do guia também seja fechado se estiver aberto
      if (showGuidePopup) {
        setShowGuidePopup(false);
      }
      
      // Garantir que o chatbot AI também seja fechado se estiver aberto
      if (showChatbotPopup) {
        setShowChatbotPopup(false);
      }
      
      // IMPORTANTE: Manter os dados do utilizador em cache (não limpar chat_user_name e chat_user_contact)
      // Limpar apenas o ID da conversa para evitar estados inválidos e reabrir sem formulário
      deleteCookie('chat_conversation_id');
      console.log('🏁 ID da conversa removido; identidade do utilizador mantida');
      // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
      
      // Comportamento diferente para desktop e mobile ao fechar chat humano
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Parar vídeo principal e voltar ao estado inicial
          videoRef.current.pause();
          setVideoPlaying(false);
          
          // NO PC: Voltar ao estado inicial (não welcome overlay) quando o chat for fechado
          // Isso mostra a barra de pesquisa + "Falar com guia real"
          setShowStartButton(false);
        } else {
          // Mobile: Continuar vídeo automaticamente com som
          videoRef.current.muted = videoMuted; // Respeitar preferência salva
          setVideoMuted(videoMuted);
          videoRef.current.play();
          setVideoPlaying(true);
        }
      }
    } catch (error) {
      console.error('Erro ao encerrar conversa:', error);
      // Mesmo com erro, fechar o chat e limpar estados (preserva cache de identidade)
      setShowHumanChat(false);
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      setShowCloseConfirmation(false);
      
      // IMPORTANTE: Manter os dados do utilizador em cache mesmo em caso de erro
      // Limpar apenas o ID da conversa para evitar estados inválidos
      deleteCookie('chat_conversation_id');
      console.log('🏁 ID da conversa removido (erro); identidade do utilizador mantida');
      // NÃO limpar: chat_user_name e chat_user_contact (mantidos para cache)
      
      // Em caso de erro, também voltar ao estado inicial no desktop
      if (isDesktop) {
        setShowStartButton(false);
      }
    }
  }

  function handleCancelClose() {
    setShowCloseConfirmation(false);
  }
  
  // Função para encerrar completamente a sessão - Commented out to fix ESLint warning
  /* async function handleEndSession() {
    try {
      // Restaurar o scroll quando o chat do guia real for fechado
      document.body.style.overflow = 'auto';
      // No Android, forçar um reflow para garantir que o scroll seja restaurado
      if (/android/i.test(navigator.userAgent)) {
        document.body.offsetHeight; // Trigger reflow
      }
      
      // Obter o ID da conversa atual do cookie
      const conversationId = getCookie('chat_conversation_id');
      
      // Se existir uma conversa ativa, marcá-la como fechada no Firebase
      if (conversationId) {
        await closeGuideConversation('virtualguide-teste', conversationId, 'user', 'Fechada pelo utilizador');
      }
      
      // Limpar cookies da sessão
      deleteCookie('chat_conversation_id');
      deleteCookie('chat_user_name');
      deleteCookie('chat_user_contact');
      
      // Fechar o chat e limpar estados
      setShowHumanChat(false);
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      
      // Comportamento diferente para desktop e mobile ao encerrar sessão
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Parar vídeo e mostrar imagem de fundo
          videoRef.current.pause();
          setVideoPlaying(false);
        } else {
          // Mobile: Continuar vídeo de onde parou
          videoRef.current.play();
          setVideoPlaying(true);
        }
      }
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      // Mesmo com erro, tentamos limpar os cookies e estados locais
      deleteCookie('chat_conversation_id');
      deleteCookie('chat_user_name');
      deleteCookie('chat_user_contact');
      setShowHumanChat(false);
      setCurrentConversation(null);
      setHumanChatMessages([]);
      setHumanChatInput('');
      setHasActiveSession(false);
      
      // Comportamento diferente para desktop e mobile ao encerrar sessão (catch)
      if (videoRef.current) {
        if (isDesktop) {
          // Desktop: Parar vídeo e mostrar imagem de fundo
          videoRef.current.pause();
          setVideoPlaying(false);
        } else {
          // Mobile: Continuar vídeo de onde parou
          videoRef.current.play();
          setVideoPlaying(true);
        }
      }
    }
  } */

  async function handleHumanChatSend(e: React.FormEvent) {
    e.preventDefault();
    
    if (!humanChatInput.trim() || !currentConversation?.id) return;
    
    const userMessage: ChatMessage = {
      from: 'user',
      text: humanChatInput.trim(),
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setHumanChatSubmitting(true);
    
    try {
      // Adicionar mensagem do utilizador
      const updatedMessages = [...humanChatMessages, userMessage];
      setHumanChatMessages(updatedMessages);
      setHumanChatInput('');
      
      // Enviar para o Firebase virtualguide-teste usando guideServices
      await sendGuideMessage('virtualguide-teste', currentConversation.id, {
        from: 'user',
        text: userMessage.text,
        metadata: { guideResponse: false }
      });
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setHumanChatSubmitting(false);
    }
  }

  function handleHumanChatInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setHumanChatInput(e.target.value);
  }

  // Handlers para as bandeiras
  function handleFlagClick(country: string) {
    if (country !== 'portugal') {
      // Armazenar a língua selecionada no localStorage
      localStorage.setItem('selectedLanguage', country);
      window.location.href = '/coming-soon';
    }
  }

  // Função utilitária para formatar timestamps do Firestore
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return 'Agora';
    
    try {
      let date: Date;
      
      // Verificar se é um timestamp do Firestore
      if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      }
      // Verificar se é um timestamp do Firestore com toMillis
      else if (timestamp && typeof timestamp.toMillis === 'function') {
        date = new Date(timestamp.toMillis());
      }
      // Verificar se já é uma instância de Date
      else if (timestamp instanceof Date) {
        date = timestamp;
      }
      // Verificar se é um número (timestamp em milissegundos)
      else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      }
      // Verificar se é uma string ISO
      else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      }
      // Fallback para timestamp atual
      else {
        date = new Date();
      }
      
      // Verificar se a data é válida
      if (isNaN(date.getTime())) {
        return 'Agora';
      }
      
      return date.toLocaleTimeString('pt-PT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Erro ao formatar timestamp:', error, timestamp);
      return 'Agora';
    }
  };

  // Restaurar conteúdo (FAQs, contactos) quando nenhum popup/chat está aberto
  useEffect(() => {
    if (!showGuidePopup && !showChatbotPopup && !showHumanChat) {
      setShowActionButtons(true);
    }
  }, [showGuidePopup, showChatbotPopup, showHumanChat]);

  return (
    <>
      {/* Loading Screen */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <h2 className={styles.loadingTitle}>A preparar o teu guia</h2>
            <div className={styles.loadingProgressContainer}>
              <div className={styles.loadingProgressBar}>
                <div 
                  className={styles.loadingProgressFill}
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <span className={styles.loadingProgressText}>{Math.round(loadingProgress)}%</span>
            </div>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner}></div>
            </div>
          </div>
        </div>
      )}
      
      <div className={`${styles.bgVideoContainer} ${showChatbotPopup ? styles.chatbotOpen : ''} ${showHumanChat ? styles.humanChatOpen : ''}`}>
        {/* Barra de bandeiras no topo */}
        <div className={styles.flagsBar}>
          <div className={styles.flagsContainer}>
            {/* Botão de voltar para chat - aparece quando há conversa no chat com AI e não há chats abertos */}
            {chatbotMessages.length > 0 && !showChatbotPopup && !showHumanChat && (
              <button 
                className={styles.backToChatButton}
                onClick={() => {
                  setShowChatbotPopup(true);
                  if (videoRef.current) {
                    if (!isDesktop) {
                      // Em mobile e tablet, pausar o vídeo principal quando abrir o chat
                      videoRef.current.pause();
                      setVideoPlaying(false);
                    } else {
                      // Em PC, garantir que o vídeo principal continue a reproduzir
                      if (videoRef.current.paused) {
                        videoRef.current.play();
                        setVideoPlaying(true);
                      }
                    }
                  }
                }}
                title="Voltar ao chat"
                aria-label="Voltar ao chat"
              >
                <span className={styles.buttonText}>voltar conversa</span>
              </button>
            )}
            <div className={styles.flagsGroup}>
              <div className={styles.flagItem} onClick={() => handleFlagClick('portugal')}>
                <PortugalFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('england')}>
                <EnglandFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('spain')}>
                <SpainFlag />
              </div>
              <div className={styles.flagItem} onClick={() => handleFlagClick('france')}>
                <FranceFlag />
              </div>
            </div>
          </div>
        </div>

        {/* Vídeo de fundo quando o vídeo principal não está em reprodução */}
        {(!isDesktop || (isDesktop && !showChatbotPopup && !showHumanChat)) && (
          <video
            ref={bgVideoRef}
            className={styles.backgroundImage}
            src={toStreamUrl(guideVideos?.backgroundVideoURL) || "/Judite_2.mp4"}
            onError={(e) => {
              console.error('❌ Erro ao carregar vídeo de fundo:', e);
              console.log('🔍 URL do vídeo de fundo:', guideVideos?.backgroundVideoURL);
              const video = e.currentTarget;
              if (guideVideos?.backgroundVideoURL && !String(video.src).includes('/vg-video/')) {
                try {
                  const u = new URL(guideVideos.backgroundVideoURL, window.location.origin);
                  if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                    video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                    console.log('🔄 Usando proxy local para vídeo de fundo:', video.src);
                    return;
                  }
                } catch {}
              }
              if (guideVideos?.backgroundVideoURL && !guideVideos.backgroundVideoURL.startsWith('http')) {
                video.src = `${window.location.origin}${guideVideos.backgroundVideoURL}`;
                console.log('🔄 Tentando carregar com caminho absoluto:', video.src);
              }
              // Marcar como "pronto" para não bloquear o loader
              setBgVideoError(true);
              setBgVideoReady(true);
              setBgProgress(100);
            }}
            autoPlay
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            preload={isSlowNetwork ? 'metadata' : 'auto'}
            style={{
              objectFit: 'cover',
              objectPosition: 'center 15px'
            }}
          />
        )}

        {/* Vídeo principal - só mostrar quando não está na welcome page */}
        {!showStartButton && (
          <video
            ref={videoRef}
            className={styles.bgVideo}
            src={toStreamUrl(guideVideos?.welcomeVideoURL) || "/VirtualGuide_PortugaldosPequeninos.webm"}
            preload={isSlowNetwork ? 'metadata' : 'auto'}
            onCanPlayThrough={() => { setMainVideoLoaded(true); setMainVideoLoading(false); setMainVideoProgress(100); }}
            onPlay={() => { setVideoPlaying(true); setPreferHold(false); }}
            onPause={() => setVideoPlaying(false)}
            onError={(e) => {
              setMainVideoError(true);
              setMainVideoLoading(false);
              console.error('❌ Erro ao carregar vídeo principal:', e);
              console.error('❌ Erro ao carregar vídeo principal:', e);
              console.log('🔍 URL do vídeo principal:', guideVideos?.welcomeVideoURL);
              const video = e.currentTarget;
              if (guideVideos?.welcomeVideoURL && !String(video.src).includes('/vg-video/')) {
                try {
                  const u = new URL(guideVideos.welcomeVideoURL, window.location.origin);
                  if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                    video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                    console.log('🔄 Usando proxy local para vídeo principal:', video.src);
                    return;
                  }
                } catch {}
              }
              if (guideVideos?.welcomeVideoURL && !guideVideos.welcomeVideoURL.startsWith('http')) {
                video.src = `${window.location.origin}${guideVideos.welcomeVideoURL}`;
                console.log('🔄 Tentando carregar com caminho absoluto:', video.src);
                return;
              }
              // Fallback final para evitar ecrã preto
              video.src = "/VirtualGuide_PortugaldosPequeninos.webm";
              console.log('🟡 Fallback local para vídeo principal');
            }}
            autoPlay={false}
            loop
            muted={false}
            playsInline
            crossOrigin="anonymous"
            style={{
              display: (
                !showStartButton &&
                mainVideoLoaded &&
                (
                  // Em desktop, não esconder quando os chats estão abertos; apenas enquanto preferHold estiver ativo
                  !isDesktop || !preferHold
                )
              ) ? 'block' : 'none'
            }}
          >
            {(() => {
              const captions = (guideVideos as any)?.captions as { desktop?: string | null; tablet?: string | null; mobile?: string | null } | undefined;
              console.log('🎬 Legendas configuradas:', captions);
              
              const desktopSrc = captions?.desktop || `/guides/${guideSlug}/captions_desktop.vtt` || '/legendas-desktop.vtt';
              const tabletSrc = captions?.tablet || `/guides/${guideSlug}/captions_tablet.vtt` || '/legendas-tablet.vtt';
              const mobileSrc = captions?.mobile || `/guides/${guideSlug}/captions_mobile.vtt` || '/legendas-mobile.vtt';
              
              console.log('🎬 Caminhos das legendas:', { desktopSrc, tabletSrc, mobileSrc });
              if (isTablet) {
                return <track default kind="subtitles" src={tabletSrc} srcLang="pt" label="Português" />;
              }
              if (!isDesktop) {
                return <track default kind="subtitles" src={mobileSrc} srcLang="pt" label="Português" />;
              }
              return <track default kind="subtitles" src={desktopSrc} srcLang="pt" label="Português" />;
            })()}
          </video>
        )}

        {/* Loader do vídeo principal removido conforme pedido */}

        {/* Caso falhe, fecha o loader e segue sem bloquear a UI */}
        {!showStartButton && mainVideoError && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingContent}>
              <div className={styles.loadingTitle}>Não foi possível carregar o vídeo</div>
              <div className={styles.loadingProgressText}>A experiência continua sem o vídeo.</div>
            </div>
          </div>
        )}
        
        {/* Nova interface de boas-vindas */}
        {showStartButton && (
          <div className={styles.welcomeOverlay}>
            {/* Vídeo de fundo da welcome page */}
            <video
              ref={welcomeBgVideoRef}
              className={styles.welcomeBackgroundVideo}
              src={toStreamUrl(guideVideos?.backgroundVideoURL) || "/Judite_2.mp4"}
              autoPlay
              loop
              muted
              playsInline
              crossOrigin="anonymous"
              preload={isSlowNetwork ? 'metadata' : 'auto'}
              onError={(e) => {
                console.error('❌ Erro ao carregar vídeo de fundo (welcome):', e);
                const video = e.currentTarget;
                if (guideVideos?.backgroundVideoURL && !String(video.src).includes('/vg-video/')) {
                  try {
                    const u = new URL(guideVideos.backgroundVideoURL, window.location.origin);
                    if (u.hostname === 'visitfoods.pt' || u.hostname === 'www.visitfoods.pt') {
                      video.src = `https://visitfoods.pt/vg-video/?file=${encodeURIComponent(u.pathname)}`;
                      console.log('🔄 Proxy para welcome bg video:', video.src);
                      return;
                    }
                  } catch {}
                }
                if (guideVideos?.backgroundVideoURL && !guideVideos.backgroundVideoURL.startsWith('http')) {
                  video.src = `${window.location.origin}${guideVideos.backgroundVideoURL}`;
                } else {
                  video.src = "/Judite_2.mp4";
                }
                // Não bloquear loader em erro
                setWelcomeBgError(true);
                setWelcomeBgReady(true);
                setWelcomeBgProgress(100);
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center 15px',
                zIndex: -1
              }}
            />
            <div className={styles.welcomeContent}>
              <div className={styles.searchBarContainer}>
                <button className={styles.searchBar} onClick={(e) => {
                  // Garantir que o PiP está pronto antes do clique
                  if (!isDesktop && pipVideoRef.current && videoRef.current) {
                    try {
                      // Pausar o vídeo principal IMEDIATAMENTE
                      videoRef.current.pause();
                      setVideoPlaying(false);
                      
                      // Sincronizar tempo e preparar PiP
                      const time = videoRef.current.currentTime || 0;
                      pipVideoRef.current.currentTime = time;
                      
                      // Preservar preferência de som original
                      pipVideoRef.current.muted = videoMuted;
                      
                      // PLAY direto; PiP já deve estar aquecido
                      // Garantir que há dados carregados
                      if (pipVideoRef.current.readyState < 2) {
                        try { pipVideoRef.current.load(); } catch {}
                      }
                      pipVideoRef.current.play()
                        .then(() => setPipVideoPlaying(true))
                        .catch(err => {
                          console.error('Erro no PiP:', err);
                          // fallback silencioso
                          try {
                            pipVideoRef.current!.muted = true;
                            pipVideoRef.current!.play().then(() => setPipVideoPlaying(true));
                          } catch {}
                        });
                    } catch (err) {
                      console.error('Erro ao preparar PiP:', err);
                    }
                  }
                  handleTalkToMe();
                }}>
                  <svg className={styles.playIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5.14V19.14L19 12.14L8 5.14Z" fill="currentColor"/>
                  </svg>
                  <span className={styles.searchPlaceholder}>INICIAR CONVERSA</span>
                </button>
            </div>
            </div>

          </div>
        )}

        {/* Barra de Pesquisa - mostrar quando não está na welcome page e chats fechados */}
        {!showStartButton && !showChatbotPopup && !showHumanChat && !showGuidePopup && (
          <div className={`${styles.glassmorphismControlBar} ${styles['page-module___8aEwW__glassmorphismControlBar']}`}>
            <div className={styles.searchInputContainer}>
              <div className={styles.searchInputWrapper}>
                <svg className={styles.chatInputIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12 C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 12H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 8H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 16H11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input 
                  type="text"
                  className={styles.searchInput}
                  placeholder="Escreva a sua pergunta"
                  onClick={handleSearchBarClick}
                  readOnly
                />
                <button className={styles.searchButton} onClick={(e) => {
                  if (!isDesktop && pipVideoRef.current && videoRef.current) {
                    try {
                      // Pausar o vídeo principal IMEDIATAMENTE
                      videoRef.current.pause();
                      setVideoPlaying(false);
                      
                      // Sincronizar tempo e preparar PiP
                      const time = videoRef.current.currentTime || 0;
                      pipVideoRef.current.currentTime = time;
                      
                      // Preservar preferência de som original
                      pipVideoRef.current.muted = videoMuted;
                      
                      // PLAY SÍNCRONO - crucial para Android
                      const playPromise = pipVideoRef.current.play();
                      
                      // Após iniciar com sucesso
                      playPromise.then(() => {
                        setPipVideoPlaying(true);
                        // Garantir que o som está conforme a preferência do usuário
                        try { pipVideoRef.current!.muted = videoMuted; } catch {}
                      }).catch(err => {
                        console.error('Erro no PiP:', err);
                        // Tentar novamente com mute (política de autoplay)
                        try {
                          pipVideoRef.current!.muted = true;
                          pipVideoRef.current!.play().then(() => {
                            setPipVideoPlaying(true);
                            // Restaurar som após iniciar, se necessário
                            if (!videoMuted) {
                              setTimeout(() => {
                                try { pipVideoRef.current!.muted = false; } catch {}
                              }, 100);
                            }
                          });
                        } catch {}
                      });
                    } catch (err) {
                      console.error('Erro ao preparar PiP:', err);
                    }
                  }
                  handleSearchBarClick();
                }}>
                  <SendIcon />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra branca de largura total para abrir chat real - mostrar quando não está na welcome page e chats/popups fechados */}
        {!showStartButton && !showChatbotPopup && !showHumanChat && !showGuidePopup && (guideVideos?.humanChatEnabled ?? true) && (
          <div className={styles.chatLinkBar}>
            <button onClick={(e) => {
              setShowChatbotPopup(false);
              
              // Arranque síncrono do PiP durante o clique
              if (!isDesktop && pipVideoRef.current && videoRef.current) {
                try {
                  // Pausar o vídeo principal IMEDIATAMENTE
                  videoRef.current.pause();
                  setVideoPlaying(false);
                  
                  // Sincronizar tempo e preparar PiP
                  const time = videoRef.current.currentTime || 0;
                  pipVideoRef.current.currentTime = time;
                  
                  // Preservar preferência de som original
                  pipVideoRef.current.muted = videoMuted;
                  
                  // PLAY SÍNCRONO - crucial para Android
                  const playPromise = pipVideoRef.current.play();
                  
                  // Após iniciar com sucesso
                  playPromise.then(() => {
                    setPipVideoPlaying(true);
                    // Garantir que o som está conforme a preferência do usuário
                    try { pipVideoRef.current!.muted = videoMuted; } catch {}
                  }).catch(err => {
                    console.error('Erro no PiP:', err);
                    // Tentar novamente com mute (política de autoplay)
                    try {
                      pipVideoRef.current!.muted = true;
                      pipVideoRef.current!.play().then(() => {
                        setPipVideoPlaying(true);
                        // Restaurar som após iniciar, se necessário
                        if (!videoMuted) {
                          setTimeout(() => {
                            try { pipVideoRef.current!.muted = false; } catch {}
                          }, 100);
                        }
                      });
                    } catch {}
                  });
                } catch (err) {
                  console.error('Erro ao preparar PiP:', err);
                }
              }
              
              handleGuideClick(e);
            }} className={styles.chatLink}>
              <svg className={styles.chatLinkIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C17.5228 22 22 17.5228 22 12 C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.8214 2.48697 15.5291 3.33782 17L2.5 21.5L7 20.6622C8.47087 21.513 10.1786 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 16H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>FALAR COM GUIA REAL</span>
            </button>
          </div>
        )}

        {/* Controladores de Vídeo - Desktop: só quando chats abertos | Mobile: só quando não há popups/chats e não é welcome */}
        {(
          // Desktop: mostrar quando chats estão abertos e não há popup do guia
          (isDesktop && (showChatbotPopup || ((guideVideos?.humanChatEnabled ?? true) && showHumanChat)) && !showGuidePopup) ||
          // Mobile: mostrar quando não há chats/popups abertos e não é welcome page
          (!isDesktop && !showChatbotPopup && ((guideVideos?.humanChatEnabled ?? true) ? !showHumanChat : true) && !showGuidePopup && !showStartButton)
        ) && (
          <div className={`${styles.glassmorphismControlBar} ${styles['page-module___8aEwW__glassmorphismControlBar']}`}>
            <div className={styles.controlButtonsRow}>
              <button 
                className={styles.controlButton}
                onClick={handleRestart}
                title="Ver o vídeo novamente"
              >
                <RestartIcon />
              </button>
              <button 
                className={styles.controlButton}
                onClick={handleRewind}
                title="Traz 10 segundos"
              >
                <RewindIcon />
              </button>
              <button 
                className={styles.controlButton}
                onClick={handlePlayPause}
                title={videoPlaying ? "Pausar" : "Reproduzir"}
              >
                <PlayPauseIcon playing={videoPlaying} />
              </button>
              <button 
                className={styles.controlButton}
                onClick={handleFastForward}
                title="Andar para a frente 10 segundos"
              >
                <FastForwardIcon />
              </button>
              <button 
                className={styles.controlButton}
                onClick={handleToggleMute}
                title={videoMuted ? "Ativar som" : "Desativar som"}
              >
                <VolumeIcon muted={videoMuted} />
              </button>
              <button 
                className={styles.controlButton}
                onClick={handleDownload}
                title="Descarregar vídeo"
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        )}



        {/* Popup do Chatbot */}
        {showChatbotPopup && (
          <div className={styles.chatbotPopupOverlay}>
            <div className={`${styles.chatbotPopup} ${showChatbotPopup ? styles.fullscreenPopup : ''}`}>
              <div className={styles.chatbotHeader}>
                <div className={styles.chatbotHeaderTitle}>
                  <h3>BEM-VINDO AO GUIA VIRTUAL</h3>
                  <p className={styles.chatbotHeaderSubtitle}>{guideSlug}</p>
                </div>
                <button 
                  className={styles.backButton} 
                  onClick={handleCloseChatbot}
                  aria-label="Voltar"
                >
                  <BackIcon />
                  <span>voltar</span>
                </button>
              </div>
              <div className={`${styles.chatbotContent} ${isAndroid ? styles['android-adjusted'] : ''}`}>
                {showChatbotWelcome && (
                  <div className={`${styles.chatbotWelcome} ${isAndroid && androidWelcomeHidden ? styles['android-hidden'] : ''}`}>
                    <h3>BEM-VINDO AO GUIA VIRTUAL</h3>
                    <p className={styles.chatbotSubtitle}>{guideSlug}</p>
                    {showInstructions && (
                      <div className={styles.glassmorphismBox}>
                        <h4>Como posso ajudar hoje?</h4>
                        <div className={styles.chatbotInstructions}>
                          <div className={styles.instructionItem}>
                            <span className={styles.customBullet}></span>
                            <span>{guideVideos?.helpPoints?.point1 || 'O que visitar ?'}</span>
                          </div>
                          <div className={styles.instructionItem}>
                            <span className={styles.customBullet}></span>
                            <span>{guideVideos?.helpPoints?.point2 || 'O que comer ?'}</span>
                          </div>
                          <div className={styles.instructionItem}>
                            <span className={styles.customBullet}></span>
                            <span>{guideVideos?.helpPoints?.point3 || 'Horários e bilhetes'}</span>
                          </div>
                          <div className={styles.instructionItem}>
                            <span className={styles.customBullet}></span>
                            <span>{guideVideos?.helpPoints?.point4 || 'Como chegar'}</span>
                          </div>
                          <div className={styles.instructionItem}>
                            <span className={styles.customBullet}></span>
                            <span>{guideVideos?.helpPoints?.point5 || 'Acessibilidade'}</span>
                          </div>
                        </div>
                        <div className={styles.actionButtons}>
                          <button 
                            className={styles.primaryActionButton}
                            disabled={suggestionsBlocked}
                            onClick={() => {
                              const input = chatbotInputRef.current;
                              if (input) {
                                input.value = guideVideos?.chatConfig?.button1Function || '';
                                setShowInstructions(false); // Esconder boas-vindas
                                handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                              }
                            }}
                          >
                            {suggestionsBlocked ? 'Aguarde resposta...' : (guideVideos?.chatConfig?.button1Text || 'O que visitar')}
                          </button>
                          <div className={styles.secondaryActions}>
                            <button 
                              className={styles.secondaryActionButton}
                              disabled={suggestionsBlocked}
                              onClick={() => {
                                const input = chatbotInputRef.current;
                                if (input) {
                                  input.value = guideVideos?.chatConfig?.button2Function || '';
                                  setShowInstructions(false); // Esconder boas-vindas
                                  handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                                }
                              }}
                            >
                              {suggestionsBlocked ? 'Aguarde resposta...' : (guideVideos?.chatConfig?.button2Text || 'O que comer')}
                            </button>
                            {guideVideos?.chatConfig?.downloadVideoEnabled ? (
                              <button 
                                className={styles.secondaryActionButton}
                                onClick={handleDownload}
                              >
                                {guideVideos?.chatConfig?.button3Text || 'Download vídeo'}
                              </button>
                                                          ) : (
                              <button 
                                className={styles.secondaryActionButton}
                                disabled={suggestionsBlocked}
                                onClick={() => {
                                  const input = chatbotInputRef.current;
                                  if (input) {
                                    input.value = guideVideos?.chatConfig?.button3Function || '';
                                    setShowInstructions(false);
                                    handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                                  }
                                }}
                              >
                                {suggestionsBlocked ? 'Aguarde resposta...' : (guideVideos?.chatConfig?.button3Text || 'Pergunta 3')}
                              </button>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {chatbotMessages.length > 0 && (
                  <div className={styles.chatbotMessages}>
                    {chatbotMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={msg.from === 'bot' ? styles.chatbotBotMessage : styles.chatbotUserMessage}
                      >
                        {msg.from === 'bot' ? (
                          <>
                            <Image 
                              src={guideVideos?.chatIconURL || "/Imagemchat.png"} 
                              alt="Chat AI" 
                              width={40}
                              height={40}
                              className={styles.messageAvatar}
                            />
                            <div 
                              className={styles.messageContent}
                              dangerouslySetInnerHTML={{ __html: msg.text }}
                              onClick={(e) => {
                                const target = e.target as HTMLElement;
                                // Link de compra (exemplo existente)
                                if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                  e.preventDefault();
                                  alert('Botão COMPRAR BILHETES ONLINE clicado!');
                                  const href = target.getAttribute('href');
                                  if (href) {
                                    window.open(href, '_blank', 'noopener,noreferrer');
                                  }
                                  return;
                                }
                                // CTA para abrir chat humano inserida na resposta
                                const btn = target.closest('.vg-open-human-chat-btn') as HTMLElement | null;
                                if (btn && (guideVideos?.humanChatEnabled === true)) {
                                  e.preventDefault();
                                  handleGuideClick(e as unknown as React.MouseEvent);
                                }
                              }}
                            />
                          </>
                        ) : (
                          <>
                            <Image 
                              src="/utilizador.png" 
                              alt="Utilizador" 
                              width={40}
                              height={40}
                              className={styles.messageAvatar}
                            />
                            <div className={styles.messageContent}>
                              {msg.text}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div ref={chatbotEndRef} />
                  </div>
                )}
              </div>
              {/* Container fixo com form e botão FALAR COM O GUIA REAL */}
              <div className={styles.fixedBottomContainer}>
                {/* Barra compacta com sugestões rápidas (aparece após iniciar conversa) */}
                {(!showInstructions || (Array.isArray(chatbotMessages) && chatbotMessages.length > 0)) && (
                  <div className={styles.quickSuggestionsBar}>
                    <button
                      className={styles.quickSuggestionBtn}
                      disabled={suggestionsBlocked}
                      onClick={() => {
                        const input = chatbotInputRef.current;
                        if (input) {
                          input.value = guideVideos?.chatConfig?.button1Function || '';
                          handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                        }
                      }}
                      aria-label={guideVideos?.chatConfig?.button1Text || 'O que visitar'}
                    >
                      {suggestionsBlocked ? 'Aguarde...' : (guideVideos?.chatConfig?.button1Text || 'O que visitar')}
                    </button>
                    <button
                      className={styles.quickSuggestionBtn}
                      disabled={suggestionsBlocked}
                      onClick={() => {
                        const input = chatbotInputRef.current;
                        if (input) {
                          input.value = guideVideos?.chatConfig?.button2Function || '';
                          handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                        }
                      }}
                      aria-label={guideVideos?.chatConfig?.button2Text || 'O que comer'}
                    >
                      {suggestionsBlocked ? 'Aguarde...' : (guideVideos?.chatConfig?.button2Text || 'O que comer')}
                    </button>
                    {guideVideos?.chatConfig?.downloadVideoEnabled ? (
                      <button
                        className={styles.quickSuggestionBtn}
                        onClick={handleDownload}
                        aria-label="Download vídeo"
                      >
                        {guideVideos?.chatConfig?.button3Text || 'Download vídeo'}
                      </button>
                    ) : (
                      <button
                        className={styles.quickSuggestionBtn}
                        disabled={suggestionsBlocked}
                        onClick={() => {
                          const input = chatbotInputRef.current;
                          if (input) {
                            input.value = guideVideos?.chatConfig?.button3Function || '';
                            handleChatbotSend(new Event('submit') as unknown as React.FormEvent);
                          }
                        }}
                        aria-label={guideVideos?.chatConfig?.button3Text || 'Pergunta 3'}
                      >
                        {suggestionsBlocked ? 'Aguarde...' : (guideVideos?.chatConfig?.button2Text || 'Pergunta 3')}
                      </button>
                    )}
                  </div>
                )}
                <form className={styles.chatbotInputBar} onSubmit={handleChatbotSend} id="chatbotInputForm">
                  <input
                    ref={chatbotInputRef}
                    type="text"
                    placeholder="Escreva a sua pergunta..."
                    className={styles.chatbotInput}
                    onChange={handleChatbotInputChange}
                    onClick={() => {
                      // Em mobile, focar apenas quando o utilizador clicar explicitamente
                      if (!isDesktop) {
                        setTimeout(() => {
                          chatbotInputRef.current?.focus();
                        }, 100);
                      }
                    }}
                  />
                  <button type="submit" className={styles.chatbotSendButton}>
                    <SendIcon />
                  </button>
                </form>
                
                {/* Botão para falar com guia real - só quando ativado */}
                {(guideVideos?.humanChatEnabled ?? true) && (
                  <div className={styles.guideRealLinkContainer}>
                    <button 
                      className={styles.guideRealLink}
                      onClick={(e) => {
                        setShowChatbotPopup(false);
                        handleGuideClick(e);
                        // Garantir que em mobile o vídeo fica sempre em pausa
                        if (videoRef.current && !isDesktop) {
                          videoRef.current.pause();
                          setVideoPlaying(false);
                        }
                      }}
                    >
                      FALAR COM GUIA REAL
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Popup para falar com guia real */}
        {showGuidePopup && (
          <div className={styles.guidePopupOverlay}>
            <div className={styles.guidePopup}>
              <div className={styles.guidePopupHeader}>
                {isPromoMode ? (
                  <div>
                    <h3 style={{ color: 'red'}}>FUNCIONALIDADE EXTRA</h3>
                    <h3>Falar com o Guia Real</h3>
                  </div>
                ) : (
                  <h3>FALAR COM GUIA REAL</h3>
                )}
                <button 
                  className={styles.closeChatbotButton} 
                  onClick={() => {
                    setShowGuidePopup(false);
                    // Garantir que o chat humano também seja fechado
                    if (showHumanChat) {
                      setShowHumanChat(false);
                    }
                        // Restaurar o scroll da página quando o popup for fechado
    document.body.style.overflow = 'auto';
    // No Android, forçar um reflow para garantir que o scroll seja restaurado
    if (/android/i.test(navigator.userAgent)) {
      void document.body.offsetHeight; // Trigger reflow
    }
                    // Mobile: Continuar vídeo automaticamente com som
                    if (videoRef.current && !isDesktop) {
                      videoRef.current.muted = videoMuted; // Respeitar preferência salva
                      setVideoMuted(videoMuted);
                      videoRef.current.play();
                      setVideoPlaying(true);
                    }
                  }}
                  aria-label="Fechar"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.guidePopupContent}>
                <p>Preencha os dados para iniciar conversa</p>
                
                <form className={styles.guideForm} onSubmit={handleGuideFormSubmit}>
                  {formError && (
                    <div className={styles.formError}>
                      {formError}
                    </div>
                  )}
                  <div className={styles.formField}>
                    <input 
                      type="text" 
                      id="name" 
                      placeholder="O seu nome" 
                      value={formName}
                      onChange={(e) => updateFormName(e.target.value)}
                      disabled={formSubmitting}
                      required
                      onFocus={() => {
                        if (isPromoMode) {
                          setShowPromoPopup(true);
                          setShowGuidePopup(false);
                        }
                      }}
                      style={{
                        cursor: 'text',
                        opacity: 1
                      }}
                    />
                  </div>
                  <div className={styles.formField}>
                    <input 
                      type="email" 
                      id="contact" 
                      placeholder="O seu email" 
                      value={formContact}
                      onChange={(e) => updateFormContact(e.target.value)}
                      disabled={formSubmitting}
                      required
                      pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
                      title="Insira um email válido"
                      onFocus={() => {
                        if (isPromoMode) {
                          setShowPromoPopup(true);
                          setShowGuidePopup(false);
                        }
                      }}
                      style={{
                        cursor: 'text',
                        opacity: 1
                      }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className={styles.guideSubmitButton}
                    disabled={formSubmitting}
                    onClick={(e) => {
                      if (isPromoMode) {
                        e.preventDefault();
                        setShowPromoPopup(true);
                        setShowGuidePopup(false);
                      }
                    }}
                  >
                    {formSubmitting ? 'A ENVIAR...' : 'INICIAR CONVERSAÇÃO'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seção FAQ - Div simples abaixo da barra de botões */}
      {showActionButtons && faqData.length > 0 && (
        <div className={styles.faqSection}>
          <div className={styles.faqContainer}>
            <div className={styles.faqHeader}>
              <h2 className={styles.faqTitle}>FAQ</h2>
            </div>
            
            <div className={styles.faqCategories}>
              {faqData.map((category, index) => (
                <button 
                  key={index}
                  className={`${styles.faqCategory} ${activeCategory === index ? styles.activeCategory : ''}`}
                  onClick={() => handleCategoryChange(index)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className={styles.faqContent}>
              {faqData[activeCategory].questions.map((item, index) => (
                <div key={index} className={`${styles.faqItem} ${expandedFaq === index ? styles.expanded : ''}`}>
                  <div className={styles.faqQuestion} onClick={() => handleFaqToggle(index)}>
                    <span>{item.question}</span>
                    <span className={styles.faqIcon}>▼</span>
                  </div>
                  <div className={styles.faqAnswer}>
                    {item.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Seção de Contacto */}
      {showActionButtons && (((guideVideos as any)?.contactInfo?.enabled ?? true)) && (
        <div className={styles.contactSection}>
          <div className={styles.contactContainer}>
            {/* Título removido conforme pedido */}
            
            <div className={styles.contactContent}>
              <div className={styles.contactLeft}>
                <div className={styles.mapContainer}>
                  <iframe
                    src={guideVideos.contactInfo?.mapEmbedUrl || ""}
                    width="100%"
                    height="400"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Localização do Parque"
                  ></iframe>
                </div>
              </div>
              
              <div className={styles.contactRight}>
                <div className={styles.contactInfo}>
                  <div className={styles.contactItem}>
                    <h3 className={styles.contactItemTitle}>{guideVideos.contactInfo?.callUsTitle || 'Ligue-nos'}</h3>
                    <p className={styles.contactItemDesc}>
                      {guideVideos.contactInfo?.callUsDescription || 'Entre em contacto connosco para esclarecer dúvidas ou solicitar informações sobre os nossos produtos e serviços.'}
                    </p>
                    {guideVideos.contactInfo?.phoneNumber && (
                      <a href={`tel:${guideVideos.contactInfo.phoneNumber}`} className={styles.contactLink}>
                        {guideVideos.contactInfo.phoneNumber}
                      </a>
                    )}
                    {guideVideos.contactInfo?.email && (
                      <div style={{ marginTop: 8 }}>
                        <a href={`mailto:${guideVideos.contactInfo.email}`} className={styles.contactLink}>
                          {guideVideos.contactInfo.email}
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.contactItem}>
                    <h3 className={styles.contactItemTitle}>{guideVideos.contactInfo?.visitUsTitle || 'Visite-nos'}</h3>
                    <p className={styles.contactItemDesc}>
                      {guideVideos.contactInfo?.visitUsDescription || 'Visite o nosso parque e descubra mais sobre Portugal.'}
                    </p>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(guideVideos.contactInfo?.address || 'Largo Rossio de Santa Clara, Coimbra')}`} className={styles.contactLink}>
                      {guideVideos.contactInfo?.address || 'Largo Rossio de Santa Clara, 3040-256 Coimbra, Portugal'}
                    </a>
                  </div>
                  
                  <div className={styles.contactItem}>
                    <h3 className={styles.contactItemTitle}>{guideVideos.contactInfo?.liveChatTitle || 'Chat ao Vivo'}</h3>
                    <p className={styles.contactItemDesc}>
                      {guideVideos.contactInfo?.liveChatDescription || 'Fale com o nosso guia virtual em tempo real.'}
                    </p>
                    <button 
                      className={`${styles.contactLink} ${styles.chatButton}`}
                      onClick={() => {
                        // Sempre abrir o chat com AI
                        // Fechar o chat humano se estiver aberto
                        if (showHumanChat) {
                          setShowHumanChat(false);
                        }
                        
                        // Abrir o chatbot AI
                        setShowChatbotPopup(true);
                        setTimeout(() => {
                          chatbotInputRef.current?.focus();
                        }, 300);
                      }}
                    >
                      <span style={{display: 'inline !important'}}>
                        {guideVideos.contactInfo?.liveChatButtonText || 'FALE COM O GUIA VIRTUAL'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Humano */}
      {showHumanChat && (
        <div className={styles.chatbotPopupOverlay}>
          <div className={styles.chatbotPopup}>
            <div className={styles.chatbotHeader}>
              {isDesktop ? (
                /* Versão Desktop: Título primeiro, botões depois */
                <>
                  <div className={styles.chatbotTitle}>
                    <div>
                      <h2>Conversa com Guia Real</h2>
                      <p>
                        {getCookie('chat_conversation_id') ? 
                          `Conversa com ${getCookie('chat_user_name')}` : 
                          'Conversa em tempo real'}
                      </p>
                    </div>
                  </div>
                  <div className={styles.headerButtonsContainer}>
                    <button 
                      className={styles.backButton} 
                      onClick={handleHumanChatClose}
                      aria-label="Voltar"
                    >
                      <BackIcon />
                      <span>voltar</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Versão Mobile: Botões primeiro, título depois */
                <>
                  <div className={styles.headerButtonsContainerMobile}>
                    <button 
                      className={styles.backButton} 
                      onClick={handleHumanChatClose}
                      aria-label="Voltar"
                    >
                      <BackIcon />
                      <span>voltar</span>
                    </button>
                  </div>
                  <div className={styles.chatbotTitleMobile}>
                    <div>
                      <h2>Conversa com Guia Real</h2>
                      <p>
                        {getCookie('chat_conversation_id') ? 
                          `Conversa com ${getCookie('chat_user_name')}` : 
                          'Conversa em tempo real'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className={styles.chatbotMessages}>
              {humanChatMessages.map((message, index) => {
                // Mostrar a barra "Guia Real" quando a mensagem de transição surge
                // ou imediatamente na primeira resposta do guia após essa transição.
                const transitionText = 'Vejo que já falou com o nosso guia virtual. A partir daqui será a guia real a responder';
                const isTransition = message.metadata?.isTransitionMessage === true || (typeof message.text === 'string' && message.text.trim() === transitionText);
                const prevMsg = index > 0 ? humanChatMessages[index - 1] : undefined;
                const previousWasTransition = Boolean(
                  prevMsg && (
                    prevMsg.metadata?.isTransitionMessage === true ||
                    (typeof prevMsg.text === 'string' && prevMsg.text.trim() === transitionText)
                  )
                );
                const isFirstGuideMessageAfterTransition =
                  message.from === 'agent' &&
                  message.metadata?.guideResponse === true &&
                  previousWasTransition;

                return (
                  <React.Fragment key={index}>
                    {(isTransition || isFirstGuideMessageAfterTransition) && (
                      <div className={styles.transitionLine}>
                        <hr />
                        <span>Guia Real</span>
                        <hr />
                      </div>
                    )}
                    <div 
                      className={`${styles.chatbotMessage} ${
                        message.from === 'user' ? styles.chatbotUserMessage : styles.chatbotBotMessage
                      } ${message.text.includes('[Bot]') ? styles.botMessage : ''}`}
                      data-from={message.from}
                    >
                      {message.from === 'user' ? (
                        <>
                          <div 
                            className={styles.messageContent} 
                            dangerouslySetInnerHTML={{ __html: message.text }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                e.preventDefault();
                                alert('Botão COMPRAR BILHETES ONLINE clicado!');
                                console.log('Link clicado via onClick do container');
                                
                                const href = target.getAttribute('href');
                                if (href) {
                                  window.open(href, '_blank', 'noopener,noreferrer');
                                }
                              }
                            }}
                          />
                          <Image 
                            src="/utilizador.png" 
                            alt="Utilizador" 
                            width={40}
                            height={40}
                            className={styles.messageAvatar}
                          />
                        </>
                      ) : (
                        <>
                          <Image 
                            src={guideVideos?.chatIconURL || "/Imagemchat.png"} 
                            alt="Guia Real" 
                            width={40}
                            height={40}
                            className={styles.messageAvatar}
                          />
                          <div 
                            className={styles.messageContent} 
                            dangerouslySetInnerHTML={{ __html: message.text }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName === 'A' && target.textContent?.includes('COMPRAR BILHETES ONLINE')) {
                                e.preventDefault();
                                alert('Botão COMPRAR BILHETES ONLINE clicado!');
                                console.log('Link clicado via onClick do container');
                                
                                const href = target.getAttribute('href');
                                if (href) {
                                  window.open(href, '_blank', 'noopener,noreferrer');
                                }
                              }
                            }}
                          />
                        </>
                      )}
                      <div className={styles.messageTime}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={humanEndRef} />
            </div>

            <form className={styles.chatbotInputBar} onSubmit={handleHumanChatSend}>
              <input
                ref={chatbotInputRef}
                type="text"
                className={styles.chatbotInput}
                                  placeholder="Escreva a sua pergunta"
                value={humanChatInput}
                onChange={handleHumanChatInputChange}
                disabled={humanChatSubmitting}
              />
              <button 
                type="submit" 
                className={styles.chatbotSendButton}
                disabled={humanChatSubmitting || !humanChatInput.trim()}
              >
                <SendIcon />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Popup de Confirmação para Fechar Chat */}
      {showCloseConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            padding: '25px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            maxWidth: '350px',
            width: '90%',
            textAlign: 'center',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '18px',
              color: '#333',
              fontWeight: '600'
            }}>
              Confirmar Saída
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.4'
            }}>
              Tem a certeza que pretende sair da conversa com o guia real?
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button 
                onClick={handleCancelClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
              >
                Sim, Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picture-in-Picture Video para Mobile - sempre montado para pré-carregamento */}
      {!isDesktop && (
        <div 
          className={`${styles.pipVideoContainer} ${isDragging ? styles.dragging : ''} ${pipExpanded ? styles.expanded : ''}`}
          style={{
            visibility: (showChatbotPopup || showHumanChat) && pipVisible ? 'visible' : 'hidden',
            pointerEvents: (showChatbotPopup || showHumanChat) && pipVisible ? 'auto' : 'none',
            left: `${pipPosition.x}px`,
            top: `${pipPosition.y}px`,
            right: 'auto'
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handlePipBackToHome}
        >
          <video
            ref={pipVideoRef}
            className={styles.pipVideo}
            src={toStreamUrl(guideVideos?.welcomeVideoURL) || "/VirtualGuide_PortugaldosPequeninos.webm"}
            loop
            preload="auto"
            playsInline
            muted={preFormMutedRef.current ?? videoMuted} /* Usar o estado guardado ao abrir o chat */
            crossOrigin="anonymous"
            onError={(e) => {
              console.error('Erro ao carregar vídeo PiP:', e);
              const video = e.currentTarget;
              // Tentar fallback para vídeo local
              if (video.src !== "/VirtualGuide_PortugaldosPequeninos.webm") {
                console.log('🔄 Usando vídeo de fallback para PiP');
                video.src = "/VirtualGuide_PortugaldosPequeninos.webm";
              }
            }}
          />
          <div className={`${styles.pipDragHandle} ${isDragging ? styles.dragging : ''}`} />
          <div className={styles.pipControls}>
            <button 
              className={styles.pipPlayPauseButton}
              onClick={(e) => {
                e.stopPropagation();
                const pip = pipVideoRef.current;
                if (!pip) return;

                if (pipVideoPlaying) {
                  pip.pause();
                  setPipVideoPlaying(false);
                } else {
                  // Evitar poluir o console com AbortError quando o estado muda rápido
                  pip.play()
                    .then(() => setPipVideoPlaying(true))
                    .catch(() => { /* ignorar AbortError/play interrompido */ });
                }
              }}
              aria-label={pipVideoPlaying ? "Pausar" : "Reproduzir"}
            >
              <PlayPauseIcon playing={pipVideoPlaying} />
            </button>
            <button 
              className={styles.pipMuteButton}
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePiPMute();
              }}
              aria-label={videoMuted ? "Ativar som" : "Silenciar"}
            >
              <VolumeIcon muted={videoMuted} />
            </button>
          </div>
          <button 
            className={styles.pipCloseButtonExterior}
            onClick={(e) => {
              e.stopPropagation();
              handleClosePiP();
            }}
            aria-label="Fechar PiP"
            style={{ fontSize: '12px', color: 'white', fontWeight: 'bold' }}
          >
            X
          </button>
        </div>
      )}

      {/* Espaço para não ficar escondido pelo container fixo do chat no fundo
          Mostrar apenas quando algum popup/chat está aberto. Quando o footer
          está visível, não adicionamos este espaçamento para o footer encostar
          à última secção. */}
      {(showChatbotPopup || showHumanChat || showGuidePopup) && (
        <div style={{ height: isDesktop ? 120 : 200 }} />
      )}

      {/* Rodapé simples com link para Livro de Reclamações - só aparece quando nenhum chat estiver aberto e após iniciar conversa */}
      {!showChatbotPopup && !showHumanChat && !showGuidePopup && !showStartButton && (
        <footer style={{
          marginTop: '0',
          padding: '16px 0',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666',
          position: 'relative',
          zIndex: 2002,
          background: 'rgba(0, 0, 0, 0.95)',
          borderTop: '1px solid rgba(0,0,0,0.08)'
        }}>
          <a
            href="https://www.livroreclamacoes.pt/Inicio/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            Livro de Reclamações
          </a>
        </footer>
      )}

      {/* Popup de Promoção */}
      {showPromoPopup && (
        <div className={styles.guidePopupOverlay}>
          <div className={styles.guidePopup} style={{ maxWidth: '450px', textAlign: 'center' }}>
            <div className={styles.guidePopupHeader}>
              <h3 style={{ color: 'red', margin: '0 0 8px 0', fontSize: '20px' }}>FUNCIONALIDADE EXTRA</h3>
              <button 
                className={styles.closeChatbotButton} 
                onClick={() => setShowPromoPopup(false)}
                aria-label="Fechar"
              >
                <CloseIcon />
              </button>
            </div>
            <div className={styles.guidePopupContent}>
              <p style={{ fontSize: '16px', margin: '8px 0' }}>
                Esta é uma funcionalidade extra
              </p>
              <button 
                className={styles.guideSubmitButton}
                onClick={() => setShowPromoPopup(false)}
                style={{ marginTop: '8px' }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}