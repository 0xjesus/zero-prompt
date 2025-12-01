# ZeroPrompt monorepo

Monorepo (Node + Express + Prisma backend, Expo/React Native + web frontend).

## Estructura
- `apps/api`: API en Express con Prisma (MySQL).
- `apps/zeroprompt`: app Expo (iOS/Android/Web) con `expo-router`.
- `apps/contracts`: smart contracts con Hardhat.
- `packages/config`: base `tsconfig`.

## Instalación
1) Usa Node 18+.  
2) Usa un único `.env` en la raíz (ya presente) para API y contratos.  
3) Instala dependencias desde la raíz: `npm install`. (`npm` usará los workspaces para `apps/*` y `packages/*`).

## Backend
```bash
cd apps/api
npm install
npm run db:generate                        # usa ../../.env
# Cuidado: `npm run db:push` aplicará el esquema sobre la DB de .env y puede borrar datos
npm run dev                                # Servirá en http://localhost:3001
# Test:
npm test
```
Variables clave:
- `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `APP_URL` (referer para OpenRouter).
- `DATABASE_URL` (MySQL).
- `MODEL_SYNC_CRON` (opc. cron expr), `DISABLE_MODEL_SYNC=1` para apagar cron.
- Endpoints: `GET /models` lista modelos activos, `POST /models/sync` sincroniza ya.
- CLI: `npm run sync:models` (en `apps/api`) dispara la sincronización manual.
- LLM: no hay modelo por defecto; el cliente debe pasar `model` (elige de `/models`). `OPENROUTER_MODEL` es opcional solo si quieres un fallback manual.

## Frontend (Expo)
```bash
cd apps/zeroprompt
npm run start                              # Elige ios/android/web
```

## Smart contracts (Hardhat)
```bash
cd apps/contracts
npm run compile
npm test                                   # Pruebas en red hardhat local
# Deploy Fuji (Avalanche testnet):
npm run deploy:fuji
# Deploy Avalanche Mainnet (cuidado):
# npm run deploy:avalanche
# Deploy with custom USDT (override .env USDT_TOKEN_ADDRESS)
# USDT_TOKEN_ADDRESS=0x... npm run deploy:fuji
```
Contratos:
- `ZeroPromptRegistry` ahora exige token de pago permitido (por defecto USDT.e en Avalanche). Admin puede agregar/quitar tokens con `setAllowedToken`.

## Notas
- El esquema Prisma actual usa PostgreSQL y un modelo `Prompt`.
- Scripts raíz útiles: `npm run dev:api`, `npm run dev:app`.
- Aún no se añadió ESLint; `tsc --noEmit` cubre el chequeo básico en el API.
