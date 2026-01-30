# Ollama Node for ZeroPrompt Subnet

Deploy an Ollama node on Railway to participate in the ZeroPrompt decentralized network.

## Quick Deploy

```bash
cd apps/contracts/ollama-railway

# Initialize Railway project
railway init

# Deploy
railway up

# Get your public URL
railway domain
```

## Configuration

The node will automatically pull these models on startup:
- `tinyllama` (Small, fast)
- `llama3.2:1b` (Better quality, still small)

## Verify Deployment

```bash
# Get your Railway URL and test
curl https://your-app.railway.app/api/tags
```

## Register as Operator

Once deployed and verified, register your node as an operator:

```bash
cd apps/contracts

OLLAMA_ENDPOINT=https://your-app.railway.app MODELS=tinyllama,llama3.2:1b \
  npx hardhat run scripts/register-operator.ts --network avalancheFuji
```
