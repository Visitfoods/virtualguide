import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  onSnapshot,
  arrayUnion
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Configuração fixa do Firebase de destino (virtualguide-teste)
const GUIDE_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
  authDomain: 'virtualguide-teste.firebaseapp.com',
  projectId: 'virtualguide-teste',
  storageBucket: 'virtualguide-teste.firebasestorage.app',
  messagingSenderId: '101459525297',
  appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
  measurementId: ''
};

// Inicializar app Firebase para guias
const getGuideApp = (projectId: string) => {
  const appName = `vg-${projectId}`;
  const existing = getApps().find(a => a.name === appName);
  
  if (existing) return existing;
  
  return initializeApp(GUIDE_FIREBASE_CONFIG, appName);
};

// Função para obter a base de dados do guia
const getGuideDb = (projectId: string) => {
  const appName = `vg-${projectId}`;
  const existing = getApps().find((a) => a.name === appName);
  if (existing) return getFirestore(existing);
  
  // Configuração padrão para virtualguide-teste
  const config = {
    apiKey: 'AIzaSyDJIHIrDtgZU_EXSOoeCo9Za8-4yHEOk3M',
    authDomain: 'virtualguide-teste.firebaseapp.com',
    projectId: 'virtualguide-teste',
    storageBucket: 'virtualguide-teste.firebasestorage.app',
    messagingSenderId: '101459525297',
    appId: '1:101459525297:web:94eb4a2c43bbf206492c90',
    measurementId: ''
  };
  
  const app = initializeApp(config, appName);
  return getFirestore(app);
};

// Interfaces para os dados dos guias
export interface GuideContactInfo {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'pending' | 'contacted' | 'resolved' | 'spam';
  source: 'contact-form' | 'chat-initiation';
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown; // Firestore Timestamp
  contactedAt?: unknown; // Firestore Timestamp
  notes?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface GuideChatMessage {
  id?: string;
  from: 'user' | 'guide' | 'system';
  text: string;
  timestamp: unknown; // Firestore Timestamp
  read: boolean;
  metadata?: {
    guideResponse: boolean;
    responseTime?: number; // em segundos
    messageType?: 'text' | 'image' | 'file';
    fileUrl?: string;
    closingMessage?: boolean; // marca mensagem de encerramento para evitar duplicados
    fromChatbot?: boolean; // indica se a mensagem veio do chatbot AI
  };
}

export interface GuideConversation {
  id?: string;
  guideSlug: string;
  projectId: string;
  userId: string;
  userName: string;
  userContact: string;
  userEmail?: string;
  userPhone?: string;
  status: 'active' | 'closed' | 'pending' | 'archived';
  priority: 'low' | 'medium' | 'high';
  category?: 'general' | 'ticket' | 'support' | 'sales' | 'technical';
  tags?: string[];
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown; // Firestore Timestamp
  lastActivity: unknown; // Firestore Timestamp
  closedAt?: unknown; // Firestore Timestamp
  closedBy?: string; // ID do guia que fechou
  closeReason?: string;
  messages: GuideChatMessage[];
  unreadCount?: number;
  totalMessages: number;
  averageResponseTime?: number; // em segundos
  satisfaction?: number; // 1-5 estrelas
  feedback?: string;
}

// Função para salvar pedido de contacto de um guia
export const saveGuideContactRequest = async (
  projectId: string,
  contactData: Omit<GuideContactInfo, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'priority'>
): Promise<string> => {
  try {
    const db = getGuideDb(projectId);
    
    const contactWithMetadata = {
      ...contactData,
      status: 'pending' as const,
      priority: 'medium' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'contact_requests'), contactWithMetadata);
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Pedido de contacto salvo com ID:', docRef.id);
    }
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar pedido de contacto:', error);
    throw error;
  }
};

