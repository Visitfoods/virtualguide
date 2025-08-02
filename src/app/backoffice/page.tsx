'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './backoffice.module.css';

export default function BackofficeRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Verificar se o usuário está autenticado
    const auth = localStorage.getItem('backofficeAuth');
    if (auth !== 'true') {
      // Se não estiver autenticado, redirecionar para login
      router.push('/backoffice/login');
    } else {
      // Se estiver autenticado, redirecionar para o dashboard
      router.push('/backoffice/dashboard');
    }
  }, [router]);

  return (
    <div className={styles.loading}>
      <p>A carregar...</p>
    </div>
  );
} 