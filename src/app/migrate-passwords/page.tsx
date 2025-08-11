'use client';

import { useState } from 'react';
import { migratePasswordsToHash } from '../../utils/migratePasswords';

export default function MigratePasswords() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleMigrate = async () => {
    setStatus('loading');
    setMessage('🔄 A migrar passwords...');
    
    try {
      await migratePasswordsToHash();
      setStatus('success');
      setMessage('✅ Passwords migradas com sucesso!\n\nTodas as passwords estão agora encriptadas com bcrypt.\nPodes apagar esta página.');
    } catch (error) {
      setStatus('error');
      setMessage(`❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: 40,
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: 500,
        width: '90%',
        textAlign: 'center'
      }}>
        <h1 style={{ marginTop: 0, color: '#333' }}>🔐 Migração de Passwords</h1>
        
        <p style={{ color: '#666', marginBottom: 30, lineHeight: 1.6 }}>
          Esta página vai converter todas as passwords de texto plano para hash bcrypt na base de dados.
          <br/><br/>
          <strong>⚠️ Importante:</strong> Execute isto apenas uma vez!
        </p>

        {status === 'idle' && (
          <button
            onClick={handleMigrate}
            style={{
              backgroundColor: '#d9534f',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600
            }}
          >
            🔐 Migrar Passwords
          </button>
        )}

        {status === 'loading' && (
          <div style={{ color: '#666' }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #333',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            {message}
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <div style={{ 
            padding: 20, 
            borderRadius: 4,
            backgroundColor: status === 'success' ? '#d4edda' : '#f8d7da',
            color: status === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${status === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            whiteSpace: 'pre-line',
            textAlign: 'left'
          }}>
            {message}
          </div>
        )}

        {status === 'success' && (
          <div style={{ marginTop: 20 }}>
            <a 
              href="/backoffice/login"
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: 4,
                display: 'inline-block',
                fontWeight: 600
              }}
            >
              Ir para Login do Backoffice
            </a>
          </div>
        )}

        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}