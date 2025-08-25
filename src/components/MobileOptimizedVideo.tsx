'use client';

import { useEffect, useRef, forwardRef } from 'react';
import { useState } from 'react';

interface MobileOptimizedVideoProps {
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

const MobileOptimizedVideo = forwardRef<HTMLVideoElement, MobileOptimizedVideoProps>(
  ({ src, className, muted = false, loop = false, preload = "auto", playsInline = true, crossOrigin = "anonymous", onError, onLoadedMetadata, onCanPlayThrough, onPlay, onPause, autoPlay, style, children, ...props }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      // Detectar se é mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
             if (isMobile) {
         // 1. Otimizar carregamento - metadados primeiro
         video.preload = 'metadata';
         
         // 2. Detectar qualidade da conexão
         if ('connection' in navigator) {
           const connection = (navigator as any).connection;
           
           if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
             video.volume = 0.7; // Reduz volume para economizar
           }
         }
         
         // 3. Detectar performance do dispositivo
         const isLowEndDevice = navigator.hardwareConcurrency <= 2;
         if (isLowEndDevice) {
           video.playbackRate = 1.0; // Manter velocidade normal
         }
        
                 // 4. Event listeners otimizados
         const handleLoadedMetadata = () => {
           setIsLoaded(true);
           video.preload = 'auto'; // Agora carregar tudo
           onLoadedMetadata?.();
         };

         const handleCanPlay = () => {
           // Vídeo otimizado e pronto para tocar
         };

         const handleCanPlayThrough = () => {
           onCanPlayThrough?.();
         };

         const handlePlay = () => {
           onPlay?.();
         };

         const handlePause = () => {
           onPause?.();
         };

         const handleError = (e: any) => {
           onError?.(e);
         };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('canplaythrough', handleCanPlayThrough);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('error', handleError);

        return () => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('canplay', handleCanPlay);
          video.removeEventListener('canplaythrough', handleCanPlayThrough);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('error', handleError);
        };
             } else {
         // Desktop - otimizações básicas
         video.preload = preload;
       }
    }, [onError, onLoadedMetadata, preload]);

    // Combinar refs
    const combinedRef = (node: HTMLVideoElement) => {
      videoRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    return (
      <video
        ref={combinedRef}
        className={className}
        src={src}
        muted={muted}
        loop={loop}
        preload={preload}
        playsInline={playsInline}
        crossOrigin={crossOrigin}
        autoPlay={autoPlay}
        style={style}
        {...props}
      >
        {children}
      </video>
    );
  }
);

MobileOptimizedVideo.displayName = 'MobileOptimizedVideo';

export default MobileOptimizedVideo;