// Função para criar uma nova conversa num guia
export const createGuideConversation = async (
  projectId: string,
  conversationData: Omit<GuideConversation, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity' | 'totalMessages' | 'unreadCount'>
): Promise<string> => {
  try {
    const db = getGuideDb(projectId);
    
         // Converter timestamps das mensagens para Date() em vez de serverTimestamp()
     const messagesWithDateTimestamps = conversationData.messages.map(msg => ({
       ...msg,
       timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(String(msg.timestamp))
     }));

     const conversationWithMetadata = {
       ...conversationData,
       messages: messagesWithDateTimestamps,
       createdAt: serverTimestamp(),
       updatedAt: serverTimestamp(),
       lastActivity: serverTimestamp(),
       totalMessages: conversationData.messages.length,
       unreadCount: 0
     };
    
    const docRef = await addDoc(collection(db, 'conversations'), conversationWithMetadata);
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversa do guia criada com ID:', docRef.id);
    }
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar conversa do guia:', error);
    throw error;
  }
};

// Função para enviar mensagem numa conversa
export const sendGuideMessage = async (
  projectId: string,
  conversationId: string,
  message: Omit<GuideChatMessage, 'id' | 'timestamp' | 'read'>
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const messageWithMetadata = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(), // Usar Date() em vez de serverTimestamp() para arrays
      read: false
    };
    
    // Obter a conversa atual para calcular estatísticas
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    const currentData = conversationDoc.data() as GuideConversation;
    const updatedMessages = [...currentData.messages, messageWithMetadata];
    
    // Calcular tempo de resposta se for mensagem do guia
    let averageResponseTime = currentData.averageResponseTime;
    if (message.from === 'guide' && currentData.messages.length > 0) {
      const lastUserMessage = currentData.messages
        .filter(m => m.from === 'user')
        .pop();
      
      if (lastUserMessage && lastUserMessage.timestamp) {
        // Converter vários formatos possíveis de timestamp em milissegundos
        const toMillis = (value: any): number => {
          try {
            if (!value) return Date.now();
            if (typeof value?.toMillis === 'function') return value.toMillis();
            if (typeof value?.toDate === 'function') return value.toDate().getTime();
            if (value instanceof Date) return value.getTime();
            if (typeof value === 'number') return value;
            const parsed = Date.parse(value);
            return isNaN(parsed) ? Date.now() : parsed;
          } catch {
            return Date.now();
          }
        };
        
        const responseTime = Date.now() - toMillis(lastUserMessage.timestamp);
        const historicalCount = currentData.messages.length;
        const historicalAverage = currentData.averageResponseTime || 0;
        averageResponseTime = ((historicalAverage * historicalCount) + responseTime) / (historicalCount + 1);
      }
    }
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Tentando atualizar documento com:', {
      conversationId,
      messagesCount: updatedMessages.length,
      averageResponseTime,
      unreadCount: message.from === 'user' ? (currentData.unreadCount || 0) + 1 : 0
    });
    }

    // Construir payload sem campos undefined
    const updateData: any = {
      messages: updatedMessages,
      updatedAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      totalMessages: updatedMessages.length,
      unreadCount: message.from === 'user' ? (currentData.unreadCount || 0) + 1 : 0
    };

    if (typeof averageResponseTime === 'number' && !Number.isNaN(averageResponseTime)) {
      updateData.averageResponseTime = averageResponseTime;
    }

    await updateDoc(conversationRef, updateData);
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Mensagem enviada para conversa:', conversationId);
    }
  } catch (error) {
    console.error('Erro detalhado ao enviar mensagem:', error);
    console.error('Tipo de erro:', typeof error);
    console.error('Mensagem de erro:', error instanceof Error ? error.message : 'Erro desconhecido');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
    throw error;
  }
};

// Função para obter uma conversa específica
export const getGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<GuideConversation> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    return { id: conversationDoc.id, ...conversationDoc.data() } as GuideConversation;
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    throw error;
  }
};

// Função para escutar mudanças numa conversa (tempo real)
export const listenToGuideConversation = (
  projectId: string,
  conversationId: string,
  callback: (conversation: GuideConversation) => void
) => {
  const db = getGuideDb(projectId);
  const conversationRef = doc(db, 'conversations', conversationId);
  
  return onSnapshot(conversationRef, (doc: any) => {
    if (doc.exists()) {
      const data = doc.data() as GuideConversation;
      callback({ ...data, id: doc.id });
    }
  });
};

