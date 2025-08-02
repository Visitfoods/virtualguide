# Backoffice - Guia Real

Este é o backoffice para gerenciar as conversas do Guia Real. Aqui você pode visualizar, responder e gerenciar todas as conversas iniciadas pelos utilizadores no site.

## Acesso

O backoffice pode ser acessado através do link:

```
https://seu-dominio.com/backoffice/login
```

Ou clicando no link "Admin" no canto superior direito da página principal.

## Credenciais

Para acessar o backoffice, utilize as seguintes credenciais:

- **Utilizador:** admin
- **Senha:** guiareal123

**Importante:** Por razões de segurança, recomenda-se alterar estas credenciais após o primeiro acesso.

## Funcionalidades

### Gestão de Conversas

- **Lista de Conversas:** Visualize todas as conversas ativas ou todas as conversas (incluindo fechadas)
- **Filtros:** Filtre por conversas ativas ou todas as conversas
- **Indicadores:** Veja quais conversas têm mensagens não lidas
- **Atualização:** Atualize a lista de conversas com o botão "Atualizar"

### Responder a Mensagens

1. Selecione uma conversa na lista à esquerda
2. Veja o histórico completo de mensagens
3. Digite sua resposta no campo de texto na parte inferior
4. Clique em "Enviar" para enviar a mensagem

### Gerenciar Conversas

- **Fechar Conversa:** Quando uma conversa for concluída, clique em "Fechar Conversa"
- **Reabrir Conversa:** Se necessário, você pode reabrir uma conversa fechada
- **Mensagens Lidas:** As mensagens são automaticamente marcadas como lidas quando você visualiza uma conversa

## Dados Armazenados

Todas as conversas são armazenadas no Firebase Firestore nas seguintes coleções:

- **contactosinfoquestion:** Armazena os dados de contato iniciais
- **conversations:** Armazena todas as mensagens e detalhes das conversas

## Suporte

Em caso de problemas ou dúvidas, entre em contato com o administrador do sistema. 