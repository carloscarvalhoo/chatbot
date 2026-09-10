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
2. **Environment Variables** — copiar tudo do `.env.local`:
   - Firebase (6 `NEXT_PUBLIC_*` + `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`)
   - `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, `GEMINI_EMBEDDING_DIMENSION`
   - `AI_CHAIN`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`
   - `CHAT_CONTEXT_SECRET` (se a cópia usar) — **gerar novo para produção**
   - **`CRON_SECRET`** — gerar novo: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
3. Deploy. O `vercel.json` registra o cron `/api/cron/refresh-urls`.

### Cron
- **Plano Hobby**: crons rodam no máximo **1×/dia**, mesmo com `schedule` de hora em hora.
- **Plano Pro**: roda de hora em hora (como está no `vercel.json`).
- **Sem upgrade**: use GitHub Actions (grátis, de hora em hora):

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
