'use client';

import { useEffect, useRef, forwardRef, useState } from 'react';
import MobileOptimizedVideo from './MobileOptimizedVideo';

interface PiPOptimizedVideoProps {
  src: string;
  className?: string;
  muted?: boolean;
  loop?: boolean;
  preload?: string;
  playsInline?: boolean;
  crossOrigin?: string;
  onError?: (e: any) => void;
  onLoadedMetadata?: () => void;
  onCanPlayThrough?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoPlay?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const PiPOptimizedVideo = forwardRef<HTMLVideoElement, PiPOptimizedVideoProps>(
  (props, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPiPReady, setIsPiPReady] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      console.log('🎬 Inicializando otimizações específicas para PiP');

      // 1. Otimizações específicas para PiP
      const optimizeForPiP = () => {
        // Carregar metadados primeiro para start rápido
        video.preload = 'metadata';
        
        // Configurar para melhor performance em PiP
        video.playsInline = true;
        
        // Detectar se o dispositivo suporta PiP
        if (document.pictureInPictureEnabled || 'pictureInPictureEnabled' in document) {
          console.log('✅ Dispositivo suporta PiP - otimizando');
          
          // Preparar PiP com antecedência
          video.addEventListener('loadedmetadata', () => {
            console.log('🎬 PiP - metadados carregados, pronto para ativação');
            setIsPiPReady(true);
            
            // Carregar mais dados para PiP suave
            video.preload = 'auto';
          }, { once: true });
        }
      };

      // 2. Otimizações para mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        console.log('📱 Aplicando otimizações mobile para PiP');
        
        // Reduzir qualidade em dispositivos de baixo desempenho
        const isLowEndDevice = navigator.hardwareConcurrency <= 2;
        if (isLowEndDevice) {
          console.log('🔧 Dispositivo de baixo desempenho - otimizando PiP');
          // Manter configurações básicas para estabilidade
        }
        
        // Otimizar para conexões móveis
        if ('connection' in navigator) {
          const connection = (navigator as any).connection;
          if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            console.log('📡 Conexão lenta - otimizando PiP para economia de dados');
            video.preload = 'metadata'; // Carregar só metadados primeiro
          }
        }
      }

      optimizeForPiP();

      // 3. Event listeners específicos para PiP
      const handleCanPlay = () => {
        console.log('🎬 PiP - vídeo pronto para tocar');
      };

      const handlePlay = () => {
        console.log('▶️ PiP - iniciando reprodução');
      };

      const handlePause = () => {
        console.log('⏸️ PiP - pausado');
      };

      const handleError = (e: any) => {
        console.error('❌ Erro no PiP:', e);
        props.onError?.(e);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('error', handleError);
      };
    }, [props.onError]);

    return (
      <MobileOptimizedVideo
        ref={(node) => {
          videoRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        {...props}
      />
    );
  }
);

PiPOptimizedVideo.displayName = 'PiPOptimizedVideo';

export default PiPOptimizedVideo;
