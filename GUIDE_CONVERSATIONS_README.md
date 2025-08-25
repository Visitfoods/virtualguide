# Sistema de Conversas e Contactos dos Guias Virtuais

## Visão Geral

Este sistema implementa a **Opção 1** recomendada: manter todas as conversas e contactos na mesma base de dados `virtualguide-teste`, organizando os dados de forma eficiente e escalável.

## Estrutura da Base de Dados

### Coleções Principais

#### 1. `guides` (Existente)
- Contém todos os dados dos guias virtuais
- Inclui configurações, vídeos, FAQs, contactos, etc.

#### 2. `conversations` (Nova)
- Armazena todas as conversas dos utilizadores com os guias
- Estrutura hierárquica por `guideSlug` e `projectId`

#### 3. `contact_requests` (Nova)
- Armazena pedidos de contacto dos utilizadores
- Organizado por guia para facilitar a gestão

## Interfaces TypeScript

### GuideConversation
```typescript
interface GuideConversation {
  id?: string;
  guideSlug: string;           // Slug do guia (ex: "portugaldospequenitos")
  projectId: string;           // ID do projeto Firebase
  userId: string;              // ID único do utilizador
  userName: string;            // Nome do utilizador
  userContact: string;         // Contacto principal
  userEmail?: string;          // Email (opcional)
  userPhone?: string;          // Telefone (opcional)
  status: 'active' | 'closed' | 'pending' | 'archived';
  priority: 'low' | 'medium' | 'high';
  category?: 'general' | 'ticket' | 'support' | 'sales' | 'technical';
  tags?: string[];             // Tags para categorização
  createdAt: any;              // Firestore Timestamp
  updatedAt: any;              // Firestore Timestamp
  lastActivity: any;           // Firestore Timestamp
  closedAt?: any;              // Firestore Timestamp
  closedBy?: string;           // ID do guia que fechou
  closeReason?: string;        // Motivo do fecho
  messages: GuideChatMessage[]; // Array de mensagens
  unreadCount?: number;        // Mensagens não lidas
  totalMessages: number;       // Total de mensagens
  averageResponseTime?: number; // Tempo médio de resposta (segundos)
  satisfaction?: number;        // Avaliação 1-5 estrelas
  feedback?: string;           // Comentários do utilizador
}
```

### GuideChatMessage
```typescript
interface GuideChatMessage {
  id?: string;
  from: 'user' | 'guide' | 'system';
  text: string;
  timestamp: any;              // Firestore Timestamp
  read: boolean;
  metadata?: {
    guideResponse: boolean;     // Se foi respondido por guia real
    responseTime?: number;      // Tempo de resposta (segundos)
    messageType?: 'text' | 'image' | 'file';
    fileUrl?: string;
  };
}
```

### GuideContactInfo
```typescript
interface GuideContactInfo {
  id?: string;
  guideSlug: string;           // Slug do guia
  projectId: string;           // ID do projeto Firebase
  name: string;                // Nome do utilizador
  email: string;               // Email
  phone?: string;              // Telefone (opcional)
  message?: string;            // Mensagem (opcional)
  status: 'pending' | 'contacted' | 'resolved' | 'spam';
  source: 'contact-form' | 'chat-initiation';
  createdAt: any;              // Firestore Timestamp
  updatedAt: any;              // Firestore Timestamp
  contactedAt?: any;           // Firestore Timestamp
  notes?: string;              // Notas internas
  priority: 'low' | 'medium' | 'high';
}
```

## Serviços Disponíveis

### Gestão de Conversas

#### Criar Nova Conversa
```typescript
import { createGuideConversation } from '../firebase/guideServices';

const conversationId = await createGuideConversation('virtualguide-teste', {
  guideSlug: 'portugaldospequenitos',
  projectId: 'virtualguide-teste',
  userId: 'user_123',
  userName: 'João Silva',
  userContact: 'joao@email.com',
  userEmail: 'joao@email.com',
  status: 'active',
  priority: 'medium',
  category: 'general',
  messages: [
    {
      from: 'guide',
      text: 'Olá! Como posso ajudá-lo?',
      timestamp: new Date(),
      read: false
    }
  ]
});
```

#### Enviar Mensagem
```typescript
import { sendGuideMessage } from '../firebase/guideServices';

await sendGuideMessage('virtualguide-teste', conversationId, {
  from: 'user',
  text: 'Preciso de ajuda com o horário de funcionamento',
  metadata: {
    guideResponse: false
  }
});
```

#### Escutar Conversas em Tempo Real
```typescript
import { listenToActiveGuideConversations } from '../firebase/guideServices';

const unsubscribe = listenToActiveGuideConversations(
  'virtualguide-teste',
  'portugaldospequenitos',
  (conversations) => {
    console.log('Conversas ativas:', conversations);
  }
);

// Para parar de escutar
unsubscribe();
```

### Gestão de Contactos

#### Salvar Pedido de Contacto
```typescript
import { saveGuideContactRequest } from '../firebase/guideServices';

const contactId = await saveGuideContactRequest('virtualguide-teste', {
  guideSlug: 'portugaldospequenitos',
  projectId: 'virtualguide-teste',
  name: 'Maria Santos',
  email: 'maria@email.com',
  phone: '+351 123 456 789',
  message: 'Gostaria de saber mais sobre os bilhetes',
  source: 'contact-form'
});
```

