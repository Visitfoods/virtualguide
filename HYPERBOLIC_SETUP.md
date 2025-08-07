# Configuração do Hyperbolic AI para o Chatbot

## ✅ API Key Configurada
A API key do Hyperbolic AI já está configurada no código:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJza2F0ZXIuZGlhczFAZ21haWwuY29tIiwiaWF0IjoxNzM1OTU1MjIyfQ.RwQZYm3IRmfdtvQpWe9YOGj-0Pu9ZmP1G8cCSZChfJg
```

## Funcionalidades Implementadas

### 1. Integração Completa
- ✅ API do Hyperbolic AI integrada
- ✅ Prompt personalizado para InforQuestion
- ✅ Sistema de fallback implementado
- ✅ Respostas em português europeu

### 2. Como Testar
1. Inicie o servidor: `npm run dev`
2. Abra o chatbot
3. Faça uma pergunta sobre a InforQuestion
4. Receberá resposta inteligente da IA

### 3. Configurações Atuais

#### Prompt do Sistema
O assistente está configurado para:
- Responder como assistente da InforQuestion
- Usar português europeu
- Fornecer informações sobre produtos e serviços
- Ser amigável e profissional

#### Parâmetros da API
- **Modelo**: `hyperbolic-1`
- **Max Tokens**: 500 (limite de caracteres por resposta)
- **Temperature**: 0.7 (criatividade das respostas)

### 4. Fallback
Se a API do Hyperbolic falhar, o sistema usa respostas pré-definidas como fallback.

## Personalização

### Alterar Prompt do Sistema
Edite o `content` no `role: 'system'` em `src/app/page.tsx` para personalizar o comportamento da IA.

### Alterar Parâmetros
Modifique `max_tokens`, `temperature` ou `model` conforme necessário.

### Exemplos de Perguntas para Testar
- "O que é a InforQuestion?"
- "Que produtos vendem?"
- "Como posso contactar-vos?"
- "Têm assistência técnica?"
- "Qual é a vossa morada?" 