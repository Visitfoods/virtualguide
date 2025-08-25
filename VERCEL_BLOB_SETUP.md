# Configuração do Vercel Blob para Uploads

## Problema Resolvido
Os erros de upload de vídeo/imagem/legendas foram causados por:
1. **Limite de tamanho do Edge Runtime**: Vercel Edge tem limite de 4.5MB para payloads
2. **Erro 413 "Request Entity Too Large"**: Vídeos maiores que 4.5MB falhavam
3. **Resposta não-JSON**: APIs devolviam erros HTTP em vez de JSON válido

## Solução Implementada
Migração para **Vercel Blob** com **Node.js Runtime**:
- ✅ Suporta ficheiros até 500MB
- ✅ Upload direto para storage cloud
- ✅ URLs públicas automáticas
- ✅ Sem limitações de tamanho de payload

## Configuração Necessária

### 1. Criar Blob Store no Vercel
1. Vá para [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione o projeto `virtualguide`
3. Vá para **Storage** > **Blob**
4. Clique em **Create Blob Store**
5. Nome: `virtualguide-blob` (ou qualquer nome)
6. Região: `iad1` (Washington, D.C.) ou mais próxima

### 2. Configurar Environment Variable
No Vercel Dashboard > Project Settings > Environment Variables:

```
Key: BLOB_READ_WRITE_TOKEN
Value: [token gerado automaticamente pelo Vercel]
Environments: Production, Preview, Development
```

### 3. Redeploy
Após configurar:
1. Vá para **Deployments**
2. Clique em **Redeploy** (com "Clear build cache")
3. Aguarde o deploy completar

## APIs Modificadas

### `/api/upload-video`
- ✅ Runtime: `nodejs` (em vez de `edge`)
- ✅ Upload para Vercel Blob
- ✅ Suporta vídeos até 500MB
- ✅ Retorna URL pública

### `/api/upload-image`
- ✅ Runtime: `nodejs`
- ✅ Upload para Vercel Blob
- ✅ Suporta imagens grandes
- ✅ Retorna URL pública

### `/api/upload-captions`
- ✅ Runtime: `nodejs`
- ✅ Upload para Vercel Blob
- ✅ Suporta ficheiros .vtt
- ✅ Retorna URL pública

## Estrutura de Ficheiros no Blob
```
guides/
  {slug-do-guia}/
    background_{timestamp}_{nome}.mp4
    welcome_{timestamp}_{nome}.mp4
    chatIcon_{timestamp}_{nome}.jpg
    captions_desktop_{timestamp}.vtt
    captions_tablet_{timestamp}.vtt
    captions_mobile_{timestamp}.vtt
```

## URLs Geradas
As APIs agora retornam URLs completas do Vercel Blob:
```json
{
  "success": true,
  "stored": true,
  "path": "https://virtualguide-blob.vercel-storage.com/guides/meu-guia/background_1234567890_video.mp4",
  "fileName": "background_1234567890_video.mp4"
}
```

## Vantagens
- ✅ **Sem limitações de tamanho** (até 500MB)
- ✅ **Performance melhorada** (CDN global)
- ✅ **Custo zero** (incluído no plano Vercel)
- ✅ **URLs públicas** (sem autenticação)
- ✅ **Backup automático** (redundância)

## Teste
Após configuração:
1. Crie um novo guia no backoffice
2. Faça upload de vídeos/imagens
3. Verifique que não há erros na consola
4. Confirme que os ficheiros são acessíveis via URL

## Notas Importantes
- O token `BLOB_READ_WRITE_TOKEN` é gerado automaticamente pelo Vercel
- Não é necessário configurar nada localmente
- Os ficheiros existentes em `/public/guides/` continuam a funcionar
- Novos uploads vão para o Vercel Blob
