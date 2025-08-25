# Sistema de Upload de Vídeos para Guias

## Como Funciona

O sistema de upload de vídeos para guias funciona da seguinte forma:

### 1. Arquitetura
- **Cliente**: Seleciona vídeos no modal do backoffice
- **API Route**: `/api/upload-video` processa os ficheiros no servidor
- **Servidor**: Copia vídeos para `public/guides/{slug}/`
- **Firebase**: Armazena apenas os caminhos relativos

### 2. Estrutura de Pastas
```
public/
  guides/
    {slug-do-guia}/
      background_{timestamp}_{nome-do-ficheiro}.mp4
      welcome_{timestamp}_{nome-do-ficheiro}.mp4
```

### 3. Processo de Upload
1. **Seleção de Ficheiros**: No Passo 5 do modal de criação do guia
2. **Envio para API**: Os vídeos são enviados para `/api/upload-video`
3. **Processamento no Servidor**: API route copia para `public/guides/{slug}/`
4. **Armazenamento**: No Firebase, apenas os caminhos relativos são guardados:
   - `backgroundVideoURL`: `/guides/{slug}/background_{timestamp}_{nome}.mp4`
   - `welcomeVideoURL`: `/guides/{slug}/welcome_{timestamp}_{nome}.mp4`

### 4. Vantagens
- **Performance**: Vídeos servidos diretamente pelo servidor web
- **Custo**: Sem custos de armazenamento no Firebase Storage
- **Simplicidade**: URLs simples e diretos
- **Organização**: Estrutura de pastas clara
- **Segurança**: Processamento no servidor, não no cliente

### 5. Uso nos Guias
Os vídeos podem ser acedidos diretamente nas páginas dos guias:
```html
<video src="/guides/{slug}/background_{timestamp}_{nome}.mp4" loop muted />
<video src="/guides/{slug}/welcome_{timestamp}_{nome}.mp4" />
```

### 6. Notas Importantes
- Os vídeos são processados no servidor via API route
- Os nomes dos ficheiros incluem timestamp para evitar conflitos
- Apenas ficheiros de vídeo são aceites (`accept="video/*"`)
- **Formatos suportados**: MP4, WebM, AVI, MOV, e outros formatos de vídeo
- Os vídeos são **opcionais** - podes criar guias sem vídeos
- O sistema valida o tipo de ficheiro antes do processamento

## Estrutura no Firebase
```json
{
  "guides": {
    "{slug}": {
      "backgroundVideoURL": "/guides/{slug}/background_{timestamp}_{nome}.mp4",
      "welcomeVideoURL": "/guides/{slug}/welcome_{timestamp}_{nome}.mp4",
      "systemPrompt": "...",
      "name": "...",
      "company": "...",
      "isActive": true
    }
  }
}
```

## API Route
```typescript
POST /api/upload-video
Body: FormData
- file: File (vídeo)
- slug: string (slug do guia)
- type: 'background' | 'welcome'

Response: { success: true, path: string, fileName: string }
```
