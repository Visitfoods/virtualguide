'use client';

export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BackofficeAuthGuard from '../../../components/BackofficeAuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import { 
  listGuideConversations, 
  listenToActiveGuideConversations,
  closeGuideConversation,
  reopenGuideConversation,
  markGuideMessagesAsRead,
  addGuideConversationTags,
  getGuideStats,
  listAvailableGuides,
  listGuidesWithHumanChatEnabled,
  sendGuideMessage,
  createGuideConversation,
  listenToGuideConversations
} from '../../../firebase/guideServices';
import { GuideConversation, GuideChatMessage } from '../../../firebase/guideServices';
import styles from '../backoffice.module.css';

// Logger controlado por variável de ambiente para evitar ruído na consola
const debugLog = (...args: any[]) => {
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export default function ConversationsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<GuideConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<GuideConversation | null>(null);
  const [selectedGuide, setSelectedGuide] = useState('');
  const [availableGuides, setAvailableGuides] = useState<{ slug: string; name: string; company?: string }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guidesLoading, setGuidesLoading] = useState(true);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [sendingMessage, setSendingMessage] = useState(false);
  // Removido aviso visual de mensagem enviada
  const [newMessage, setNewMessage] = useState('');
  const [newTags, setNewTags] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [noGuideAccess, setNoGuideAccess] = useState(false);
  const [transitionMessageSent, setTransitionMessageSent] = useState<{[key: string]: boolean}>({});

  // Verificar autenticação e carregar apenas guias com chat humano ativo
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setRole('admin');
        loadAvailableGuides();
      } else {
        setRole('user');
        // Utilizador normal: bloquear ao guia associado
        if (user.guideSlug) {
          const guideSlug = String(user.guideSlug);
          setAvailableGuides([{ slug: guideSlug, name: guideSlug }]);
          setSelectedGuide(guideSlug);
          setGuidesLoading(false);
        } else {
          // Sem associação: mostrar mensagem e manter sessão
          setNoGuideAccess(true);
          setGuidesLoading(false);
        }
      }
    }
  }, [user]);

  // Carregar conversas quando o guia selecionado mudar
  useEffect(() => {
    if (selectedGuide && availableGuides.length > 0) {
      loadConversations();
      loadStats();
    }
  }, [selectedGuide, availableGuides]);

  // Subscrição em tempo real às conversas do guia selecionado
  useEffect(() => {
    if (!selectedGuide) return;

    debugLog('Mudando para o guia:', selectedGuide);
    debugLog('Project ID:', 'virtualguide-teste');
    // Limpar conversas ao mudar de guia
    setConversations([]);
    setSelectedConversation(null);

    const unsubscribe = listenToGuideConversations('virtualguide-teste', selectedGuide, (convs) => {
      debugLog('Listener recebeu conversas para o guia', selectedGuide, ':', convs.length, 'conversas');
      debugLog('Conversas recebidas:', convs);
      setConversations(convs);
      // Garantir que a conversa selecionada é atualizada com os dados mais recentes
      setSelectedConversation((prev) => {
        if (!prev) return prev;
        const updated = convs.find((c) => c.id === prev.id);
        return updated || prev;
      });
    });

    return () => {
      try { unsubscribe(); } catch (_) {}
    };
  }, [selectedGuide]);

  // Helper para formatar Timestamp do Firestore ou Date/string
  const toDateSafe = (value: any): Date => {
    if (!value) return new Date(0);
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.toMillis === 'function') return new Date(value.toMillis());
    return new Date(value);
  };

  const formatDateTime = (value: any): string => {
    const d = toDateSafe(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-PT');
  };

  const isWithinRangeLocal = (date: Date, startYmd?: string, endYmd?: string): boolean => {
    if (!date || isNaN(date.getTime())) return false;
    let startOk = true;
    let endOk = true;
    if (startYmd) {
      const [sy, sm, sd] = startYmd.split('-');
      const s = new Date(Number(sy), Number(sm) - 1, Number(sd), 0, 0, 0, 0);
      startOk = date >= s;
    }
    if (endYmd) {
      const [ey, em, ed] = endYmd.split('-');
      const e = new Date(Number(ey), Number(em) - 1, Number(ed), 23, 59, 59, 999);
      endOk = date <= e;
    }
    return startOk && endOk;
  };

  const loadAvailableGuides = async () => {
    try {
      setGuidesLoading(true);
      // Usar apenas guias com chat humano ativo e que estão ativos
      const guides = await listGuidesWithHumanChatEnabled('virtualguide-teste');
      setAvailableGuides(guides);
      // Selecionar dinamicamente o primeiro guia com chat humano ativo
      if (!selectedGuide && guides.length > 0) {
        setSelectedGuide(guides[0].slug);
      }
    } catch (error) {
      console.error('Erro ao carregar guias com chat humano ativo:', error);
      // Fallback vazio se algo falhar
      setAvailableGuides([]);
    } finally {
      setGuidesLoading(false);
    }
  };

  const loadConversations = async () => {
    if (!selectedGuide) return;
    
    try {
      setLoading(true);
      debugLog('Carregando conversas para o guia:', selectedGuide);
      debugLog('Project ID:', 'virtualguide-teste');
      const data = await listGuideConversations('virtualguide-teste', selectedGuide);
      debugLog('Conversas carregadas para o guia', selectedGuide, ':', data.length, 'conversas');
      debugLog('Dados das conversas:', data);
      setConversations(data);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      console.error('Detalhes do erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedGuide) return;
    
    try {
      const data = await getGuideStats('virtualguide-teste', selectedGuide);
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      
      // Enviar mensagem para o Firebase
      await sendGuideMessage('virtualguide-teste', selectedConversation.id!, {
        from: 'guide',
        text: newMessage,
        metadata: {
          guideResponse: true
        }
      });

      // Não recarregar toda a lista; o listener em tempo real atualiza automaticamente
      
      // Limpar campo de mensagem
      setNewMessage('');
      
      debugLog('Mensagem enviada e guardada no Firebase com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleCloseConversation = async (conversationId: string) => {
    try {
      await closeGuideConversation('virtualguide-teste', conversationId, 'admin', 'Fechada pelo administrador');
      await loadConversations();
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('Erro ao fechar conversa:', error);
    }
  };

  const handleReopenConversation = async (conversationId: string) => {
    try {
      await reopenGuideConversation('virtualguide-teste', conversationId);
      await loadConversations();
    } catch (error) {
      console.error('Erro ao reabrir conversa:', error);
    }
  };

  const handleMarkAsRead = async (conversationId: string) => {
    try {
      await markGuideMessagesAsRead('virtualguide-teste', conversationId);
      await loadConversations();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  // Removido: gestão de prioridade

  const handleAddTags = async (conversationId: string) => {
    if (!newTags.trim()) return;

    try {
      const tags = newTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      await addGuideConversationTags('virtualguide-teste', conversationId, tags);
      await loadConversations();
      setNewTags('');
    } catch (error) {
      console.error('Erro ao adicionar tags:', error);
    }
  };

  const createTestConversation = async () => {
    try {
      const testConversation = {
        guideSlug: selectedGuide,
        projectId: 'virtualguide-teste',
        userId: `test_user_${Date.now()}`,
        userName: `Utilizador de Teste - ${selectedGuide}`,
        userContact: 'teste@exemplo.com',
        userEmail: 'teste@exemplo.com',
        status: 'active' as const,
        priority: 'medium' as const,
        category: 'general' as const,
        messages: [
          {
            from: 'user' as const,
            text: `Olá! Esta é uma mensagem de teste para o guia ${selectedGuide} para verificar se o sistema está a funcionar.`,
            timestamp: new Date(),
            read: false
          }
        ]
      };

      const conversationId = await createGuideConversation('virtualguide-teste', testConversation);
      debugLog('Conversa de teste criada com ID:', conversationId, 'para o guia:', selectedGuide);
      
      // Recarregar conversas
      await loadConversations();
      
      alert(`Conversa de teste criada com sucesso para o guia ${selectedGuide}! ID: ${conversationId}`);
    } catch (error) {
      console.error('Erro ao criar conversa de teste:', error);
      alert('Erro ao criar conversa de teste: ' + error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    // Garantir que apenas conversas do guia selecionado sejam exibidas
    if (conv.guideSlug !== selectedGuide) {
      debugLog('Conversa filtrada por guia:', conv.id, 'Guia da conversa:', conv.guideSlug, 'Guia selecionado:', selectedGuide);
      return false;
    }
    
    if (filterStatus !== 'all' && conv.status !== filterStatus) return false;
    // Filtrar por intervalo de datas (com base em lastActivity; fallback em createdAt)
    if (filterStartDate || filterEndDate) {
      const baseDate = toDateSafe(conv.lastActivity || conv.createdAt);
      if (!isWithinRangeLocal(baseDate, filterStartDate || undefined, filterEndDate || undefined)) return false;
    }
    return true;
  });

  debugLog('Todas as conversas carregadas:', conversations.map(c => ({ id: c.id, guideSlug: c.guideSlug, status: c.status })));
  debugLog('Conversas filtradas para o guia', selectedGuide, ':', filteredConversations.length);

  // Selecionar automaticamente a conversa mais recente quando houver conversas
  useEffect(() => {
    if (selectedConversation || filteredConversations.length === 0) return;
    const sortedByRecent = [...filteredConversations].sort((a, b) => {
      const aTime = toDateSafe(a.lastActivity).getTime();
      const bTime = toDateSafe(b.lastActivity).getTime();
      return bTime - aTime;
    });
    setSelectedConversation(sortedByRecent[0]);
  }, [filteredConversations, selectedConversation]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'closed': return '#6c757d';
      case 'pending': return '#ffc107';
      case 'archived': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'ativa';
      case 'closed': return 'fechada';
      case 'pending': return 'pendente';
      case 'archived': return 'arquivada';
      default: return status;
    }
  };

  const getInitials = (name?: string): string => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  // Removido: cores de prioridade

  return (
    <BackofficeAuthGuard>
      {loading ? (
        <div className={styles.backofficeHome}>
          <nav className={styles.topNav}>
            <div className={styles.navContainer}>
              <div className={styles.navLeft}></div>
              <div className={styles.navRight}>
                <Link href="/backoffice/select" className={styles.navLink}>Guias</Link>
                <Link href="/backoffice/conversations" className={styles.navLink}>Conversas & Contactos</Link>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
                </div>
                <button 
                  className={styles.logoutButton}
                  onClick={() => {
                    logout().then(() => {
                      router.push('/backoffice/login');
                    });
                  }}
                >
                  <span className={styles.logoutIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                  </span>
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </nav>
        <div className={styles.mainContent}>
          <div className={styles.secondaryToolbar}>
            <div className={styles.toolbarLeft}>
              <button
                className={`${styles.toolbarIconButton} ${viewMode === 'list' ? styles.toolbarIconButtonActive : ''}`}
                onClick={() => setViewMode('list')}
                aria-label="Vista em lista"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>
              </button>
              <button
                className={`${styles.toolbarIconButton} ${viewMode === 'grid' ? styles.toolbarIconButtonActive : ''}`}
                onClick={() => setViewMode('grid')}
                aria-label="Vista em grelha"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>
              </button>

              {/* Mover o seletor de Guia para junto dos ícones */}
              {role === 'admin' && (
                <div className={styles.dropdownGroup}>
                  <span className={styles.dropdownLabel}>Guia (Chat Humano Ativo)</span>
                  <select
                    className={[styles.dropdownSelect, styles.guideHighlight, styles.guideSelectWide].join(' ')}
                    style={{ width: 597 }}
                    value={selectedGuide}
                    onChange={(e) => setSelectedGuide(e.target.value)}
                    title="Apenas guias com chat humano ativo e que estão ativos"
                  >
                    {guidesLoading ? (
                      <option value="">A carregar...</option>
                    ) : (
                      availableGuides.map((guide) => (
                        <option key={guide.slug} value={guide.slug}>
                          {(guide as any).company || guide.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>
            <div className={styles.toolbarRight}>
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>Estado</span>
                <select
                  className={styles.dropdownSelect}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativas</option>
                  <option value="closed">Fechadas</option>
                </select>
              </div>
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>De</span>
                <input
                  type="date"
                  className={styles.dropdownSelect}
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>Até</span>
                <input
                  type="date"
                  className={styles.dropdownSelect}
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className={styles.loading}>A carregar conversas...</div>
        </div>
        </div>
      ) : noGuideAccess ? (
        <div className={styles.backofficeHome}>
          <nav className={styles.topNav}>
            <div className={styles.navContainer}>
              <div className={styles.navLeft}></div>
              <div className={styles.navRight}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.username ? String(user.username) : ''}</span>
                </div>
                <button 
                  className={styles.logoutButton}
                  onClick={() => {
                    logout().then(() => {
                      router.push('/backoffice/login');
                    });
                  }}
                >
                  <span className={styles.logoutIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                  </span>
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </nav>
          <div className={styles.mainContent}>
            <div className={styles.noConversationsBox}>
              Esta conta não está associada a nenhum Guia. Contacte o administrador.
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.backofficeHome}>
      <nav className={styles.topNav}>
        <div className={styles.navContainer}>
          <div className={styles.navLeft}>
            {role !== 'admin' && (
              <img src="/Icon Virtualguide.svg" alt="VirtualGuide" className={styles.navLogo} />
            )}
          </div>
          <div className={styles.navRight}>
            {role === 'admin' ? (
              <>
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
              </>
            ) : (
              <></>
            )}
            <div className={styles.userInfo}>
              <span className={styles.userIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z"/>
                </svg>
              </span>
              {role !== 'admin' && (
                <span className={styles.navHintUser}>conta de utilizador</span>
              )}
              <span className={styles.userName}>{user?.username ? String(user.username) : 'Admin'}</span>
            </div>
            {role !== 'admin' && (
              <span className={styles.navLink} style={{ pointerEvents: 'none' }}>Conversas</span>
            )}
            <button 
              className={styles.logoutButton}
              onClick={() => {
                logout().then(() => {
                  router.push('/backoffice/login');
                });
              }}
            >
              <span className={styles.logoutIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </span>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </nav>
      <div className={styles.mainContent}>
        <div className={styles.secondaryToolbar}>
          <div className={styles.toolbarLeft}>
            <button
              className={`${styles.toolbarIconButton} ${viewMode === 'list' ? styles.toolbarIconButtonActive : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="Vista em lista"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>
            </button>
            <button
              className={`${styles.toolbarIconButton} ${viewMode === 'grid' ? styles.toolbarIconButtonActive : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Vista em grelha"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/></svg>
            </button>

            {/* Mover o seletor de Guia para junto dos ícones */}
            {role === 'admin' && (
              <div className={styles.dropdownGroup}>
                <span className={styles.dropdownLabel}>Guia</span>
                <select
                  className={[styles.dropdownSelect, styles.guideHighlight, styles.guideSelectWide].join(' ')}
                  style={{ width: 597 }}
                  value={selectedGuide}
                  onChange={(e) => setSelectedGuide(e.target.value)}
                >
                  {guidesLoading ? (
                    <option value="">A carregar...</option>
                  ) : (
                    availableGuides.map((guide) => (
                      <option key={guide.slug} value={guide.slug}>
                        {(guide as any).company || guide.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>
          <div className={styles.toolbarRight}>
            <div className={styles.dropdownGroup}>
              <span className={styles.dropdownLabel}>Estado</span>
              <select
                className={styles.dropdownSelect}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">Todos</option>
                <option value="active">Ativas</option>
                <option value="closed">Fechadas</option>
              </select>
            </div>
            <div className={styles.dropdownGroup}>
              <span className={styles.dropdownLabel}>De</span>
              <input
                type="date"
                className={styles.dropdownSelect}
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div className={styles.dropdownGroup}>
              <span className={styles.dropdownLabel}>Até</span>
              <input
                type="date"
                className={styles.dropdownSelect}
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Total de Conversas</h3>
              <p>{stats.totalConversations}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Conversas Ativas</h3>
              <p>{stats.activeConversations}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Tempo Médio de Resposta</h3>
              <p>{Math.round(stats.averageResponseTime / 1000)}s</p>
            </div>
          </div>
        )}

        {/* (removido filtro de prioridade) */}

        {viewMode === 'list' ? (
          <div className={`${styles.conversationsLayout} ${filteredConversations.length === 0 ? styles.conversationsLayoutFull : ''}`}>
          {/* Lista de Conversas */}
          <div className={styles.conversationsList}>
            <h2>Conversas ({filteredConversations.length})</h2>
            {filteredConversations.length === 0 && (
              <div className={styles.noConversationsBox}>
                Não existem conversas para este filtro.
              </div>
            )}
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`${styles.conversationItem} ${
                  selectedConversation?.id === conversation.id ? styles.selected : ''
                }`}
                onClick={() => setSelectedConversation(conversation)}
              >
                <div className={styles.conversationHeader}>
                  <h4>{conversation.userName}</h4>
                  <div className={styles.conversationMeta}>
                    <span 
                      className={styles.statusBadge}
                      style={{ backgroundColor: getStatusColor(conversation.status) }}
                    >
                      {getStatusText(conversation.status)}
                    </span>
                    
                  </div>
                </div>
                <p className={styles.conversationPreview}>
                  {conversation.messages[conversation.messages.length - 1]?.text || 'Sem mensagens'}
                </p>
                <div className={styles.conversationFooter}>
                  <span className={styles.timestamp}>
                    {formatDateTime(conversation.lastActivity)}
                  </span>
                  {(conversation.unreadCount || 0) > 0 && (
                    <span className={styles.unreadBadge}>
                      {conversation.unreadCount || 0}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Detalhes da Conversa */}
          {selectedConversation && (
            <div className={styles.conversationDetails}>
              <div className={styles.conversationHeader}>
                <h2>Conversa com {selectedConversation.userName}</h2>
                <div className={styles.conversationActions}>
                  {selectedConversation.status !== 'closed' && (
                    <button
                      className={styles.actionButton}
                      onClick={() => handleCloseConversation(selectedConversation.id!)}
                    >
                      Encerrar conversa
                    </button>
                  )}
                </div>
              </div>

              {/* Informações do Utilizador - card com glass e chips */}
              <div className={styles.userInfoCard}>
                <div className={styles.userHeaderRow}>
                  <div className={styles.userHeaderLeft}>
                    <div className={styles.userAvatar}>{getInitials(selectedConversation.userName)}</div>
                    <div>
                      <div className={styles.userName}>{selectedConversation.userName}</div>
                      {selectedConversation.userEmail && (
                        <div className={styles.userEmail}>{selectedConversation.userEmail}</div>
                      )}
                    </div>
                  </div>
                  <div className={styles.userHeaderRight}>
                    <span className={`${styles.chip} ${
                      selectedConversation.status === 'active' ? styles.chipActive :
                      selectedConversation.status === 'closed' ? styles.chipClosed :
                      selectedConversation.status === 'pending' ? styles.chipPending :
                      styles.chipRed
                    }`}>
                      {getStatusText(selectedConversation.status)}
                    </span>
                  </div>
                </div>
                {/* Meta removida a pedido */}
              </div>

              {/* Gestão de Tags */}
              <div className={styles.conversationManagement}>
                
                <div className={styles.tagsManager}>
                  <label>Tags:</label>
                  <div className={styles.tagsList}>
                    {selectedConversation.tags?.map((tag, index) => (
                      <span key={index} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                  <div className={styles.addTags}>
                    <input
                      type="text"
                      placeholder="Adicionar tags (separadas por vírgula)"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                    />
                    <button onClick={() => handleAddTags(selectedConversation.id!)}>
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {/* Mensagens */}
              <div className={styles.messagesContainer}>
                <div className={styles.messagesList}>
                  {selectedConversation.messages.map((message, index) => (
                    <div
                      key={index}
                      className={`${styles.message} ${
                        message.from === 'user' ? styles.userMessage : styles.guideMessage
                      }`}
                    >
                      <div className={styles.messageHeader}>
                        <span className={styles.messageAuthor}>
                          {message.from === 'user' ? selectedConversation.userName : 'Guia'}
                        </span>
                        <span className={styles.messageTime}>
                          {formatDateTime(message.timestamp)}
                        </span>
                      </div>
                      <div className={styles.messageContent}>
                        {message.text}
                      </div>
                      {message.metadata?.guideResponse && (
                        <span className={styles.guideResponseBadge}>Resposta do Guia</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Enviar Nova Mensagem (fora da caixa) */}
              <div className={`${styles.sendMessage} ${styles.sendMessageCompact}`}>
                <div className={styles.messageInput}>
                  <textarea
                    value={newMessage}
                    onChange={async (e) => {
                      setNewMessage(e.target.value);
                      
                      // Se é a primeira vez que o gestor começa a escrever nesta conversa
                      if (!newMessage && e.target.value && selectedConversation && !transitionMessageSent[selectedConversation.id!]) {
                        const transitionText = 'Vejo que já falou com o nosso guia virtual. A partir daqui será a guia real a responder';
                        // Evitar duplicados se já existir mensagem de transição na conversa
                        const alreadyHasTransition = selectedConversation.messages.some(m => 
                          typeof m.text === 'string' && m.text.trim() === transitionText
                        );
                        if (alreadyHasTransition) {
                          return;
                        }
                        // Verificar se existiu uma interação real com o chatbot: pergunta do utilizador + resposta do bot
                        const hasChatbotQuestion = selectedConversation.messages.some(msg =>
                          msg.from === 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0
                        );
                        const hasChatbotAnswer = selectedConversation.messages.some(msg =>
                          msg.from !== 'user' && msg.metadata?.fromChatbot === true && typeof msg.text === 'string' && msg.text.trim().length > 0 && msg.text.trim() !== '...'
                        );
                        const hasChatbotInteraction = hasChatbotQuestion && hasChatbotAnswer;
                        
                        if (hasChatbotInteraction) {
                          // Enviar mensagem automática quando o gestor começa a escrever
                          try {
                            await sendGuideMessage('virtualguide-teste', selectedConversation.id!, {
                              from: 'guide',
                              text: 'Vejo que já falou com o nosso guia virtual. A partir daqui será a guia real a responder',
                              metadata: {
                                guideResponse: true,
                                messageType: 'text'
                              }
                            });
                            // Marcar que a mensagem foi enviada para esta conversa
                            setTransitionMessageSent(prev => ({
                              ...prev,
                              [selectedConversation.id!]: true
                            }));
                          } catch (error) {
                            console.error('Erro ao enviar mensagem automática:', error);
                          }
                        } else {
                          console.log('🔍 Utilizador não falou com guia AI - não enviando mensagem de transição');
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Digite a sua mensagem..."
                    rows={2}
                    disabled={sendingMessage}
                  />
                  <button 
                    onClick={handleSendMessage} 
                    disabled={!newMessage.trim() || sendingMessage}
                    className={sendingMessage ? styles.sendingButton : ''}
                  >
                    {sendingMessage ? 'A enviar...' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        ) : (
          <>
            <div className={styles.conversationsGrid}>
              {filteredConversations.length === 0 && (
                <div className={`${styles.noConversationsBox} ${styles.noConversationsWide}`}>
                  Não existem conversas para este filtro.
                </div>
              )}
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={styles.conversationCard}
                  onClick={() => setSelectedConversation(conversation)}
                >
                  <div className={styles.conversationHeader}>
                    <h4>{conversation.userName}</h4>
                    <div className={styles.conversationMeta}>
                      <span 
                        className={styles.statusBadge}
                        style={{ backgroundColor: getStatusColor(conversation.status) }}
                      >
                        {getStatusText(conversation.status)}
                      </span>
                      
                    </div>
                  </div>
                  <p className={styles.conversationPreview}>
                    {conversation.messages[conversation.messages.length - 1]?.text || 'Sem mensagens'}
                  </p>
                  <div className={styles.conversationFooter}>
                    <span className={styles.timestamp}>
                      {formatDateTime(conversation.lastActivity)}
                    </span>
                    {(conversation.unreadCount || 0) > 0 && (
                      <span className={styles.unreadBadge}>
                        {conversation.unreadCount || 0}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedConversation && (
              <div style={{ marginTop: '2rem' }}>
                <div className={styles.conversationDetails}>
                  <div className={styles.conversationHeader}>
                    <h2>Conversa com {selectedConversation.userName}</h2>
                    <div className={styles.conversationActions}>
                      {selectedConversation.status !== 'closed' && (
                        <button
                          className={styles.actionButton}
                          onClick={() => handleCloseConversation(selectedConversation.id!)}
                        >
                          Encerrar conversa
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Informações do Utilizador - card com glass e chips */}
                  <div className={styles.userInfoCard}>
                    <div className={styles.userHeaderRow}>
                      <div className={styles.userHeaderLeft}>
                        <div className={styles.userAvatar}>{getInitials(selectedConversation.userName)}</div>
                        <div>
                          <div className={styles.userName}>{selectedConversation.userName}</div>
                          {selectedConversation.userEmail && (
                            <div className={styles.userEmail}>{selectedConversation.userEmail}</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.userHeaderRight}>
                        <span className={`${styles.chip} ${
                          selectedConversation.status === 'active' ? styles.chipActive :
                          selectedConversation.status === 'closed' ? styles.chipClosed :
                          selectedConversation.status === 'pending' ? styles.chipPending :
                          styles.chipRed
                        }`}>
                          {getStatusText(selectedConversation.status)}
                        </span>
                      </div>
                    </div>
                    <div className={styles.userMetaRow}>
                      {selectedConversation.userContact && (
                        !selectedConversation.userEmail ||
                        selectedConversation.userContact.trim().toLowerCase() !==
                          selectedConversation.userEmail.trim().toLowerCase()
                      ) && (
                        <span className={styles.metaItem}>{selectedConversation.userContact}</span>
                      )}
                      {selectedConversation.userPhone && (
                        <span className={styles.metaItem}>{selectedConversation.userPhone}</span>
                      )}
                    </div>
                  </div>

                  {/* Gestão de Tags */}
                  <div className={styles.conversationManagement}>
                    
                    <div className={styles.tagsManager}>
                      <label>Tags:</label>
                      <div className={styles.tagsList}>
                        {selectedConversation.tags?.map((tag, index) => (
                          <span key={index} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                      <div className={styles.addTags}>
                        <input
                          type="text"
                          placeholder="Adicionar tags (separadas por vírgula)"
                          value={newTags}
                          onChange={(e) => setNewTags(e.target.value)}
                        />
                        <button onClick={() => handleAddTags(selectedConversation.id!)}>
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mensagens */}
                  <div className={styles.messagesContainer}>
                    <div className={styles.messagesList}>
                      {selectedConversation.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`${styles.message} ${
                            message.from === 'user' ? styles.userMessage : styles.guideMessage
                          }`}
                        >
                          <div className={styles.messageHeader}>
                            <span className={styles.messageAuthor}>
                              {message.from === 'user' ? selectedConversation.userName : 'Guia'}
                            </span>
                            <span className={styles.messageTime}>
                              {formatDateTime(message.timestamp)}
                            </span>
                          </div>
                          <div className={styles.messageContent}>
                            {message.text}
                          </div>
                          {message.metadata?.guideResponse && (
                            <span className={styles.guideResponseBadge}>Resposta do Guia</span>
                          )}
                        </div>
                      ))}

                      
                    </div>
                  </div>

                  {/* Enviar Nova Mensagem (fora da caixa) */}
                  <div className={`${styles.sendMessage} ${styles.sendMessageCompact}`}>
                    <div className={styles.messageInput}>
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        placeholder="Digite a sua mensagem..."
                        rows={2}
                        disabled={sendingMessage}
                      />
                      <button 
                        onClick={handleSendMessage} 
                        disabled={!newMessage.trim() || sendingMessage}
                        className={sendingMessage ? styles.sendingButton : ''}
                      >
                        {sendingMessage ? 'A enviar...' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
      )}
    </BackofficeAuthGuard>
  );
}
