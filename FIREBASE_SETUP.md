# Configuração do Firebase para Landing Page

## 1. Criar Projeto no Firebase

1. Aceda a [console.firebase.google.com](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Nome do projeto: `virtualguide-ebf86` (ou o nome que preferir)
4. Siga os passos para criar o projeto

## 2. Ativar Firestore Database

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Escolha "Iniciar no modo de produção"
4. Selecione a região "eur3 (europe-west)"
5. Clique em "Ativar"

## 3. Configurar Regras de Segurança

Na aba "Regras" do Firestore, configure estas regras:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir escrita na coleção contactosinfoquestion
    match /contactosinfoquestion/{document=**} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    
    // Permitir escrita e leitura na coleção conversations
    match /conversations/{document=**} {
      allow create, read, update: if true;
      allow delete: if false;
    }
    
    // Negar acesso a todas as outras coleções
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 4. Criar Coleções

### Coleção: contactosinfoquestion
- **Nome:** `contactosinfoquestion`
- **Campos:**
  - `name` (string)
  - `contact` (string)
  - `timestamp` (timestamp - automático)

### Coleção: conversations
- **Nome:** `conversations`
- **Campos:**
  - `userId` (string)
  - `userName` (string)
  - `userContact` (string)
  - `status` (string) - "active" ou "closed"
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)
  - `messages` (array)

## 5. Obter Credenciais

1. No menu lateral, clique em "Configurações do projeto" (ícone de engrenagem)
2. Clique em "Configurações gerais"
3. Na secção "Seus aplicativos", clique em "Adicionar aplicativo"
4. Escolha "Web"
5. Copie as credenciais e coloque-as no arquivo `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

## 6. Testar a Configuração

1. Execute `npm run dev`
2. Aceda a `http://localhost:3000`
3. Preencha o formulário "FALAR COM GUIA REAL"
4. Verifique no console do Firebase se os dados aparecem
5. Teste o chat humano que abre após o envio do formulário

## Funcionalidades Implementadas

- ✅ Formulário de contacto
- ✅ Chat humano em tempo real
- ✅ Armazenamento de mensagens no Firebase
- ✅ Interface similar ao chatbot
- ✅ Sistema de conversas persistentes 