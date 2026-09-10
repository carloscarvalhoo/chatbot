# Arquitetura do LUMI

Documentação técnica do assistente virtual institucional. Para rodar o projeto,
veja o [`README.md`](../README.md); para publicar, o [`DEPLOY.md`](../DEPLOY.md).

A documentação de referência das funções (gerada a partir dos comentários
JSDoc) fica em `docs/api/` depois de rodar `npm run docs`.

---

## Visão geral

O LUMI é um chatbot **RAG** (_Retrieval-Augmented Generation_): ele não "sabe"
nada por conta própria, só responde com base em um conjunto de documentos que a
equipe gestora cadastra (páginas de site e PDFs). Cada resposta passa por:

```
pergunta do usuário
      │
      ▼
[1] embedding da pergunta ──►  [2] busca no Firestore (vetor + palavra-chave)
                                        │
                                        ▼
                              [3] monta o prompt (regras + trechos encontrados)
                                        │
                                        ▼
                              [4] cadeia de modelos de IA (com fallback)
                                        │
                                        ▼
                              [5] resposta em streaming + fontes citadas
```

Fora do fluxo de resposta, há dois processos de manutenção:

- **Ingestão** — transforma um site/PDF em trechos vetorizados.
- **Atualização** — um cron re-verifica as páginas e reprocessa só o que mudou.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Banco | Cloud Firestore (plano Spark / gratuito), com índice vetorial |
| Autenticação (painel) | Firebase Authentication |
| Embeddings | Google Gemini (`gemini-embedding-001`, 768 dimensões) |
| Geração de texto | Cadeia de modelos: Groq → OpenRouter → Google Gemini |
| Testes | Vitest (lógica pura) + bateria de acurácia (`eval/`) |
| Documentação | JSDoc |

---

## Módulos do servidor (`src/server/`)

### `ai/` — motor de IA

| Módulo | Responsabilidade |
|---|---|
| `aiService.js` | Orquestra uma resposta: busca + settings + prompt + cadeia de modelos + memória. Ponto de entrada do chat. |
| `chain.js` | Registro de provedores e montagem da cadeia a partir de specs `"provedor:modelo"`. |
| `fallback.js` | Percorre a cadeia com circuit breaker, timeout, retry e queda para o próximo provedor. Versões com e sem streaming. |
| `providers/` | Um adaptador por tipo de API: `googleProvider` (SDK Gemini) e `openaiCompatibleProvider` (Groq, OpenRouter, Mistral, Cerebras). `shared.js` tem os helpers de fetch/SSE; `types.js` o contrato. |
| `embeddings.js` | Geração de embeddings (um a um e em lote). Marca um _cooldown_ quando a cota diária estoura, para a busca não perder tempo. |
| `retry.js` | `withTimeout` e `withRetry` (backoff exponencial). |
| `circuitBreaker.js` | Em memória do processo. "Abre" um modelo por alguns minutos após estourar a cota. |
| `errors.js` | Classifica o erro do provedor (quota / sobrecarga / timeout / ...) para decidir retry vs. fallback. |
| `quota.js` | Estima quando a cota volta, para o contador da "fila de espera". |
| `prompts.js` | Monta os prompts do sistema, incluindo as regras de segurança e de aderência à base. |
| `memory.js` | Buffer curto de mensagens + resumo do excedente ("memória longa"). |
| `compareModels.js` | Roda a mesma pergunta em vários modelos para o comparador do painel. |

**Como a cadeia de fallback funciona.** `AI_CHAIN` (ou a ordem definida no
painel) é uma lista `"provedor:modelo,provedor:modelo,..."`. `fallback.js`
tenta o primeiro; em erro transitório (503/timeout) faz retry no mesmo modelo;
em erro definitivo (429 de cota, 404) pula para o próximo e "abre" o circuit
breaker do que falhou. Se **todos** falharem, devolve um erro com
`retryAfterMs` — o chat mostra a fila de espera com contagem regressiva. No
streaming, a troca de provedor só acontece **antes do primeiro token**.

### `knowledge/` — base de conhecimento

| Módulo | Responsabilidade |
|---|---|
| `searchKnowledge.js` | Busca: `findNearest` do Firestore (vetorial nativa, ~8 leituras) com queda para varredura + cosseno / palavra-chave em memória. Monta a lista de fontes com frescor. |
| `saveKnowledgeFile.js` | `persistKnowledgeDocument`: classifica → fragmenta → embeddings → grava chunks como vetores → salva texto bruto. Compartilhado por upload e reprocessamento. |
| `saveKnowledgeUrl.js` | Ingestão de uma página web (raspa, deduplica por URL, persiste). |
| `scrapePage.js` | Baixa e limpa o HTML, com timeout, limite de tamanho e GET condicional (ETag / If-Modified-Since). |
| `sitemap.js` | Descobre e parseia sitemaps para saber a data de última modificação de cada URL. |
| `refreshUrls.js` | Cron: cascata sitemap _lastmod_ → GET condicional → hash de conteúdo. Reprocessa só o que mudou. |
| `classify.js` | Classifica o documento pela URL e pelo conteúdo (tipo, intervalo de revisão, data citada). |
| `freshness.js` | Cálculo **puro** do estado: em dia / revisar / vencido. Testável, sem I/O. |
| `knowledgeMeta.js` | Marcar como revisado, definir validade. |
| `listKnowledgeFiles.js` | Lista para o painel, com frescor e datas serializadas. |
| `rawText.js` | Guarda o texto extraído em pedaços numa subcoleção (permite reprocessar sem re-upload). |
| `reprocessKnowledgeFile.js` | Re-fragmenta e re-embeda um documento (ou todos). |
| `deleteKnowledgeFile.js` | Apaga o documento e tudo que é dele. |

