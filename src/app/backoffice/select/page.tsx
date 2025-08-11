'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../backoffice.module.css';

export default function SelectDataSource() {
  const router = useRouter();

  useEffect(() => {
    const auth = localStorage.getItem('backofficeAuth');
    const role = localStorage.getItem('backofficeRole');
    if (auth !== 'true') {
      router.push('/backoffice/login');
      return;
    }
    if (role !== 'admin') {
      router.push('/backoffice/dashboard');
      return;
    }
  }, [router]);

  const choose = (source: 'default' | 'main') => {
    localStorage.setItem('backofficeDataSource', source);
    router.push('/backoffice/dashboard');
  };

  return (
    <div className={styles.backofficeContainer}>
      <header className={styles.backofficeHeader}>
        <h1>Backoffice - Escolher Origem de Dados</h1>
      </header>
      <div className={styles.backofficeContent} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0 }}>Selecione o que pretende visualizar</h2>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className={styles.filterButton} onClick={() => choose('default')}>Portugal dos Pequenitos</button>
            <button className={styles.filterButton} onClick={() => choose('main')}>Página Principal</button>
          </div>
        </div>
      </div>
    </div>
  );
}

