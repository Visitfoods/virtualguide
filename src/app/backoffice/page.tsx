'use client';

export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import BackofficeAuthGuard from '../../components/BackofficeAuthGuard';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import styles from './backoffice.module.css';

interface GuideData {
  id: string;
  name: string;
  company?: string;
  chatIconURL?: string;
  createdAt?: any;
  isActive?: boolean;
}

export default function BackofficeRedirect() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [recentGuides, setRecentGuides] = useState<GuideData[]>([]);

  // Configuração fixa do Firebase para o projeto virtualguide-teste
  const TARGET_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
    authDomain: 'virtualguide-teste.firebaseapp.com',
    projectId: 'virtualguide-teste',
    storageBucket: 'virtualguide-teste.firebasestorage.app',
    messagingSenderId: '101459525297',
    appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
    measurementId: ''
  } as const;

  // Inicializar Firebase para o projeto virtualguide-teste
  const targetApp = (() => {
    const appName = 'vg-virtualguide-teste-backoffice';
    const existing = getApps().find(a => a.name === appName);
    if (existing) return existing;
    return initializeApp(TARGET_FIREBASE_CONFIG, appName);
  })();
  
  const targetDb = getFirestore(targetApp);

  useEffect(() => {
    // Se não estiver autenticado, redirecionar para login
    if (!authLoading && !isAuthenticated) {
      console.log('🔍 DEBUG: Não autenticado, redirecionando para login...');
      router.push('/backoffice/login');
      return;
    }
    
    // Se estiver autenticado, carregar dados
    if (isAuthenticated && user) {

      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user, router]);

  // Buscar os últimos guias criados diretamente do projeto virtualguide-teste
  useEffect(() => {
    const fetchRecentGuides = async () => {
      try {
        console.log('🔍 Buscando guias do projeto virtualguide-teste...');
        
        // Buscar diretamente do projeto virtualguide-teste
        const guidesRef = collection(targetDb, 'guides');
        const q = query(guidesRef, orderBy('createdAt', 'desc'), limit(12));
        const querySnapshot = await getDocs(q);
        const guides = querySnapshot.docs.map((snap: any) => {
          const data = snap.data() as any;
          
          return {
            id: snap.id,
            name: data?.name || snap.id,
            company: data?.company || '',
            chatIconURL: data?.chatIconURL,
            createdAt: data?.createdAt,
            isActive: data?.isActive !== false,
          } as GuideData;
        });

        console.log('✅ Guias carregados do projeto virtualguide-teste:', guides.length);
        setRecentGuides(guides.slice(0, 4));
      } catch (error) {
        console.error('❌ Erro ao buscar guias do projeto virtualguide-teste:', error);
        setRecentGuides([]);
      }
    };



    if (isAuthenticated) {
      fetchRecentGuides();
    }
  }, [isAuthenticated, targetDb]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      // Se não for superadmin, redirecionar automaticamente
      if (user?.role !== 'admin') {
        router.push('/backoffice/conversations');
      }
    } else if (!isLoading && !isAuthenticated) {
      // Se não estiver autenticado, redirecionar para login
      router.push('/backoffice/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>A carregar...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Será redirecionado
  }

  if (user?.role !== 'admin') {
    return null; // Será redirecionado
  }

  // Mostrar opções para superadmin
  return (
    <BackofficeAuthGuard requiredRole="admin">
      <div className={styles.backofficeHome}>
        {/* Barra de navegação pequena no topo */}
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}></div>
          <div className={styles.navRight}>
              <Link href="/backoffice" className={styles.navLink}>Administração</Link>
              <Link href="/backoffice/select" className={styles.navLink}>Guias</Link>
              <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
              <Link href="/backoffice/users" className={styles.navLink}>Utilizadores</Link>
              <button 
                className={styles.navLink}
                onClick={() => router.push('/backoffice/users?create=1')}
                style={{ 
                  background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                Adicionar Utilizador
              </button>
              <button 
                className={styles.navLink}
                onClick={() => router.push('/backoffice/select?create=1')}
                style={{ 
                  background: 'linear-gradient(135deg, #4ecdc4, #45b7aa)',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  fontWeight: '600'
                }}
              >
                Adicionar Guias
              </button>
              <div className={styles.userInfo}>
                <span className={styles.userIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                  </svg>
                </span>
                <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
              </div>
              <button 
                onClick={() => {
                  console.log('🔍 DEBUG: Logout solicitado...');
                  logout().then(() => {
                    console.log('🔍 DEBUG: Logout bem-sucedido, redirecionando...');
                    router.push('/backoffice/login');
                  }).catch((error) => {
                    console.error('🔍 DEBUG: Erro no logout:', error);
                  });
                }}
                className={styles.logoutButton}
              >
                <svg className={styles.logoutIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sair
              </button>
            </div>
        </div>
      </nav>
      
      <div className={styles.mainContent}>
        <div className={styles.welcomeSection}>
          <h1>Bem-vindo ao painel de administração</h1>
          <p>Escolha uma das opções abaixo para começar</p>
        </div>
        
        <div className={styles.backofficeActions}>
          <Link href="/backoffice/select" className={styles.backofficeActionButton}>
            <span className={styles.actionIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
            </span>
            <div className={styles.actionContent}>
              <h3>Criar/Editar Guias</h3>
              <p>Gerir guias virtuais, FAQs e informações de contacto</p>
            </div>
          </Link>
          
          <Link href="/backoffice/conversations" className={styles.backofficeActionButton}>
            <span className={styles.actionIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M6,9H18V11H6M14,14H6V12H14M18,8H6V6H18"/>
              </svg>
            </span>
            <div className={styles.actionContent}>
              <h3>Conversas e Contactos</h3>
              <p>Gerir conversas de chat e pedidos de contacto dos guias</p>
            </div>
          </Link>

          <Link href="/backoffice/users" className={styles.backofficeActionButton}>
            <span className={styles.actionIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </span>
            <div className={styles.actionContent}>
              <h3>Gestão de Utilizadores</h3>
              <p>Criar, editar e gerir permissões dos utilizadores</p>
            </div>
          </Link>
        </div>

        {/* Grid dos últimos guias criados */}
        <div className={styles.recentGuidesSection}>
          <h2 className={styles.sectionTitle}>Últimos Guias Criados</h2>
          <div className={styles.guidesGrid}>
            {recentGuides.map((guide) => {
              // Função auxiliar para obter o título do guia
              const getGuideTitle = () => {
                if (guide.company && guide.company.trim()) {
                  return guide.company;
                }
                return guide.name;
              };
              
              const guideTitle = getGuideTitle();
              
              return (
              <div key={guide.id} className={styles.guideCard}>
                                <div className={styles.cardHeader}>
                  <div className={styles.statusIndicator}>
                    <span className={`${styles.statusDot} ${guide.isActive ? styles.active : styles.inactive}`}></span>
                  </div>
                </div>
                
                <div className={styles.guideAvatar}>
                  {guide.chatIconURL ? (
                    <Image
                      src={guide.chatIconURL}
                      alt={guideTitle}
                      width={80}
                      height={80}
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {guideTitle.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                </div>
                
                <div className={styles.guideInfo}>
                  <h3 className={styles.guideName}>{guideTitle}</h3>
                  {guide.company && guide.company.trim() && guide.company !== guide.name && (
                    <p className={styles.guideSlug} style={{ color: '#888', fontSize: '0.8rem', margin: '2px 0' }}>
                      {guide.name}
                    </p>
                  )}
                  <p className={styles.guideType}>Guia Virtual</p>
                </div>
                
                <div className={styles.guideDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Criado:</span>
                    <span className={styles.detailValue}>
                      {guide.createdAt ? new Date(guide.createdAt.toDate()).toLocaleDateString('pt-PT') : 'N/A'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status:</span>
                    <span className={`${styles.detailValue} ${guide.isActive ? styles.statusActive : styles.statusInactive}`}>
                      {guide.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
                
                <Link href={`/backoffice/select?guide=${guide.id}`} className={styles.viewDetailsButton}>
                  VER DETALHES
                </Link>
              </div>
            );
            })}
          </div>
        </div>
      </div>
    </div>
    </BackofficeAuthGuard>
  );
} 