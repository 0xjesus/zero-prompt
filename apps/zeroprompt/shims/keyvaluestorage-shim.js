/**
 * Patched @walletconnect/keyvaluestorage for React Native
 *
 * The original module crashes with "Cannot convert null value to object"
 * when AsyncStorage returns null for missing keys.
 *
 * WalletConnect Core uses objToMap() which does Object.keys() on storage values.
 * When values are null/undefined, this crashes. This shim returns empty objects/arrays
 * for missing keys based on the key pattern.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Log immediately at module load time
console.log("[KeyValueStorage Shim] ✅ MODULE LOADED - this should appear BEFORE any WC errors");

// Safe JSON parse that handles null/undefined
function safeJsonParse(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn("[KeyValueStorage Shim] JSON parse error:", e);
    return undefined;
  }
}

// Safe JSON stringify
function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.warn("[KeyValueStorage Shim] JSON stringify error:", e);
    return null;
  }
}

// Determine default value for WalletConnect keys
// WalletConnect uses objToMap() on these values, which crashes on null
function getDefaultForKey(key) {
  if (typeof key !== 'string') return undefined;

  // Keys that store Map-like objects (need empty object {})
  if (key.includes('keychain') ||
      key.includes('client') ||
      key.includes('core') ||
      key.includes('messages')) {
    return {};
  }

  // Keys that store arrays (need empty array [])
  if (key.includes('history') ||
      key.includes('pairing') ||
      key.includes('session') ||
      key.includes('proposal') ||
      key.includes('request') ||
      key.includes('expirer') ||
      key.includes('subscription')) {
    return [];
  }

  // For WC keys we don't recognize, return empty object as safe default
  if (key.startsWith('wc@')) {
    return {};
  }

  return undefined;
}

class KeyValueStorage {
  constructor() {
    this.asyncStorage = AsyncStorage;
    console.log("[KeyValueStorage Shim] Instance created");
  }

  async getKeys() {
    try {
      const allKeys = await this.asyncStorage.getAllKeys();
      return allKeys || [];
    } catch (e) {
      console.error("[KeyValueStorage Shim] getKeys error:", e);
      return [];
    }
  }

  async getEntries() {
    try {
      const keys = await this.getKeys();
      if (!keys || keys.length === 0) {
        return [];
      }
      const pairs = await this.asyncStorage.multiGet(keys);
      if (!pairs) {
        return [];
      }
      return pairs
        .map(([key, value]) => {
          let parsed = safeJsonParse(value);
          if (parsed === undefined) {
            parsed = getDefaultForKey(key);
          }
          if (parsed === undefined) {
            return null;
          }
          return [key, parsed];
        })
        .filter(Boolean);
    } catch (e) {
      console.error("[KeyValueStorage Shim] getEntries error:", e);
      return [];
    }
  }

  async getItem(key) {
    try {
      const value = await this.asyncStorage.getItem(key);

      // CRITICAL: Handle null values by returning appropriate defaults
      if (value === null || value === undefined) {
        const defaultVal = getDefaultForKey(key);
        if (defaultVal !== undefined) {
          console.log("[KeyValueStorage Shim] getItem returning default for missing key:", key, "=>", JSON.stringify(defaultVal));
        }
        return defaultVal;
      }

      const parsed = safeJsonParse(value);
      if (parsed === undefined) {
        const defaultVal = getDefaultForKey(key);
        console.log("[KeyValueStorage Shim] getItem parse failed, returning default for:", key);
        return defaultVal;
      }

      return parsed;
    } catch (e) {
      console.error("[KeyValueStorage Shim] getItem error:", key, e);
      const defaultVal = getDefaultForKey(key);
      return defaultVal;
    }
  }

  async setItem(key, value) {
    try {
      const stringified = safeJsonStringify(value);
      if (stringified !== null) {
        await this.asyncStorage.setItem(key, stringified);
      }
    } catch (e) {
      console.error("[KeyValueStorage Shim] setItem error:", key, e);
    }
  }

  async removeItem(key) {
    try {
      await this.asyncStorage.removeItem(key);
    } catch (e) {
      console.error("[KeyValueStorage Shim] removeItem error:", key, e);
    }
  }
}

export { KeyValueStorage };
export default KeyValueStorage;
