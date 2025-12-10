// Shim for @walletconnect/window-metadata on React Native
// Returns empty metadata since there's no window object

export function getWindowMetadata() {
  return {
    description: "",
    url: "",
    icons: [],
    name: "",
  };
}

export default {
  getWindowMetadata,
};