// Função para escutar todas as conversas de um guia (tempo real)
export const listenToGuideConversations = (
  projectId: string,
  guideSlug: string,
  callback: (conversations: GuideConversation[]) => void
) => {
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
    // eslint-disable-next-line no-console
    console.log('listenToGuideConversations chamada com:', { projectId, guideSlug });
  }
  const db = getGuideDb(projectId);
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
    // eslint-disable-next-line no-console
    console.log('Database obtida:', db);
  }
  
  // Criar query sem orderBy para evitar problemas com campos que podem não existir
  const q = query(
    collection(db, 'conversations'),
    where('guideSlug', '==', guideSlug)
  );
  
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
    // eslint-disable-next-line no-console
    console.log('Query criada:', q);
  }
  
  return onSnapshot(q, (snapshot: any) => {
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Snapshot recebido:', snapshot.size, 'documentos');
    }
    const conversations: GuideConversation[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
        // eslint-disable-next-line no-console
        console.log('Documento encontrado:', doc.id, data);
      }
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    // Ordenar localmente por lastActivity se existir, convertendo de forma resiliente
    const toMillis = (value: any): number => {
      try {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
      } catch {
        return 0;
      }
    };

    conversations.sort((a, b) => toMillis(b.lastActivity) - toMillis(a.lastActivity));
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversas processadas e ordenadas:', conversations.length);
    }
    callback(conversations);
  }, (error: any) => {
    console.error('Erro no listener:', error);
  });
};

// Função para escutar conversas ativas de um guia (tempo real)
export const listenToActiveGuideConversations = (
  projectId: string,
  guideSlug: string,
  callback: (conversations: GuideConversation[]) => void
) => {
  const db = getGuideDb(projectId);
  const q = query(
    collection(db, 'conversations'),
    where('guideSlug', '==', guideSlug),
    where('status', '==', 'active'),
    orderBy('lastActivity', 'desc')
  );
  
  return onSnapshot(q, (snapshot: any) => {
    const conversations: GuideConversation[] = [];
    
    snapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    callback(conversations);
  });
};

// Função para listar todas as conversas de um guia
export const listGuideConversations = async (
  projectId: string,
  guideSlug: string
): Promise<GuideConversation[]> => {
  try {
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('listGuideConversations chamada com:', { projectId, guideSlug });
    }
    const db = getGuideDb(projectId);
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Database obtida:', db);
    }
    
    // Criar query sem orderBy para evitar problemas com campos que podem não existir
    const q = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug)
    );
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Query criada:', q);
    }
    const querySnapshot = await getDocs(q);
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('QuerySnapshot obtido:', querySnapshot.size, 'documentos');
    }
    
    const conversations: GuideConversation[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
        // eslint-disable-next-line no-console
        console.log('Documento encontrado:', doc.id, data);
      }
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    // Ordenar localmente por lastActivity se existir, convertendo de forma resiliente
    const toMillis = (value: any): number => {
      try {
        if (!value) return 0;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.toDate === 'function') return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value);
        return isNaN(parsed) ? 0 : parsed;
      } catch {
        return 0;
      }
    };

    conversations.sort((a, b) => toMillis(b.lastActivity) - toMillis(a.lastActivity));
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversas processadas e ordenadas:', conversations.length);
    }
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas do guia:', error);
    throw error;
  }
};

// Função para listar conversas ativas de um guia
export const listActiveGuideConversations = async (
  projectId: string,
  guideSlug: string
): Promise<GuideConversation[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug),
      where('status', '==', 'active'),
      orderBy('lastActivity', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const conversations: GuideConversation[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      conversations.push({
        ...data,
        id: doc.id
      });
    });
    
    return conversations;
  } catch (error) {
    console.error('Erro ao listar conversas ativas do guia:', error);
    throw error;
  }
};

