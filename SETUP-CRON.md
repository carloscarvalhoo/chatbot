# Cron de atualização das páginas

Mantém a base de conhecimento em dia: re-raspa as páginas do site do IFPR,
compara o conteúdo e **re-processa só as que mudaram**.

## Como funciona

`GET /api/cron/refresh-urls` (protegido por `CRON_SECRET`):
1. Para cada documento com `sourceUrl`, re-raspa a página.
2. Calcula o hash do texto. Igual ao `contentHash` salvo → só atualiza `lastCheckedAt`.
3. Diferente → re-fragmenta, re-embeda (768d) e marca `needsReview: true` +
   `contentChangedAt`. O gestor vê 🟡 no painel.
4. Página inacessível (404) → marca `lastCheckFailed: true`.

Retorna: `{ total, checked, unchanged, updated, failed, changedTitles }`.

## Ativar

### Vercel (recomendado)
Já existe `vercel.json` com:
```json
{ "crons": [{ "path": "/api/cron/refresh-urls", "schedule": "0 6 * * *" }] }
```
- Roda todo dia às 06:00 UTC (03:00 BRT).
- **No plano Hobby o cron roda no máximo 1×/dia** — o schedule acima já respeita isso.
- Defina `CRON_SECRET` nas Environment Variables do projeto na Vercel.
  A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente.

### GitHub Actions (alternativa)
`.github/workflows/refresh.yml`:
```yaml
name: Refresh knowledge base
on:
  schedule: [{ cron: "0 6 * * 1" }]   # segunda-feira 06:00 UTC
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST \
            "https://SEU-DOMINIO/api/cron/refresh-urls?secret=${{ secrets.CRON_SECRET }}"
```

### Manual (teste)
No painel admin → **"Verificar atualizações"** (botão ao lado de "Reindexar tudo").
Ou:
```bash
curl -X POST "http://localhost:3000/api/cron/refresh-urls?secret=<CRON_SECRET>"
```

## Aviso ao usuário quando a fonte está vencida

Se o gestor marcar uma `expiresAt` num documento e ela passar, e esse documento
for a fonte principal de uma resposta, o LUMI:
- recebe um aviso no contexto e alerta o usuário na resposta;
- o chat mostra "⚠️ Parte desta resposta pode estar desatualizada" + a fonte fica
  com borda âmbar.

Marcar validade: painel → botão **"Marcar revisado"** / campo de data de validade
(`PATCH /api/admin/files` com `action: "setValidity"`).
