// Mock for @coinbase/wallet-sdk to prevent Metro bundling errors
// The actual Coinbase connector is disabled in Web3Provider config

export class CoinbaseWalletSDK {
  constructor() {
    console.warn('Coinbase Wallet SDK is not supported in this environment');
  }

  makeWeb3Provider() {
    return null;
  }
}

export default CoinbaseWalletSDK;
