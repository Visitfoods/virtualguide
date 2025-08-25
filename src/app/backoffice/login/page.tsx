'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password.trim()) {
      console.log('🔍 DEBUG: Campos vazios, abortando...');
      return;
    }

    try {
      console.log('🔍 DEBUG: Tentando login com novo sistema...');
      console.log('🔍 DEBUG: Credenciais:', { username, password: '***' });

      const success = await login({ username, password });
      console.log('🔍 DEBUG: Resultado do login:', success);

      if (success && success.success) {
        console.log('🔍 DEBUG: Login bem-sucedido, redirecionando...');
        const role = (success.user && (success.user as any).role) ? String((success.user as any).role) : 'user';
        const destination = role === 'admin' ? '/backoffice' : '/backoffice/conversations';
        console.log('🔍 DEBUG: Tentando redirecionar para', destination);

        try {
          console.log('🔍 DEBUG: Tentando router.push...');
          router.push(destination);

          setTimeout(() => {
            console.log('🔍 DEBUG: Fallback: usando window.location...');
            window.location.href = destination;
          }, 500);

        } catch (redirectError) {
          console.error('🔍 DEBUG: Erro no router.push:', redirectError);
          console.log('🔍 DEBUG: Usando window.location como fallback...');
          window.location.href = destination;
        }
      } else {
        console.log('🔍 DEBUG: Login falhou');
        console.log('🔍 DEBUG: Erro atual:', error);
      }
    } catch (err) {
      console.error('🔍 DEBUG: Erro no login:', err);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.loginHeader}>
          <h1>Backoffice VirtualGuide</h1>
          <p>Aceda ao seu painel de administração</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.formGroup}>
            <label htmlFor="username">
              Nome de Utilizador
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite o nome de utilizador"
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="password">
              Palavra-passe
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a palavra-passe"
              required
            />
          </div>
          
          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={isLoading}
          >
            {isLoading ? 'A entrar...' : 'Entrar'}
          </button>
        </form>
        
        <div className={styles.loginFooter}>
          <p>Sistema de Gestão VirtualGuide</p>
        </div>
      </div>
    </div>
  );
}
