import { mainDb } from './mainConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';

// Interface para os dados do formulário da página principal
export interface MainContactFormData {
  name: string;
  email: string;
  timestamp?: Date | { seconds: number; nanoseconds: number };
  source: 'main-page';
}

// Interface para mensagens do chat
export interface ChatMessage {
  id?: string;
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
  read?: boolean;
}

// Interface para conversas
export interface Conversation {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  unreadCount?: number;
}

// Função para salvar os dados do formulário da página principal no Firestore
// Os dados são salvos na coleção 'conversas'
export const saveMainContactRequest = async (data: MainContactFormData): Promise<string> => {
  try {
    // Adicionar timestamp e source
    const dataWithTimestamp = {
      ...data,
      timestamp: serverTimestamp(),
      source: 'main-page'
    };
    
    // Adicionar documento à coleção 'conversas'
    const docRef = await addDoc(collection(mainDb, 'conversas'), dataWithTimestamp);
    
    console.log('Dados da página principal salvos com ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao salvar dados da página principal:', error);
    console.error('Detalhes do erro:', {
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      code: (error as { code?: string })?.code,
      details: error
    });
    throw error;
  }
};

// Função para criar uma nova conversa
export const createMainConversation = async (
  userData: MainContactFormData, 
  initialMessages?: ChatMessage[]
): Promise<string> => {
  try {
    // Usar mensagens iniciais fornecidas ou criar uma mensagem padrão
    const messages = initialMessages || [
      {
        from: 'bot',
        text: `Olá ${userData.name}! Sou o seu assistente virtual. Como posso ajudá-lo hoje?`,
        timestamp: new Date().toISOString(),
        read: false
      }
    ];
    
    const conversationData = {
      userId: `user_${Date.now()}`,
      userName: userData.name,
      userEmail: userData.email,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages
    };

    const docRef = await addDoc(collection(mainDb, 'conversas'), conversationData);
    console.log('Conversa da página principal criada com ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar conversa da página principal:', error);
    throw error;
  }
};

// Função para adicionar mensagem a uma conversa
export const addMessageToMainConversation = async (
  conversationId: string, 
  message: Omit<ChatMessage, 'timestamp'>
): Promise<void> => {
  try {
    const conversationRef = doc(mainDb, 'conversas', conversationId);
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString()
    };

    await updateDoc(conversationRef, {
      messages: arrayUnion(messageWithTimestamp),
      updatedAt: serverTimestamp()
    });

    console.log('Mensagem adicionada à conversa:', conversationId);
  } catch (error) {
    console.error('Erro ao adicionar mensagem à conversa:', error);
    throw error;
  }
};

// Função para obter uma conversa
export const getMainConversation = async (conversationId: string): Promise<Conversation> => {
  try {
    const conversationRef = doc(mainDb, 'conversas', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversa não encontrada');
    }
    
    return { id: conversationDoc.id, ...conversationDoc.data() } as Conversation;
  } catch (error) {
    console.error('Erro ao obter conversa:', error);
    throw error;
  }
};