// Função para marcar mensagens como lidas
export const markGuideMessagesAsRead = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    const conversation = conversationDoc.data() as GuideConversation;
    const updatedMessages = conversation.messages.map(msg => ({
      ...msg,
      read: true
    }));
    
    await updateDoc(conversationRef, {
      messages: updatedMessages,
      unreadCount: 0,
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Mensagens marcadas como lidas');
    }
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    throw error;
  }
};

// Função para fechar uma conversa
export const closeGuideConversation = async (
  projectId: string,
  conversationId: string,
  closedBy: string,
  closeReason?: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'closed',
      closedAt: serverTimestamp(),
      closedBy,
      closeReason,
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversa fechada com sucesso');
    }
  } catch (error) {
    console.error('Erro ao fechar conversa:', error);
    throw error;
  }
};

// Função para reabrir uma conversa
export const reopenGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'active',
      closedAt: null,
      closedBy: null,
      closeReason: null,
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversa reaberta com sucesso');
    }
  } catch (error) {
    console.error('Erro ao reabrir conversa:', error);
    throw error;
  }
};

// Função para arquivar uma conversa
export const archiveGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      status: 'archived',
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversa arquivada com sucesso');
    }
  } catch (error) {
    console.error('Erro ao arquivar conversa:', error);
    throw error;
  }
};

// Função para atualizar prioridade de uma conversa
export const updateGuideConversationPriority = async (
  projectId: string,
  conversationId: string,
  priority: 'low' | 'medium' | 'high'
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      priority,
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Prioridade da conversa atualizada');
    }
  } catch (error) {
    console.error('Erro ao atualizar prioridade:', error);
    throw error;
  }
};

// Função para adicionar tags a uma conversa
export const addGuideConversationTags = async (
  projectId: string,
  conversationId: string,
  tags: string[]
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await updateDoc(conversationRef, {
      tags: arrayUnion(...tags),
      updatedAt: serverTimestamp()
    });
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Tags adicionadas à conversa');
    }
  } catch (error) {
    console.error('Erro ao adicionar tags:', error);
    throw error;
  }
};

// Função para atualizar status de um pedido de contacto
export const updateGuideContactStatus = async (
  projectId: string,
  contactId: string,
  status: 'pending' | 'contacted' | 'resolved' | 'spam',
  notes?: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const contactRef = doc(db, 'contact_requests', contactId);
    
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };
    
    if (status === 'contacted') {
      updateData.contactedAt = serverTimestamp();
    }
    
    if (notes) {
      updateData.notes = notes;
    }
    
    await updateDoc(contactRef, updateData);
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Status do contacto atualizado');
    }
  } catch (error) {
    console.error('Erro ao atualizar status do contacto:', error);
    throw error;
  }
};

// Função para listar pedidos de contacto de um guia
export const listGuideContactRequests = async (
  projectId: string,
  guideSlug: string
): Promise<GuideContactInfo[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'contact_requests'),
      where('guideSlug', '==', guideSlug),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const contacts: GuideContactInfo[] = [];
    
    querySnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideContactInfo;
      contacts.push({
        ...data,
        id: doc.id
      });
    });
    
    return contacts;
  } catch (error) {
    console.error('Erro ao listar pedidos de contacto:', error);
    throw error;
  }
};

// Função para obter estatísticas de um guia
export const getGuideStats = async (
  projectId: string,
  guideSlug: string
): Promise<{
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  averageResponseTime: number;
  totalContacts: number;
  pendingContacts: number;
}> => {
  try {
    const db = getGuideDb(projectId);
    
    // Obter conversas
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('guideSlug', '==', guideSlug)
    );
    const conversationsSnapshot = await getDocs(conversationsQuery);
    
    // Obter contactos
    const contactsQuery = query(
      collection(db, 'contact_requests'),
      where('guideSlug', '==', guideSlug)
    );
    const contactsSnapshot = await getDocs(contactsQuery);
    
    let totalConversations = 0;
    let activeConversations = 0;
    let totalMessages = 0;
    let totalResponseTime = 0;
    let responseCount = 0;
    
    conversationsSnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideConversation;
      totalConversations++;
      
      if (data.status === 'active') {
        activeConversations++;
      }
      
      totalMessages += data.totalMessages || 0;
      
      if (data.averageResponseTime) {
        totalResponseTime += data.averageResponseTime;
        responseCount++;
      }
    });
    
    const totalContacts = contactsSnapshot.size;
    let pendingContacts = 0;
    
    contactsSnapshot.forEach((doc: any) => {
      const data = doc.data() as GuideContactInfo;
      if (data.status === 'pending') {
        pendingContacts++;
      }
    });
    
    return {
      totalConversations,
      activeConversations,
      totalMessages,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      totalContacts,
      pendingContacts
    };
  } catch (error) {
    console.error('Erro ao obter estatísticas do guia:', error);
    throw error;
  }
};

