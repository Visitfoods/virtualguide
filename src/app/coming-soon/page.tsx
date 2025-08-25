'use client';

import Image from 'next/image';
import styles from './coming-soon.module.css';
import { useState, useEffect } from 'react';

// Traduções para diferentes línguas
const translationsData = {
  england: {
    title: 'Coming Soon',
    subtitle: 'We are working to make this version available soon.',
    backButton: 'Back'
  },
  spain: {
    title: 'Próximamente',
    subtitle: 'Estamos trabajando para hacer esta versión disponible pronto.',
    backButton: 'Volver'
  },
  france: {
    title: 'Bientôt Disponible',
    subtitle: 'Nous travaillons pour rendre cette version disponible bientôt.',
    backButton: 'Retour'
  },
  portugal: {
    title: 'Disponível Brevemente',
    subtitle: 'Estamos a trabalhar para disponibilizar esta versão em breve.',
    backButton: 'Voltar'
  }
};

export default function ComingSoon() {
  const [, setCurrentLanguage] = useState('portugal');
  const [translations, setTranslations] = useState(translationsData.portugal);

  useEffect(() => {
    // Obter a língua selecionada do localStorage
    const selectedLanguage = localStorage.getItem('selectedLanguage');
    
    if (selectedLanguage && translationsData[selectedLanguage as keyof typeof translationsData]) {
      setCurrentLanguage(selectedLanguage);
      setTranslations(translationsData[selectedLanguage as keyof typeof translationsData]);
    }
  }, []);

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
        <h1 className={styles.title}>{translations.title}</h1>
        <p className={styles.subtitle}>
          {translations.subtitle}
        </p>
        <div className={styles.backButton}>
          <button onClick={() => window.history.back()}>
            {translations.backButton}
          </button>
        </div>
      </div>
    </div>
  );
} 