#### Atualizar Status do Contacto
```typescript
import { updateGuideContactStatus } from '../firebase/guideServices';

await updateGuideContactStatus('virtualguide-teste', contactId, 'contacted', 
  'Utilizador contactado por telefone. Agendada visita para próxima semana.'
);
```

### Estatísticas e Relatórios

#### Obter Estatísticas do Guia
```typescript
import { getGuideStats } from '../firebase/guideServices';

const stats = await getGuideStats('virtualguide-teste', 'portugaldospequenitos');

console.log('Estatísticas:', {
  totalConversations: stats.totalConversations,
  activeConversations: stats.activeConversations,
  totalMessages: stats.totalMessages,
  averageResponseTime: stats.averageResponseTime,
  totalContacts: stats.totalContacts,
  pendingContacts: stats.pendingContacts
});
```

## Índices Recomendados

Para otimizar as consultas, criar os seguintes índices compostos no Firestore:

### Coleção `conversations`
1. `guideSlug` + `lastActivity` (descending)
2. `guideSlug` + `status` + `lastActivity` (descending)
3. `guideSlug` + `priority` + `lastActivity` (descending)
4. `guideSlug` + `category` + `lastActivity` (descending)

### Coleção `contact_requests`
1. `guideSlug` + `createdAt` (descending)
2. `guideSlug` + `status` + `createdAt` (descending)
3. `guideSlug` + `priority` + `createdAt` (descending)

## Regras de Segurança

As regras de segurança estão definidas no ficheiro `firestore.rules`:

- **Conversas**: Utilizadores podem ler/escrever suas próprias conversas, admins e guias têm acesso total
- **Contactos**: Qualquer pessoa pode criar, apenas admins e guias podem ler/atualizar
- **Guias**: Leitura pública, escrita apenas para admins

## Fluxo de Trabalho Típico

### 1. Utilizador Inicia Conversa
```typescript
// 1. Criar conversa
const conversationId = await createGuideConversation(projectId, {
  guideSlug: 'portugaldospequenitos',
  userId: generateUserId(),
  userName: 'João Silva',
  userContact: 'joao@email.com',
  status: 'active',
  priority: 'medium',
  messages: [initialMessage]
});

// 2. Enviar primeira mensagem
await sendGuideMessage(projectId, conversationId, {
  from: 'user',
  text: 'Olá! Preciso de ajuda.',
  metadata: { guideResponse: false }
});
```

### 2. Guia Responde
```typescript
// 1. Marcar mensagens como lidas
await markGuideMessagesAsRead(projectId, conversationId);

// 2. Enviar resposta
await sendGuideMessage(projectId, conversationId, {
  from: 'guide',
  text: 'Olá João! Como posso ajudá-lo?',
  metadata: { guideResponse: true }
});
```

### 3. Fechar Conversa
```typescript
await closeGuideConversation(projectId, conversationId, 'guide_123', 
  'Utilizador satisfeito com a resposta'
);
```

## Vantagens da Implementação

### ✅ **Simplicidade**
- Uma única base de dados para gerir
- Configuração centralizada
- Menor complexidade de manutenção

### ✅ **Escalabilidade**
- Estrutura hierárquica por guia
- Índices otimizados para consultas
- Suporte a múltiplos projetos

### ✅ **Funcionalidades Avançadas**
- Sistema de prioridades
- Categorização e tags
- Estatísticas em tempo real
- Gestão de contactos integrada

### ✅ **Segurança**
- Regras de acesso granulares
- Autenticação por projeto
- Separação de responsabilidades

## Próximos Passos

1. **Implementar no Frontend**: Integrar os serviços nas páginas dos guias
2. **Dashboard de Gestão**: Criar interface para guias gerirem conversas
3. **Notificações**: Sistema de alertas para novas mensagens
4. **Relatórios**: Dashboard de estatísticas e métricas
5. **Integração com IA**: Sistema de resposta automática inteligente

## Exemplos de Uso

### Página do Guia
```typescript
// No componente da página do guia
useEffect(() => {
  const unsubscribe = listenToActiveGuideConversations(
    'virtualguide-teste',
    'portugaldospequenitos',
    (conversations) => {
      setActiveConversations(conversations);
      setUnreadCount(conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0));
    }
  );
  
  return unsubscribe;
}, []);
```

### Formulário de Contacto
```typescript
const handleContactSubmit = async (formData: ContactFormData) => {
  try {
    await saveGuideContactRequest('virtualguide-teste', {
      guideSlug: 'portugaldospequenitos',
      projectId: 'virtualguide-teste',
      name: formData.name,
      email: formData.email,
      message: formData.message,
      source: 'contact-form'
    });
    
    // Mostrar sucesso
    setMessage('Pedido enviado com sucesso!');
  } catch (error) {
    console.error('Erro ao enviar pedido:', error);
    setMessage('Erro ao enviar pedido. Tente novamente.');
  }
};
```

## Suporte e Manutenção

Para questões técnicas ou suporte:
- Verificar logs do console para erros
- Validar regras de segurança do Firestore
- Confirmar índices compostos estão criados
- Verificar permissões de autenticação

---

**Nota**: Este sistema está otimizado para a base de dados `virtualguide-teste` e pode ser facilmente adaptado para outros projetos Firebase seguindo a mesma estrutura.