// Função para apagar uma conversa (apenas para administradores)
export const deleteGuideConversation = async (
  projectId: string,
  conversationId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const conversationRef = doc(db, 'conversations', conversationId);
    
    await deleteDoc(conversationRef);
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Conversa apagada com sucesso');
    }
  } catch (error) {
    console.error('Erro ao apagar conversa:', error);
    throw error;
  }
};

// Função para apagar um pedido de contacto (apenas para administradores)
export const deleteGuideContactRequest = async (
  projectId: string,
  contactId: string
): Promise<void> => {
  try {
    const db = getGuideDb(projectId);
    const contactRef = doc(db, 'contact_requests', contactId);
    
    await deleteDoc(contactRef);
    
    if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
      // eslint-disable-next-line no-console
      console.log('Pedido de contacto apagado com sucesso');
    }
  } catch (error) {
    console.error('Erro ao apagar pedido de contacto:', error);
    throw error;
  }
};

// Função para listar todos os guias disponíveis
export const listAvailableGuides = async (projectId: string): Promise<{ slug: string; name: string; company?: string }[]> => {
  try {
    const db = getGuideDb(projectId);
    // Não usar orderBy em campo que pode não existir
    const q = query(collection(db, 'guides'));

    const querySnapshot = await getDocs(q);
    const guides: { slug: string; name: string; company?: string }[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const slug: string = data?.slug || docSnap.id;
      const name: string = data?.name || slug;
      const company: string | undefined = (data as any)?.company;
      if (slug) {
        guides.push({ slug, name, company });
      }
    });

    // Ordenar alfabeticamente por nome para consistência visual
    guides.sort((a, b) => (a.company || a.name).localeCompare((b.company || b.name), 'pt-PT'));
    return guides;
  } catch (error) {
    console.error('Erro ao listar guias disponíveis:', error);
    throw error;
  }
};

// Listar apenas guias com chat humano real ativo
export const listGuidesWithHumanChatEnabled = async (
  projectId: string
): Promise<{ slug: string; name: string; company?: string }[]> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(collection(db, 'guides'), where('humanChatEnabled', '==', true));

    const querySnapshot = await getDocs(q);
    const guides: { slug: string; name: string; company?: string }[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      // Considerar inativos apenas quando explicitamente false
      if (data?.isActive === false) return;
      const slug: string = data?.slug || docSnap.id;
      const name: string = data?.name || slug;
      const company: string | undefined = (data as any)?.company;
      if (slug) {
        guides.push({ slug, name, company });
      }
    });

    guides.sort((a, b) => (a.company || a.name).localeCompare((b.company || b.name), 'pt-PT'));
    return guides;
  } catch (error) {
    console.error('Erro ao listar guias com chat humano ativo:', error);
    throw error;
  }
};

// Função para obter informações básicas de um guia
export const getGuideBasicInfo = async (
  projectId: string,
  guideSlug: string
): Promise<{ slug: string; name: string; description?: string } | null> => {
  try {
    const db = getGuideDb(projectId);
    const q = query(
      collection(db, 'guides'),
      where('slug', '==', guideSlug),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      slug: data.slug,
      name: data.name,
      description: data.description
    };
  } catch (error) {
    console.error('Erro ao obter informações básicas do guia:', error);
    throw error;
  }
};