### Outros

| Módulo | Responsabilidade |
|---|---|
| `chat/chatGuards.js` | Validação/sanitização da entrada do chat + rate limit por IP. |
| `chat/rateLimitStore.js` | Rate limit híbrido: contador em memória + Firestore perto do limite. |
| `settings/getSettings.js` · `saveSettings.js` | Configuração institucional (nome, mensagens, ordem dos modelos, contatos de suporte), com cache de 5 min. |
| `auth/checkAdminAccess.js` · `getAdminClaims.js` | Guarda das rotas do painel (cookie de sessão do Firebase). |
| `firebase/admin.js` | Firebase Admin com **inicialização preguiçosa** (só liga no primeiro uso, nunca no build). |
| `pdf/chunkText.js` · `parsePdf.js` | Normalização de texto, divisão em chunks, extração de PDF. |
| `ratings/saveRating.js` | Salva o 👍 / 👎 de uma resposta. |
| `utils/` | `errors` (erro HTTP), `hash` (detecção de mudança), `logger`, `validateEnv`. |

---

## Fluxo de dados

### Responder uma pergunta

1. `POST /api/chat` → `chatGuards` valida e checa rate limit.
2. `aiService.sendMessageStream` chama `prepareContext`:
   - `searchKnowledgeChunks` gera o embedding da pergunta e faz `findNearest`;
   - `getSourcesWithFreshness` lê os documentos-pai e calcula o frescor;
   - `getSystemPrompt` junta regras + trechos + memória da conversa.
3. `streamChatWithFallback` percorre a cadeia de modelos e emite os tokens.
4. A rota devolve NDJSON (uma linha JSON por evento); o cliente monta a bolha.
5. `updateMemoryIfNeeded` resume o histórico se ele ficou grande.

**Custo por pergunta:** ~14-17 leituras no Firestore (12 do `findNearest` + o
`getAll` das fontes) e 1 requisição de embedding. Com o plano Spark isso dá um
teto de ~1000 perguntas/dia por chave de embedding (o embedding é o gargalo:
1000 RPD grátis). Configurar `GEMINI_API_KEYS` com mais de uma chave multiplica
esse teto — todas usam o mesmo modelo, então o índice continua válido.

### Cadastrar um site

1. `POST /api/admin/map-urls` raspa a página inicial e lista os links internos.
2. O gestor seleciona quais indexar.
3. Para cada URL: `scrapePage` → `splitTextIntoChunks` → `deriveDocPolicy`
   (classificação) → `generateEmbeddingsBatch` → grava os chunks como
   `FieldValue.vector(...)` + o texto bruto.

### Manter a base em dia

`GET /api/cron/refresh-urls` (protegido por `CRON_SECRET`, 1×/dia na Vercel):
para cada documento de URL, `refreshAllUrls` decide se mudou —
_lastmod_ do sitemap → GET condicional (304) → comparação de hash — e só então
reprocessa. Documentos "vencidos" (edital do ano passado, etc.) são detectados
por `computeFreshness` e o chat avisa o usuário quando usa uma fonte assim.

---

## Firestore

| Coleção | Conteúdo |
|---|---|
| `knowledgeFiles/{id}` | Um documento da base (nome, URL, tipo, datas, frescor). |
| `knowledgeFiles/{id}/chunks/{n}` | Um trecho + seu vetor (`embedding`). O índice vetorial é _collection group_ neste campo. |
| `knowledgeFiles/{id}/rawText/{parte}` | Texto extraído, em pedaços de 700 KB. |
| `settings/institution` | Configuração institucional (documento único). |
| `rateLimits/{ip}` | Contador de rate limit (só quando o IP se aproxima do limite). |
| `ratings/{id}` | Avaliações 👍/👎. |

O índice vetorial precisa ser criado uma vez — ver [`SETUP-FIRESTORE.md`](../SETUP-FIRESTORE.md).

---

## Decisões de projeto

- **Busca vetorial nativa do Firestore** (`findNearest`) em vez de varrer a
  coleção: derrubou a latência do chat de ~9-15 s para ~2-3 s e o custo de
  ~800 para ~10 leituras por pergunta.
- **Chaves de API só no ambiente**, nunca no banco nem no painel. O painel só
  controla a **ordem** e a ativação dos modelos.
- **Chunks de 500 caracteres** com 80 de sobreposição: recuperação mais
  precisa ao custo de mais documentos.
- **Prompt endurecido**: regras explícitas contra injeção, contra fingir ser
  admin e contra responder fora da base. Dá para inspecionar o prompt montado
  no painel.
- **Sem armazenar o texto das conversas**: só contadores. Menos escrita e mais
  privacidade.
- **Inicialização preguiçosa do Firebase**: o SDK só liga no primeiro uso real,
  para o `next build` conseguir analisar as rotas sem as variáveis presentes.

---

## Testes

- `npm run test` — Vitest, ~42 testes de lógica pura (chunking, classificação
  de erro, frescor, parsing de sitemap, cálculo de cota).
- `npm run eval` — bateria de acurácia: roda `eval/faq-dataset.json` contra o
  chat em execução e mede recuperação, palavras-chave e um juiz LLM. Precisa do
  servidor no ar e de `EVAL_SECRET` no `.env.local`.
- `npm run capacity` — mede o limite de requisições de cada modelo.
