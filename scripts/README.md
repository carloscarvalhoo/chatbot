# scripts/

## model-capacity-test.mjs

Mede quanta carga cada modelo grátis da cadeia aguenta.

```bash
npm run capacity                 # sweep: 1 req por modelo (rápido, ~6 requisições)
npm run capacity -- --mode=rpm --model=groq:openai/gpt-oss-120b --duration=60
npm run capacity -- --mode=rpd --model=google:gemini-3.6-flash --max-requests=300
```

| Modo | O que faz |
|---|---|
| `sweep` (padrão) | 1 requisição por modelo — panorama de latência e disponibilidade |
| `rpm` | rajada por N segundos (`--duration`) com `--concurrency` — acha o teto por minuto |
| `rpd` | sustentado a ~50 req/min até bater `429` de cota — conta quantas entregou |
| `turn` | igual ao `rpd` (placeholder para simular turno completo depois) |

**Saída:** tabela no console + CSV em `scripts/output/` (git-ignored).
`Ctrl+C` gera relatório parcial.

### ⚠️ Cota

Por padrão usa as **mesmas chaves da produção** — o teste gasta a cota do dia.
Para isolar, defina no ambiente:

```
CAPACITY_GROQ_API_KEY=...
CAPACITY_GEMINI_API_KEY=...
CAPACITY_OPENROUTER_API_KEY=...
```

O script prefere `CAPACITY_<PROVIDER>_API_KEY` e cai na chave normal se não achar.

### Limites conhecidos (mudam com frequência — por isso o teste)

- **Groq free**: ~30 req/min, teto de tokens/dia por modelo
- **OpenRouter `:free`**: 20 req/min · 50 req/dia (1.000/dia se já comprou US$10 de crédito)
- **Gemini free**: ~10 req/min nos modelos 3.x, cota diária menor que nas versões antigas
