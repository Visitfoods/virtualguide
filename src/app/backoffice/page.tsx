'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './backoffice.module.css';

export default function BackofficeRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Verificar se o utilizador está autenticado
    const auth = localStorage.getItem('backofficeAuth');
    if (auth !== 'true') {
      // Se não estiver autenticado, redirecionar para login
      router.push('/backoffice/login');
    } else {
      // Se estiver autenticado, verificar o perfil
      const role = localStorage.getItem('backofficeRole');
      if (role === 'admin') {
        router.push('/backoffice/select');
      } else {
        router.push('/backoffice/dashboard');
      }
    }
  }, [router]);

  return (
    <div className={styles.loading}>
      <p>A carregar...</p>
    </div>
  );
} 