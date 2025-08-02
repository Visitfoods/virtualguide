'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  listConversations, 
  listActiveConversations, 
  listenToAllConversations,
  listenToActiveConversations,
  listenToConversation,
  Conversation, 
  sendMessage, 
  markAllMessagesAsRead, 
  closeConversation
  // reopenConversation - commented out to fix ESLint warning
} from '../../../firebase/services';
import styles from '../backoffice.module.css';

export default function BackofficeDashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active'>('active');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
      }
    };

    checkAuth();
  }, [router]);

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
      // Configurar escuta em tempo real com base no filtro
      const unsubscribe = filter === 'all'
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

      // Guardar a função de unsubscribe para limpeza posterior
      unsubscribeConversationsRef.current = unsubscribe;
    } catch (err) {
      console.error('Erro ao configurar escuta em tempo real:', err);
      setError(`Erro ao configurar escuta em tempo real: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setConversations([]);
      setLoading(false);
      
      // Tentar carregar de forma não tempo real como fallback
      const fetchConversations = async () => {
        try {
          const data = filter === 'all' 
            ? await listConversations()
            : await listActiveConversations();
          
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
  }, [filter, isAuthenticated, refreshTrigger]); // Adicionado refreshTrigger para forçar a reconfiguração da escuta

  // Selecionar conversa com escuta em tempo real
  const handleSelectConversation = async (conversation: Conversation) => {
    // Limpar qualquer escuta anterior da conversa selecionada
    if (unsubscribeSelectedConversationRef.current) {
      unsubscribeSelectedConversationRef.current();
      unsubscribeSelectedConversationRef.current = null;
    }
    
    // Definir a conversa selecionada inicialmente
    setSelectedConversation(conversation);
    
    // Marcar mensagens como lidas
    if (conversation.id && conversation.unreadCount && conversation.unreadCount > 0) {
      try {
        await markAllMessagesAsRead(conversation.id);
      } catch (err) {
        console.error('Erro ao marcar mensagens como lidas:', err);
      }
    }
    
    // Configurar escuta em tempo real para a conversa selecionada
    if (conversation.id) {
      try {
        const unsubscribe = listenToConversation(conversation.id, (updatedConversation) => {
          setSelectedConversation(updatedConversation);
        });
        
        // Guardar a função de unsubscribe
        unsubscribeSelectedConversationRef.current = unsubscribe;
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
      const closingMessageText = "Agradecemos o seu contacto. Se precisar de mais alguma informação, estamos ao dispor. Tenha um excelente dia!";
      
      // Enviar a mensagem de despedida
      await sendMessage(selectedConversation.id, {
        from: 'agent',
        text: closingMessageText,
        read: true
      });
      
      // Fechar a conversa depois de enviar a mensagem
      await closeConversation(selectedConversation.id);
      
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

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('backofficeAuth');
    router.push('/backoffice/login');
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
            <ul>
              {conversations.map(conversation => (
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
                  {selectedConversation.status === 'active' && (
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
                    <div className={styles.messageContent}>
                      {msg.text}
                    </div>
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

              {selectedConversation.status === 'active' ? (
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
                  Esta conversa foi encerrada.
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
  );
} 