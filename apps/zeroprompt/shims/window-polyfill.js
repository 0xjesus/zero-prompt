// Window polyfill for React Native
// This must be imported before any WalletConnect/Web3 packages

import { Platform } from "react-native";

if (Platform.OS !== "web") {
  // Create a minimal window object if it doesn't exist
  if (typeof window === "undefined") {
    global.window = global;
  }

  // Polyfill addEventListener/removeEventListener
  if (typeof window.addEventListener === "undefined") {
    const eventListeners = {};

    window.addEventListener = (event, callback, options) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(callback);
    };

    window.removeEventListener = (event, callback, options) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
      }
    };

    window.dispatchEvent = (event) => {
      const eventName = event.type || event;
      if (eventListeners[eventName]) {
        eventListeners[eventName].forEach(cb => {
          try {
            cb(event);
          } catch (e) {
            console.warn("[window-polyfill] Event handler error:", e);
          }
        });
      }
      return true;
    };
  }

  // Polyfill localStorage with a no-op implementation
  if (typeof window.localStorage === "undefined") {
    const storage = {};
    window.localStorage = {
      getItem: (key) => storage[key] || null,
      setItem: (key, value) => { storage[key] = String(value); },
      removeItem: (key) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      key: (index) => Object.keys(storage)[index] || null,
      get length() { return Object.keys(storage).length; }
    };
  }

  // Polyfill document if needed
  if (typeof document === "undefined") {
    global.document = {
      createElement: () => ({}),
      addEventListener: window.addEventListener,
      removeEventListener: window.removeEventListener,
    };
  }

  console.log("[window-polyfill] React Native window polyfills applied");
}
