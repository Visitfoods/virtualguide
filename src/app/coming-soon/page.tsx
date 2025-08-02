'use client';

import Image from 'next/image';
import styles from './coming-soon.module.css';

export default function ComingSoon() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <Image 
            src="/favicon.jpg" 
            alt="Logo" 
            className={styles.logo}
            width={150}
            height={150}
          />
        </div>
        <h1 className={styles.title}>Disponível Brevemente</h1>
        <p className={styles.subtitle}>
          Estamos a trabalhar para disponibilizar esta versão em breve.
        </p>
        <div className={styles.backButton}>
          <button onClick={() => window.history.back()}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
} 