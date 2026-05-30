# Lux Trader FX — Produção

## Desenvolvimento local

1. Copie `.env.example` para `.env` e preencha as chaves no **servidor** (`GEMINI_API_KEY`, `TWELVE_DATA_KEY`, etc.).

2. Instale dependências:

```bash
npm install
cd backend && npm install && cd ..
```

3. Suba frontend + API:

```bash
npm run dev:all
```

- UI: http://localhost:3000  
- API: http://localhost:3001  
- Health: http://localhost:3001/health  

## Fluxo

1. Login com token de acesso  
2. Escolha ativo e timeframe  
3. Toggle **Instantâneo** (intra-candle) ou **Confirmado** (candle fechado)  
4. Clique **ANALISAR MERCADO** — um sinal por clique (sem scanner automático)  

## Docker

```bash
docker compose up -d postgres redis
npm run dev:api
npm run dev
```

## Deploy Vercel (frontend) + API (Render ou Vercel)

### Frontend — https://oficial-lux-trader.vercel.app

1. No painel Vercel do projeto frontend, defina **Environment Variables** (Production):

   ```
   VITE_API_URL=https://lux-trader-api.onrender.com/api/v1
   ```

   Ou use `VITE_API_ORIGIN=https://lux-trader-api.onrender.com` se preferir só a origem.

2. O `vercel.json` já inclui **rewrites** de `/api/*` e `/health` para a API Render (same-origin). Com isso, `/api/v1` relativo também funciona sem `VITE_API_URL`.

3. Após alterar env vars, faça **Redeploy** (build do Vite embute as variáveis).

### Backend (NestJS)

1. `CORS_ORIGIN` deve incluir `https://oficial-lux-trader.vercel.app` (já está em `main.ts` e `.env.example`).

2. Health check: `GET https://<sua-api>/health`

3. Analyze: `POST https://<sua-api>/api/v1/signals/analyze`

## Segurança

- Secrets apenas em `.env` do backend  
- `EXECUTION_ENABLED=false` por padrão  
- Frontend não assina ordens (HMAC no servidor quando execução for ativada)  
