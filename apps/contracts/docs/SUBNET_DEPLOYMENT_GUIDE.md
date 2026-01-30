# ZeroPrompt Subnet - Guía de Deployment para Demo

## 1. Desplegar Contratos en Fuji Testnet

### Prerequisitos
```bash
# Obtener AVAX de testnet del faucet
# https://faucet.avax.network/
# Necesitas ~2 AVAX para deployments
```

### Configurar .env
```bash
cd apps/contracts

# Crear .env si no existe
cat > .env << 'EOF'
PRIVATE_KEY=tu_private_key_aqui
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
EOF
```

### Desplegar
```bash
cd apps/contracts
npm install
npx hardhat run scripts/deploy-subnet.ts --network avalancheFuji
```

Esto desplegará:
- MockERC20 (ZEROP token para testing)
- OperatorNFT
- OperatorRegistry
- SubnetRewards

Guarda las direcciones que salen!

---

## 2. Opciones para Nodo Ollama

### Opción A: Railway.app (Recomendado para demo rápido)
**Costo:** ~$5-20/mes dependiendo del uso

```bash
# 1. Crear cuenta en railway.app
# 2. Nuevo proyecto > Deploy from GitHub o Docker

# Usar este Dockerfile:
```

```dockerfile
FROM ollama/ollama:latest

# Exponer puerto
EXPOSE 11434

# Descargar modelo al iniciar (pequeño para demo)
CMD ollama serve & sleep 10 && ollama pull tinyllama && wait
```

**Configuración Railway:**
- Port: 11434
- Memory: 2GB mínimo (4GB mejor)
- CPU: 2 cores

---

### Opción B: Render.com (Background Worker)
**Costo:** $7/mes (Starter plan)

1. Crear nuevo "Background Worker"
2. Usar Docker image: `ollama/ollama`
3. Start command: `ollama serve`
4. Agregar "Web Service" como proxy si necesitas HTTPS

---

### Opción C: DigitalOcean Droplet (Más control)
**Costo:** $12-24/mes

```bash
# En el droplet (Ubuntu 22.04, 4GB RAM mínimo)
curl -fsSL https://ollama.com/install.sh | sh

# Configurar para escuchar en todas las interfaces
sudo systemctl edit ollama

# Agregar:
[Service]
Environment="OLLAMA_HOST=0.0.0.0"

# Reiniciar
sudo systemctl restart ollama

# Descargar modelo
ollama pull llama3.2:1b  # Modelo pequeño para demo
ollama pull tinyllama    # Aún más pequeño

# Verificar
curl http://localhost:11434/api/tags
```

**Firewall:**
```bash
sudo ufw allow 11434/tcp
```

---

### Opción D: Fly.io (Serverless pero con persistencia)
**Costo:** ~$5-15/mes

```toml
# fly.toml
app = "zeroprompt-ollama"
primary_region = "ord"

[build]
  image = "ollama/ollama"

[http_service]
  internal_port = 11434
  force_https = true
  auto_stop_machines = false  # Importante!
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "4gb"
  cpu_kind = "shared"
  cpus = 2
```

```bash
fly launch
fly deploy
fly ssh console -C "ollama pull tinyllama"
```

---

### Opción E: RunPod.io (Si necesitas GPU real)
**Costo:** ~$0.20-0.50/hora (GPU)

Para modelos más grandes como llama3.2:7b o mistral:7b

---

## 3. Configurar Backend para Conectar

Una vez que tengas el nodo Ollama corriendo, actualiza el `.env` del API:

```bash
# apps/api/.env

# Contratos en Fuji
ZEROPROMPT_SUBNET_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ZEROP_TOKEN_ADDRESS=0x...
OPERATOR_NFT_ADDRESS=0x...
OPERATOR_REGISTRY_ADDRESS=0x...
SUBNET_REWARDS_ADDRESS=0x...

# Tu wallet para firmar transacciones (la misma que deployó)
SUBNET_PRIVATE_KEY=tu_private_key
```

---

## 4. Registrar tu Nodo Ollama como Operador

### Script para registrar operador
```typescript
// scripts/register-operator.ts
import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();

  // Direcciones de tus contratos desplegados
  const ZEROP_ADDRESS = "0x...";
  const NFT_ADDRESS = "0x...";
  const REGISTRY_ADDRESS = "0x...";

  const zerop = await ethers.getContractAt("MockERC20", ZEROP_ADDRESS);
  const nft = await ethers.getContractAt("OperatorNFT", NFT_ADDRESS);
  const registry = await ethers.getContractAt("OperatorRegistry", REGISTRY_ADDRESS);

  // 1. Aprobar ZEROP para mint (100 ZEROP)
  console.log("Aprobando ZEROP para mint...");
  await zerop.approve(NFT_ADDRESS, ethers.parseEther("100"));

  // 2. Mintear NFT de operador
  console.log("Minteando NFT de operador...");
  const tx = await nft.mint(
    "https://tu-ollama-url.railway.app",  // Tu endpoint de Ollama
    ["tinyllama", "llama3.2:1b"]           // Modelos que soportas
  );
  const receipt = await tx.wait();

  // Obtener tokenId del evento
  const event = receipt.logs.find(log => log.fragment?.name === "OperatorMinted");
  const tokenId = event.args[0];
  console.log(`NFT minteado! Token ID: ${tokenId}`);

  // 3. Aprobar ZEROP para stake (1000 ZEROP)
  console.log("Aprobando ZEROP para stake...");
  await zerop.approve(REGISTRY_ADDRESS, ethers.parseEther("1000"));

  // 4. Stakear
  console.log("Stakeando 1000 ZEROP...");
  await registry.stake(tokenId, ethers.parseEther("1000"));

  console.log("¡Operador registrado y activo!");
}

main().catch(console.error);
```

Correr:
```bash
npx hardhat run scripts/register-operator.ts --network avalancheFuji
```

---

## 5. Verificar que Todo Funciona

### Test del nodo Ollama
```bash
curl https://tu-ollama-url.railway.app/api/tags
# Debería mostrar los modelos instalados

curl https://tu-ollama-url.railway.app/api/chat -d '{
  "model": "tinyllama",
  "messages": [{"role": "user", "content": "Hello!"}],
  "stream": false
}'
```

### Test del API backend
```bash
curl http://localhost:3001/operators
# Debería mostrar tu operador

curl http://localhost:3001/operators/health
# Debería mostrar 1 nodo healthy
```

### Test end-to-end en el frontend
1. Ir a Settings
2. Cambiar a "Decentralized Mode"
3. Enviar un mensaje
4. Debería usar tu nodo Ollama (costo $0)

---

## Resumen de Costos para Demo

| Servicio | Costo Mensual |
|----------|---------------|
| Fuji Testnet | Gratis |
| Railway (Ollama) | ~$5-10 |
| Vercel (Frontend) | Gratis |
| **Total** | **~$5-10/mes** |

---

## Troubleshooting

### Ollama no responde
```bash
# Verificar que está corriendo
curl http://tu-url/api/tags

# Ver logs en Railway/Render
railway logs
```

### Nodo no aparece como healthy
- Verificar que el endpoint es accesible públicamente
- Verificar que el modelo está descargado
- Revisar CORS headers si aplica

### Transacciones fallan en Fuji
- Verificar que tienes AVAX de testnet
- Verificar que las direcciones de contratos son correctas
