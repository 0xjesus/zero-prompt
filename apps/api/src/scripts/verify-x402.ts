import { ethers } from 'ethers';
const fetch = require('node-fetch');

// CONFIGURACIÓN
const API_URL = 'http://localhost:3001';
const ENDPOINT = '/agent/generate';
// PRECIO REAL DE PRUEBA: 0.001 AVAX (~$0.03 USD)
// Ajusta esto si quieres gastar menos o más
const TEST_PRICE = ethers.parseEther("0.001"); 

async function main() {
  console.log("🚨 ALERTA: Iniciando Verificación en AVALANCHE MAINNET");
  console.log("🚨 ESTO GASTARÁ AVAX REAL DE TU WALLET");
  console.log("------------------------------------------------");

  // 1. Configurar Wallet Real (Mainnet)
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
      console.error("❌ ERROR: Necesitas definir PRIVATE_KEY en .env con fondos reales.");
      process.exit(1);
  }

  // CONECTANDO A MAINNET
  const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log(`🤖 Agente Real: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} AVAX`);

  if (balance < TEST_PRICE) {
      console.error("❌ ERROR: Fondos insuficientes para el test en Mainnet.");
      process.exit(1);
  }

  // 2. Request Inicial
  console.log("\n1️⃣  Paso 1: Request inicial (Challenge)...");
  const initialRes = await fetch(`${API_URL}${ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: "Hola desde Mainnet" })
  });

  let merchantAddress = "";
  let priceWei = TEST_PRICE;

  if (initialRes.status === 402) {
      const challenge = await initialRes.json();
      const req = challenge.accepts[0];
      console.log(`📝 Desafío Mainnet: Pagar ${ethers.formatEther(req.maxAmountRequired)} AVAX a ${req.payTo}`);
      merchantAddress = req.payTo;
      priceWei = BigInt(req.maxAmountRequired);
  } else {
      console.log("⚠️  No recibí 402, status:", initialRes.status);
      // Continuamos con valores por defecto para forzar la prueba si el endpoint está abierto
      merchantAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; 
  }

  // 3. Enviar Transacción AVAX Real
  console.log("\n2️⃣  Paso 2: Enviando Transacción AVAX Real...");
  const tx = await wallet.sendTransaction({
      to: merchantAddress,
      value: priceWei
  });
  console.log(`✅ Tx Enviada: https://snowtrace.io/tx/${tx.hash}`);
  
  console.log("⏳ Esperando confirmación en Mainnet...");
  await tx.wait();
  console.log("✅ Tx Confirmada.");

  // 4. Reintentar con el Hash
  console.log("\n3️⃣  Paso 3: Reintentando request con TxHash...");

  const paymentPayload = {
    txHash: tx.hash
  };

  const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

  const finalRes = await fetch(`${API_URL}${ENDPOINT}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-PAYMENT': base64Payload
    },
    body: JSON.stringify({ prompt: "Hola, soy un Agente REAL pagando en AVAX Mainnet." })
  });

  if (finalRes.status === 200) {
    const data = await finalRes.json();
    console.log("✅ ÉXITO: Acceso concedido en Mainnet");
    console.log("🧠 Respuesta IA:", data.result);
  } else {
    console.error(`❌ Error: Status ${finalRes.status}`);
    console.error(await finalRes.text());
  }
}

main().catch(console.error);
