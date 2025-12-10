// Shim for @walletconnect/window-getters on React Native
// Returns null/undefined since there's no window/document in React Native

export function getDocument() {
  return undefined;
}

export function getDocumentOrThrow() {
  throw new Error("No document in React Native");
}

export function getWindow() {
  return undefined;
}

export function getWindowOrThrow() {
  throw new Error("No window in React Native");
}

export function getNavigator() {
  return undefined;
}

export function getNavigatorOrThrow() {
  throw new Error("No navigator in React Native");
}

export function getLocation() {
  return undefined;
}

export function getLocationOrThrow() {
  throw new Error("No location in React Native");
}

export function getCrypto() {
  return undefined;
}

export function getCryptoOrThrow() {
  throw new Error("No crypto in React Native");
}

export function getLocalStorage() {
  return undefined;
}

export function getLocalStorageOrThrow() {
  throw new Error("No localStorage in React Native");
}

export default {
  getDocument,
  getDocumentOrThrow,
  getWindow,
  getWindowOrThrow,
  getNavigator,
  getNavigatorOrThrow,
  getLocation,
  getLocationOrThrow,
  getCrypto,
  getCryptoOrThrow,
  getLocalStorage,
  getLocalStorageOrThrow,
};
