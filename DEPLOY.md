# Deploy

## Antes

```bash
npm run test          # 42 testes
npm run lint          # 0 erros
npm run format:check  # formatação ok
npm run build         # build de produção
```

## Vercel

1. Importar o repo na Vercel.
2. **Environment Variables** — ver a lista completa em `.env.example`. O mínimo:
   - **Obrigatórias (10):** os 6 `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` + `GEMINI_API_KEY`.
   - **Recomendadas:** `AI_CHAIN`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`.
   - **`CRON_SECRET`** — gerar um novo para produção: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   - **Opcional:** `PUBLIC_APP_URL` = a URL do deploy (melhora o header enviado ao OpenRouter).
   - **NÃO colocar em produção:** `EVAL_SECRET` (só serve para o script `npm run eval` local; o código ignora esse header quando `NODE_ENV=production`).
3. Deploy. O `vercel.json` registra o cron `/api/cron/refresh-urls`.

### Cron
- O `vercel.json` está com `0 8 * * *` (1×/dia, 08:00 UTC) — o máximo que o **plano Hobby** permite. Um `schedule` mais frequente faz o deploy falhar no Hobby.
- **Plano Pro**: pode aumentar a frequência (ex: `0 * * * *` de hora em hora).
- **Quer mais frequente sem pagar**: use GitHub Actions (grátis):

```yaml
# .github/workflows/refresh.yml
name: Atualizar base
on:
  schedule: [{ cron: "0 * * * *" }]
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "https://SEU-DOMINIO/api/cron/refresh-urls?secret=${{ secrets.CRON_SECRET }}"
```

## Firestore

- Índice vetorial `chunks.embedding` (768d, Collection group) já criado.
- `firestore.indexes.json` na raiz tem a config para `firebase deploy --only firestore:indexes`.

## Pós-deploy

- Rodar `npm run dedupe` uma vez (remove duplicatas antigas da base).
- Testar `/api/cron/refresh-urls?secret=...` manualmente.
- Preencher **Configurações → Link de suporte** no painel admin.
