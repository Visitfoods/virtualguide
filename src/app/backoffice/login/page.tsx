'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Credenciais simples para demonstração
      // Em produção, use autenticação Firebase ou similar
      if (username === 'admin' && password === 'guiareal123') {
        // Salvar estado de autenticação em localStorage
        localStorage.setItem('backofficeAuth', 'true');
        // Redirecionar para o backoffice
        router.push('/backoffice');
      } else {
        setError('Credenciais inválidas. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao fazer login:', err);
      setError('Ocorreu um erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <div className={styles.loginHeader}>
          <h1>Backoffice</h1>
          <p>Guia Real - Painel Administrativo</p>
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.loginForm} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username">Nome de Utilizador</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? 'A processar...' : 'Entrar'}
          </button>
        </form>

        <div className={styles.loginFooter}>
          <p>© {new Date().getFullYear()} Guia Real</p>
        </div>
      </div>
    </div>
  );
} 