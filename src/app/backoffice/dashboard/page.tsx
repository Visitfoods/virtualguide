'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  listConversations, 
  listActiveConversations, 
  listenToAllConversations,
  listenToActiveConversations,
  listenToConversation,
  type Conversation as BackofficeConversation, 
  sendMessage, 
  markAllMessagesAsRead, 
  closeConversation,
  deleteAllConversations
  // reopenConversation - commented out to fix ESLint warning
} from '../../../firebase/services';
import {
  listenToAllMainConversations,
  listenToActiveMainConversations,
  listenToMainConversation,
  listMainConversations,
  listActiveMainConversations,
  type Conversation as MainConversation
} from '../../../firebase/mainServices';
import styles from '../backoffice.module.css';
import { getPromoSettings, updatePromoSettings } from '../../../firebase/settingsService';

export default function BackofficeDashboard() {
  const [conversations, setConversations] = useState<BackofficeConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<BackofficeConversation | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active'>('active');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [dataSource, setDataSource] = useState<'default' | 'main'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('backofficeDataSource') as 'default' | 'main' | null;
      return stored || 'default';
    }
    return 'default';
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversations, setDeletingConversations] = useState(false);
  const [visibleConversations, setVisibleConversations] = useState(10); // Mostrar apenas 10 conversas inicialmente
  const [promoEnabled, setPromoEnabled] = useState<boolean>(false);
  const [loadingPromo, setLoadingPromo] = useState<boolean>(false);
  const router = useRouter();
  
  // Referências para os unsubscribes das escutas em tempo real
  const unsubscribeConversationsRef = useRef<(() => void) | null>(null);
  const unsubscribeSelectedConversationRef = useRef<(() => void) | null>(null);

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('backofficeAuth');
      if (auth !== 'true') {
        router.push('/backoffice/login');
      } else {
        setIsAuthenticated(true);
        const storedRole = (localStorage.getItem('backofficeRole') as 'user' | 'admin') || 'user';
        setRole(storedRole);
        // Admin pode alternar fonte de dados; utilizador fica no default
        if (storedRole !== 'admin') {
          setDataSource('default');
          localStorage.removeItem('backofficeDataSource');
        }
      }
    };

    checkAuth();
  }, [router]);

  // Carregar estado do Modo Promoção (apenas admin)
  useEffect(() => {
    if (!isAuthenticated || role !== 'admin') return;
    let mounted = true;
    (async () => {
      try {
        setLoadingPromo(true);
        const settings = await getPromoSettings();
        if (!mounted) return;
        setPromoEnabled(!!settings?.promoMode?.enabled);
      } catch (e) {
        setPromoEnabled(false);
      } finally {
        setLoadingPromo(false);
      }
    })();
    return () => { mounted = false; };
  }, [isAuthenticated, role]);

  // Carregar conversas em tempo real
  useEffect(() => {
    if (!isAuthenticated) return;

    // Limpar qualquer escuta anterior
    if (unsubscribeConversationsRef.current) {
      unsubscribeConversationsRef.current();
      unsubscribeConversationsRef.current = null;
    }

    setLoading(true);

    try {
      // Configurar escuta em tempo real com base no filtro e na fonte de dados
      let unsubscribe: (() => void) | null = null;
      if (dataSource === 'default') {
        unsubscribe = filter === 'all'
          ? listenToAllConversations((data) => {
              if (Array.isArray(data)) {
                setConversations(data);
                setError(null);
              } else {
                console.error('Formato de dados inválido:', data);
                setError('Erro ao carregar conversas: formato de dados inválido.');
                setConversations([]);
              }
              setLoading(false);
            })
          : listenToActiveConversations((data) => {
              if (Array.isArray(data)) {
                setConversations(data);
                setError(null);
              } else {
                console.error('Formato de dados inválido:', data);
                setError('Erro ao carregar conversas: formato de dados inválido.');
                setConversations([]);
              }
              setLoading(false);
            });
      } else {
        // Fonte de dados: página principal (mainDb)
        const mapMainToBackoffice = (items: MainConversation[]) => {
          const mapped = items.map((c) => ({
            id: c.id,
            userId: c.userId,
            userName: c.userName,
            userContact: c.userEmail,
            status: c.status,
            createdAt: c.createdAt as unknown as string | Date,
            updatedAt: c.updatedAt as unknown as string | Date,
            messages: (c.messages || []).map((m) => ({
              from: m.from === 'bot' ? 'agent' : 'user',
              text: m.text,
              timestamp: m.timestamp,
              read: m.read,
            })),
            unreadCount: (c.messages || []).filter((m) => m.from === 'user' && m.read === false).length,
          })) as BackofficeConversation[];
          setConversations(mapped);
          setError(null);
          setLoading(false);
        };

        unsubscribe = filter === 'all'
          ? listenToAllMainConversations((data) => mapMainToBackoffice(data))
          : listenToActiveMainConversations((data) => mapMainToBackoffice(data));
      }

      // Guardar a função de unsubscribe para limpeza posterior
      unsubscribeConversationsRef.current = unsubscribe || null;
    } catch (err) {
      console.error('Erro ao configurar escuta em tempo real:', err);
      setError(`Erro ao configurar escuta em tempo real: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setConversations([]);
      setLoading(false);
      
      // Tentar carregar de forma não tempo real como fallback
      const fetchConversations = async () => {
        try {
          let data: BackofficeConversation[];
          if (dataSource === 'default') {
            data = filter === 'all' 
              ? await listConversations()
              : await listActiveConversations();
          } else {
            const mainData = filter === 'all'
              ? await listMainConversations()
              : await listActiveMainConversations();
            // Mapear
            data = mainData.map((c) => ({
              id: c.id,
              userId: c.userId,
              userName: c.userName,
              userContact: c.userEmail,
              status: c.status,
                          createdAt: c.createdAt as unknown as string | Date,
            updatedAt: c.updatedAt as unknown as string | Date,
              messages: (c.messages || []).map((m) => ({
                from: m.from === 'bot' ? 'agent' : 'user',
                text: m.text,
                timestamp: m.timestamp,
                read: m.read,
              })),
              unreadCount: (c.messages || []).filter((m) => m.from === 'user' && m.read === false).length,
            })) as BackofficeConversation[];
          }
          
          if (Array.isArray(data)) {
            setConversations(data);
            setError(null);
          }
        } catch (fetchErr) {
          console.error('Erro no fallback de carregamento:', fetchErr);
        } finally {
          setLoading(false);
        }
      };
      
      fetchConversations();
    }

    // Limpeza ao desmontar ou quando o filtro mudar
    return () => {
      if (unsubscribeConversationsRef.current) {
        unsubscribeConversationsRef.current();
        unsubscribeConversationsRef.current = null;
      }
    };
  }, [filter, isAuthenticated, refreshTrigger, dataSource]); // Incluir dataSource

  // Selecionar conversa com escuta em tempo real
  const handleSelectConversation = async (conversation: BackofficeConversation) => {
    // Limpar qualquer escuta anterior da conversa selecionada
    if (unsubscribeSelectedConversationRef.current) {
      unsubscribeSelectedConversationRef.current();
      unsubscribeSelectedConversationRef.current = null;
    }
    
    // Definir a conversa selecionada inicialmente
    setSelectedConversation(conversation);
    
    // Marcar mensagens como lidas (apenas para fonte default)
    if (dataSource === 'default') {
      if (conversation.id && conversation.unreadCount && conversation.unreadCount > 0) {
        try {
          await markAllMessagesAsRead(conversation.id);
        } catch (err) {
          console.error('Erro ao marcar mensagens como lidas:', err);
        }
      }
    }
    
    // Configurar escuta em tempo real para a conversa selecionada
    if (conversation.id) {
      try {
        if (dataSource === 'default') {
          const unsubscribe = listenToConversation(conversation.id, (updatedConversation) => {
            setSelectedConversation(updatedConversation);
          });
          unsubscribeSelectedConversationRef.current = unsubscribe;
        } else {
          const unsubscribe = listenToMainConversation(conversation.id, (updatedMainConversation) => {
            // Mapear para o formato do backoffice
            const mapped: BackofficeConversation = {
              id: updatedMainConversation.id,
              userId: updatedMainConversation.userId,
              userName: updatedMainConversation.userName,
              userContact: updatedMainConversation.userEmail,
              status: updatedMainConversation.status,
              createdAt: updatedMainConversation.createdAt as unknown as string,
              updatedAt: updatedMainConversation.updatedAt as unknown as string,
              messages: (updatedMainConversation.messages || []).map((m) => ({
                from: m.from === 'bot' ? 'agent' : 'user',
                text: m.text,
                timestamp: m.timestamp,
                read: m.read,
              })),
              unreadCount: (updatedMainConversation.messages || []).filter((m) => m.from === 'user' && m.read === false).length,
            };
            setSelectedConversation(mapped);
          });
          unsubscribeSelectedConversationRef.current = unsubscribe;
        }
      } catch (err) {
        console.error('Erro ao configurar escuta para conversa selecionada:', err);
      }
    }
  };

  // Enviar mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedConversation?.id || !message.trim()) return;
    
    try {
      await sendMessage(selectedConversation.id, {
        from: 'agent',
        text: message,
        read: true
      });
      
      setMessage('');
      // Não precisamos mais atualizar manualmente, pois a escuta em tempo real fará isso
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setError('Erro ao enviar mensagem. Verifique o console para mais detalhes.');
    }
  };
  
  // Limpar todas as escutas quando o componente for desmontado
  useEffect(() => {
    return () => {
      // Limpar escuta das conversas
      if (unsubscribeConversationsRef.current) {
        unsubscribeConversationsRef.current();
        unsubscribeConversationsRef.current = null;
      }
      
      // Limpar escuta da conversa selecionada
      if (unsubscribeSelectedConversationRef.current) {
        unsubscribeSelectedConversationRef.current();
        unsubscribeSelectedConversationRef.current = null;
      }
    };
  }, []);

  // Fechar conversa
  const handleCloseConversation = async () => {
    if (!selectedConversation?.id) return;
    
    try {
      // Enviar mensagem de despedida antes de fechar a conversa
              const closingMessageText = "Agradecemos o seu contacto. Esta conversa fica agora encerrada. Caso necessite de mais informações, estaremos sempre ao dispor. Desejamos-lhe um excelente dia no encantador Portugal dos Pequenitos!";
      
      // Enviar a mensagem de despedida
      if (dataSource === 'default') {
        await sendMessage(selectedConversation.id, {
          from: 'agent',
          text: closingMessageText,
          read: true
        });
      }
      
      // Fechar a conversa depois de enviar a mensagem
      if (dataSource === 'default') {
        await closeConversation(selectedConversation.id);
      }
      
      // Limpar a escuta da conversa atual
      if (unsubscribeSelectedConversationRef.current) {
        unsubscribeSelectedConversationRef.current();
        unsubscribeSelectedConversationRef.current = null;
      }
      
      setSelectedConversation(null);
    } catch (err) {
      console.error('Erro ao fechar conversa:', err);
      setError('Erro ao fechar conversa. Verifique o console para mais detalhes.');
    }
  };

  // Reabrir conversa - Comentado para resolver warning ESLint
  /* const handleReopenConversation = async () => {
    if (!selectedConversation?.id) return;
    
    try {
      await reopenConversation(selectedConversation.id);
      // Não precisamos mais atualizar manualmente com setRefreshTrigger
    } catch (err) {
      console.error('Erro ao reabrir conversa:', err);
      setError('Erro ao reabrir conversa. Verifique o console para mais detalhes.');
    }
  }; */

  // Formatar data
const formatDate = (dateString: string | { seconds: number } | Date) => {
    try {
      if (!dateString) return 'Data não disponível';
      
      // Se for um objeto Timestamp do Firebase
      if (typeof dateString === 'object' && 'seconds' in dateString) {
        const date = new Date(dateString.seconds * 1000);
        return date.toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Se for uma string ISO
      if (typeof dateString === 'string') {
        const date = new Date(dateString);
        return date.toLocaleString('pt-PT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      return 'Formato de data desconhecido';
    } catch (e) {
      console.error('Erro ao formatar data:', e, dateString);
      return 'Data inválida';
    }
  };

  // Apagar todas as conversas
  const handleDeleteAllConversations = async () => {
    console.log('handleDeleteAllConversations chamado, showDeleteConfirm:', showDeleteConfirm);
    
    if (!showDeleteConfirm) {
      console.log('Primeiro clique - ativando confirmação');
      setShowDeleteConfirm(true);
      return;
    }
    
    console.log('Segundo clique - iniciando apagamento');
    setDeletingConversations(true);
    setError(null);
    
    try {
      console.log('Chamando deleteAllConversations...');
      const result = await deleteAllConversations();
      console.log('Resultado do deleteAllConversations:', result);
      
      if (result.success) {
        // Limpar conversas locais
        setConversations([]);
        setSelectedConversation(null);
        
        // Mostrar mensagem de sucesso
        alert(`Apagadas ${result.deletedCount} conversas com sucesso!`);
        
        // Forçar atualização da lista
        setRefreshTrigger(prev => prev + 1);
      } else {
        console.error('Erro retornado pela função:', result.error);
        setError(`Erro ao apagar conversas: ${result.error}`);
      }
    } catch (err) {
      console.error('Erro ao apagar conversas:', err);
      setError('Erro ao apagar conversas. Verifique o console para mais detalhes.');
    } finally {
      setDeletingConversations(false);
      setShowDeleteConfirm(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('backofficeAuth');
    localStorage.removeItem('backofficeRole');
    localStorage.removeItem('backofficeUserId');
    localStorage.removeItem('backofficeUsername');
    localStorage.removeItem('backofficeDataSource');
    router.push('/backoffice/login');
  };

  const handleLoadMoreConversations = () => {
    setVisibleConversations(prev => prev + 10); // Carregar mais 10 conversas
  };

  const handleShowLessConversations = () => {
    setVisibleConversations(10); // Voltar a mostrar apenas 10 conversas
  };

  if (!isAuthenticated) {
    return <div className={styles.loading}>A verificar autenticação...</div>;
  }

  return (
    <div className={styles.backofficeContainer}>
      <header className={styles.backofficeHeader}>
        <h1>Backoffice - Guia Real</h1>
        <div className={styles.headerActions}>
          <div className={styles.filterControls}>
            <button 
              className={`${styles.filterButton} ${filter === 'active' ? styles.active : ''}`}
              onClick={() => setFilter('active')}
            >
              Conversas Ativas
            </button>
            <button 
              className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              Todas as Conversas
            </button>
            <button 
              className={styles.refreshButton}
              onClick={() => {
                // Reiniciar a escuta em tempo real
                if (unsubscribeConversationsRef.current) {
                  unsubscribeConversationsRef.current();
                  unsubscribeConversationsRef.current = null;
                }
                
                // Forçar o recarregamento definindo loading como true
                setLoading(true);
                
                // Configurar nova escuta (o useEffect será acionado novamente)
                setRefreshTrigger(prev => prev + 1);
              }}
              disabled={loading}
            >
              {loading ? 'A carregar...' : 'Atualizar'}
            </button>
            {dataSource === 'default' && (
              <button 
                className={`${styles.deleteAllButton} ${showDeleteConfirm ? styles.danger : ''}`}
                onClick={handleDeleteAllConversations}
                disabled={deletingConversations}
                title={showDeleteConfirm ? 'Clique novamente para confirmar' : 'Apagar todas as conversas'}
              >
                {deletingConversations ? 'A apagar...' : showDeleteConfirm ? 'Confirmar Apagar' : 'Apagar Todas'}
              </button>
            )}
          </div>
          <button 
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            Sair
          </button>
        </div>
      </header>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.backofficeContent}>
        {role === 'admin' && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarTitle}>Origem dos Dados</div>
            <button
              className={`${styles.sidebarButton} ${dataSource === 'default' ? styles.active : ''}`}
              onClick={() => { setDataSource('default'); localStorage.setItem('backofficeDataSource', 'default'); }}
            >
              Portugal dos Pequenitos
            </button>
            <button
              className={`${styles.sidebarButton} ${dataSource === 'main' ? styles.active : ''}`}
              onClick={() => { setDataSource('main'); localStorage.setItem('backofficeDataSource', 'main'); }}
            >
              Página Principal
            </button>
            
            <div style={{ borderTop: '1px solid #555', margin: '20px 0', paddingTop: '20px' }}>
              <div className={styles.sidebarTitle}>Gestão</div>
              <button
                className={styles.sidebarButton}
                onClick={() => router.push('/backoffice/users')}
              >
                Utilizadores
              </button>
              {dataSource === 'default' && (
                <div style={{ marginTop: 16 }}>
                  <div className={styles.sidebarTitle}>Modo Promoção (Guia Real)</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={promoEnabled}
                      disabled={loadingPromo}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setPromoEnabled(next);
                        try {
                          const userId = localStorage.getItem('backofficeUserId') || 'admin';
                          await updatePromoSettings({ promoMode: { enabled: next } }, userId);
                        } catch (err) {
                          setPromoEnabled(!next);
                          alert('Falha ao atualizar o modo promoção.');
                        }
                      }}
                    />
                    {promoEnabled ? 'Ativo' : 'Desativo'}
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className={styles.mainContentArea}>
          <div className={styles.conversationsList}>
          <div className={styles.conversationsHeader}>
            <h2>Conversas {filter === 'active' ? 'Ativas' : ''}</h2>
            <button 
              className={styles.smallRefreshButton}
              onClick={() => {
                // Reiniciar a escuta em tempo real
                if (unsubscribeConversationsRef.current) {
                  unsubscribeConversationsRef.current();
                  unsubscribeConversationsRef.current = null;
                }
                
                // Forçar o recarregamento definindo loading como true
                setLoading(true);
                
                // Configurar nova escuta (o useEffect será acionado novamente)
                setRefreshTrigger(prev => prev + 1);
              }}
              disabled={loading}
            >
              {loading ? 'A carregar...' : 'Atualizar'}
            </button>
          </div>
          
          {error && <div className={styles.errorMessageSmall}>{error}</div>}
          
          {loading ? (
            <div className={styles.loading}>A carregar conversas...</div>
          ) : conversations.length === 0 ? (
            <div className={styles.noConversations}>Nenhuma conversa encontrada</div>
          ) : (
            <>
              <ul className={styles.conversationsScrollable}>
                {conversations.slice(0, visibleConversations).map(conversation => (
                  <li 
                    key={conversation.id} 
                    className={`
                      ${styles.conversationItem} 
                      ${selectedConversation?.id === conversation.id ? styles.selected : ''}
                      ${conversation.unreadCount ? styles.hasUnread : ''}
                      ${conversation.status === 'closed' ? styles.closed : ''}
                    `}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <div className={styles.conversationHeader}>
                      <strong>{conversation.userName}</strong>
                      {conversation.unreadCount ? (
                        <span className={styles.unreadBadge}>{conversation.unreadCount}</span>
                      ) : null}
                    </div>
                    <div className={styles.conversationMeta}>
                      <span className={styles.contactInfo}>{conversation.userContact}</span>
                      <span className={styles.timestamp}>
                        {formatDate(conversation.updatedAt)}
                      </span>
                    </div>
                    <div className={styles.statusBadge}>
                      {conversation.status === 'active' ? 'Ativa' : 'Fechada'}
                    </div>
                  </li>
                ))}
              </ul>
              
              {/* Botões para carregar mais/menos conversas */}
              {conversations.length > 10 && (
                <div className={styles.loadMoreContainer}>
                  {visibleConversations < conversations.length ? (
                    <button 
                      className={styles.loadMoreButton}
                      onClick={handleLoadMoreConversations}
                    >
                      Ver mais ({conversations.length - visibleConversations} restantes)
                    </button>
                  ) : (
                    <button 
                      className={styles.loadMoreButton}
                      onClick={handleShowLessConversations}
                    >
                      Ver menos
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.chatArea}>
          {selectedConversation ? (
            <>
              <div className={styles.chatHeader}>
                <div>
                  <h2>{selectedConversation.userName}</h2>
                  <p>{selectedConversation.userContact}</p>
                </div>
                <div className={styles.chatActions}>
                  {selectedConversation.status === 'active' && dataSource === 'default' && (
                    <button 
                      className={styles.closeButton}
                      onClick={handleCloseConversation}
                    >
                      Fechar Conversa
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.messagesContainer}>
                {selectedConversation.messages.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`${styles.message} ${msg.from === 'agent' ? styles.agentMessage : styles.userMessage}`}
                  >
                    <div 
                      className={styles.messageContent}
                      dangerouslySetInnerHTML={{ __html: msg.text }}
                    />
                    <div className={styles.messageTime}>
                      {formatDate(msg.timestamp)}
                      {msg.from === 'user' && (
                        <span className={`${styles.readStatus} ${msg.read ? styles.read : styles.unread}`}>
                          {msg.read ? 'Lida' : 'Não lida'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedConversation.status === 'active' && dataSource === 'default' ? (
                <form className={styles.replyForm} onSubmit={handleSendMessage}>
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className={styles.replyInput}
                  />
                  <button 
                    type="submit" 
                    disabled={!message.trim()}
                    className={styles.replyButton}
                  >
                    Enviar
                  </button>
                </form>
              ) : (
                <div className={styles.conversationClosedMessage}>
                  {dataSource === 'default' ? (
                    'Esta conversa foi encerrada.'
                  ) : (
                    'Visualização apenas (chat da página principal).'
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.noChatSelected}>
              <p>Selecione uma conversa para ver as mensagens</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
} 