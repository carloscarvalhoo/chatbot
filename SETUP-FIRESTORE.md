# Setup do Firestore — busca vetorial

## Status (10/09/2026)

- ✅ **Índice vetorial criado** — `chunks.embedding`, 768d, flat, query scope *Collection group*. Index ID `CICAgOjXh4EK`.
- ✅ **Reindex executado** — `npm run reindex` (139 páginas do site IFPR re-raspadas e re-embeddadas em 768d).

Se precisar refazer:

## Reindexar a base

```bash
npm run reindex            # tudo
npm run reindex -- --dry   # só simula (não grava)
npm run reindex -- --only=<fileId>
```

Re-raspa cada URL, re-fragmenta (500/80), re-gera embeddings em 768d e regrava
como `FieldValue.vector`. PDFs usam o texto bruto salvo (`rawText`); se não houver,
reconstrói a partir dos chunks existentes.

## Recriar o índice vetorial (se for apagado)

**Opção A — console** (Firestore → Índices → Criar índice → "Create vector index"):
- Collection ID: `chunks`
- Vector field path: `embedding`
- Dimensions: `768`
- Query scopes: **Collection group**

**Opção B — gcloud**:
```bash
gcloud firestore indexes composite create \
  --project=web-chatbot-d5d91 \
  --collection-group=chunks \
  --query-scope=COLLECTION_GROUP \
  --field-config=vector-config='{"dimension":"768","flat": "{}"}',field-path=embedding
```

**Opção C — script** (`npm run setup-vector-index`): só funciona se a service
account tiver `roles/datastore.indexAdmin` (por padrão não tem — dá 403).

## Como conferir

Faça uma pergunta no chat. No log do servidor os chunks devem vir com
`searchType: "vector"` e o aviso "findNearest indisponível" não deve mais aparecer.
O TTFB deve cair de ~9s para ~1s.

## Variáveis relevantes (opcionais, têm default)

```
CHUNK_SIZE=500
CHUNK_OVERLAP=80
MAX_CHUNKS_PER_FILE=400
SEARCH_TOP_K=8
SEARCH_MIN_SIMILARITY=0.4
```
