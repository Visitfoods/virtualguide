'use client';

import { useVideoOptimization, usePiPOptimization } from '../hooks/useVideoOptimization';

interface VideoOptimizationStatusProps {
  show?: boolean;
}

export default function VideoOptimizationStatus({ show = false }: VideoOptimizationStatusProps) {
  const videoOptimization = useVideoOptimization();
  const pipOptimization = usePiPOptimization();

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🎬 Otimizações Ativas</div>
      
      <div style={{ marginBottom: '3px' }}>
        📱 Mobile: {videoOptimization.isMobile ? '✅' : '❌'}
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        🔧 Low-end: {videoOptimization.isLowEndDevice ? '✅' : '❌'}
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        📡 Conexão: {videoOptimization.connectionType}
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        🎬 PiP: {videoOptimization.supportsPiP ? '✅' : '❌'}
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        📦 Preload: {videoOptimization.recommendedPreload}
      </div>
      
      <div style={{ marginBottom: '3px' }}>
        🔊 Volume: {videoOptimization.recommendedVolume}
      </div>
      
      <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '5px' }}>
        PiP Buffer: {pipOptimization.getPiPOptimizations().bufferSize}s
      </div>
    </div>
  );
}
