# LUMI — Assistente Virtual Institucional

Chatbot institucional com RAG (Retrieval-Augmented Generation) para o IFPR.
Responde dúvidas do público usando **apenas** o conteúdo cadastrado pela equipe
(páginas do site e PDFs), com data de atualização das fontes e aviso quando a
informação pode estar desatualizada.

Trabalho acadêmico. Stack: **Next.js 16 (App Router) · React 19 · Firestore ·
Google Gemini** (embeddings + geração), com cadeia de fallback multi-provedor.

---

## Como funciona

1. **Ingestão** — o gestor cola a URL de um site (o sistema mapeia as páginas) ou
   envia PDFs. O texto é limpo, dividido em trechos (_chunks_) e cada trecho vira
   um vetor de embedding salvo no Firestore.
2. **Busca** — a pergunta do usuário também vira um vetor; o Firestore
   (`findNearest`) devolve os trechos mais parecidos. Sem embedding disponível,
   cai para busca por palavra-chave.
3. **Resposta** — os trechos entram no prompt de um modelo de linguagem, que
   responde só com base neles. Se nenhum provedor de IA responder, o usuário vê
   uma "fila de espera" com contagem regressiva.
4. **Frescor** — cada fonte é classificada (edital, portaria, notícia, página
   institucional...) e ganha uma data de revisão automática. Um cron re-verifica
   as URLs (via sitemap / hash) e marca o que mudou.

## Rodando localmente

Pré-requisitos: Node 20+, um projeto Firebase (Firestore + Authentication), uma
chave da API do Google Gemini.

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

Rotas: `/chat` (público) · `/admin` (painel do gestor, protegido por login
Firebase Auth).

### Firestore

Crie o índice vetorial na coleção `chunks` (campo `embedding`, 768 dimensões,
_collection group_). Detalhes em [`SETUP-FIRESTORE.md`](./SETUP-FIRESTORE.md).
O cron de atualização é descrito em [`SETUP-CRON.md`](./SETUP-CRON.md) e o deploy
em [`DEPLOY.md`](./DEPLOY.md).

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | servidor de desenvolvimento / build / produção |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | testes unitários (Vitest) |
| `npm run eval` | bateria de acurácia (`eval/faq-dataset.json`) contra o chat rodando |
| `npm run capacity` | mede limite de requisições dos modelos de IA |
| `npm run reindex` | re-gera todos os embeddings da base |
| `npm run dedupe` | remove documentos duplicados por URL |
| `npm run docs` | gera a referência das funções (JSDoc) em `docs/api/` |

## Documentação

- [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) — visão geral, módulos, fluxo de dados e decisões de projeto.
- `npm run docs` gera a referência HTML das funções a partir dos comentários (`docs/api/`, não versionado).

## Estrutura

```
src/
  app/            rotas (Next App Router): /chat, /admin, /api/*
  components/     componentes de UI (chat, admin, ui compartilhada)
  features/       hooks e serviços do cliente por área
  server/
    ai/           motor de IA: cadeia de provedores, fallback, retry,
                  circuit breaker, embeddings, prompts
    knowledge/    ingestão, busca vetorial, chunking, frescor das fontes
    chat/         guardas da rota de chat (rate limit, validação)
    settings/     configuração institucional (Firestore)
    firebase/     inicialização do Firebase Admin
eval/             dataset de perguntas para a bateria de acurácia
scripts/          utilitários de linha de comando
test/             testes unitários (lógica pura)
```

## Provedores de IA

A `AI_CHAIN` define a ordem de tentativa. Suporta **Google Gemini** e qualquer
API **compatível com OpenAI** (Groq, OpenRouter, Mistral, Cerebras). O painel do
gestor permite reordenar e ativar/desativar os modelos; as chaves de API ficam
sempre no ambiente (`.env` / variáveis da Vercel), nunca no banco.

## Segurança

- Nenhuma chave fica no código — tudo vem de variáveis de ambiente.
- O `.env.local` está no `.gitignore`.
- O prompt do assistente tem regras rígidas contra injeção e contra responder
  fora da base de conhecimento.
