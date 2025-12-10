const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Enable package exports for @reown/appkit and other packages
config.resolver.unstable_enablePackageExports = true;

// Specify condition names for exports resolution
config.resolver.unstable_conditionNames = ["browser", "import", "require", "default"];

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Disable the hierarchical lookup to prevent issues with peerDependencies
config.resolver.disableHierarchicalLookup = true;

// Extra node modules - help resolve packages that use exports
// Also provide shims for problematic packages
config.resolver.extraNodeModules = {
  // Noble crypto - MUST resolve from root for ox/viem compatibility
  "@noble/hashes": path.resolve(workspaceRoot, "node_modules/@noble/hashes"),
  "@noble/curves": path.resolve(workspaceRoot, "node_modules/@noble/curves"),
  // ox package
  "ox": path.resolve(workspaceRoot, "node_modules/ox"),
  // Expo packages
  "expo-linear-gradient": path.resolve(workspaceRoot, "node_modules/expo-linear-gradient"),
  "@phosphor-icons/webcomponents": path.resolve(workspaceRoot, "node_modules/@phosphor-icons/webcomponents"),
  "expo": path.resolve(workspaceRoot, "node_modules/expo"),
  "expo-router": path.resolve(workspaceRoot, "node_modules/expo-router"),
  "expo-linking": path.resolve(workspaceRoot, "node_modules/expo-linking"),
  "expo-constants": path.resolve(workspaceRoot, "node_modules/expo-constants"),
  "expo-status-bar": path.resolve(workspaceRoot, "node_modules/expo-status-bar"),
  "expo-splash-screen": path.resolve(workspaceRoot, "node_modules/expo-splash-screen"),
  "expo-modules-core": path.resolve(workspaceRoot, "node_modules/expo-modules-core"),
  // React packages
  "react": path.resolve(workspaceRoot, "node_modules/react"),
  "react-dom": path.resolve(workspaceRoot, "node_modules/react-dom"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
  "react-native-web": path.resolve(workspaceRoot, "node_modules/react-native-web"),
  // Web3 packages
  "thirdweb": path.resolve(workspaceRoot, "node_modules/thirdweb"),
  "viem": path.resolve(workspaceRoot, "node_modules/viem"),
  "wagmi": path.resolve(workspaceRoot, "node_modules/wagmi"),
  // Force problematic SDKs to resolve to our empty shim
  "@coinbase/wallet-sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "@metamask/sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "porto": path.resolve(projectRoot, "shims/porto/index.js"),
  "porto/internal": path.resolve(projectRoot, "shims/porto/internal.js"),
};

// Block problematic module bundles
config.resolver.blockList = [
  /node_modules\/@wagmi\/connectors\/dist\/esm\/exports\/index\.bundle.*/,
  // Fix RN 0.74.x codegen bug with DebuggingOverlay
  /node_modules\/react-native\/src\/private\/specs\/components\/DebuggingOverlayNativeComponent\.js/,
];

// Custom resolver to redirect problematic modules to shims
const shimmedModules = {
  "@metamask/sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "@coinbase/wallet-sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "porto": path.resolve(projectRoot, "shims/porto/index.js"),
  "porto/internal": path.resolve(projectRoot, "shims/porto/internal.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // On Android/iOS, apply shims for web-only packages
  if (platform === "android" || platform === "ios") {
    // NOTE: @walletconnect/keyvaluestorage is patched directly in node_modules
    // because Metro's resolver doesn't intercept the react-native entry point properly
    // Redirect wagmi to our native shim ONLY for user code (not node_modules or shims/)
    // AppKit and other libraries in node_modules need the real wagmi
    // The shims/ directory also needs real wagmi to re-export WagmiProvider
    if (moduleName === "wagmi" || moduleName.startsWith("wagmi/")) {
      const isFromNodeModules = context.originModulePath?.includes("node_modules");
      const isFromShims = context.originModulePath?.includes("/shims/");
      if (!isFromNodeModules && !isFromShims) {
        return {
          filePath: path.resolve(projectRoot, "shims/wagmi-native.ts"),
          type: "sourceFile",
        };
      }
      // Allow real wagmi for node_modules and shims/
    }
    // ALLOW @reown/appkit-*-react-native packages (they work on native)
    // Only redirect WEB-ONLY @reown packages to empty module
    if (moduleName.startsWith("@reown/") &&
        !moduleName.includes("-react-native") &&
        !moduleName.startsWith("@reown/appkit-common") &&
        !moduleName.startsWith("@reown/appkit-core") &&
        !moduleName.startsWith("@reown/appkit-ui") &&
        !moduleName.startsWith("@reown/appkit-scaffold") &&
        !moduleName.startsWith("@reown/appkit-polyfills") &&
        !moduleName.startsWith("@reown/appkit-siwe")) {
      return {
        filePath: path.resolve(projectRoot, "shims/empty-module.js"),
        type: "sourceFile",
      };
    }
    // Shim @walletconnect/window-metadata for React Native (no window object)
    if (moduleName === "@walletconnect/window-metadata" || moduleName.startsWith("@walletconnect/window-metadata/")) {
      return {
        filePath: path.resolve(projectRoot, "shims/window-metadata.js"),
        type: "sourceFile",
      };
    }
    // Shim @walletconnect/window-getters for React Native (no window/document)
    if (moduleName === "@walletconnect/window-getters" || moduleName.startsWith("@walletconnect/window-getters/")) {
      return {
        filePath: path.resolve(projectRoot, "shims/window-getters.js"),
        type: "sourceFile",
      };
    }
    // Allow ALL @walletconnect packages on native - they're needed for AppKit
    // Only shim window-metadata and window-getters (handled above)
    // The @walletconnect/react-native-compat polyfills handle the rest
    // Redirect @coinbase/wallet-mobile-sdk to empty (we don't need coinbase on mobile)
    if (moduleName === "@coinbase/wallet-mobile-sdk" || moduleName.startsWith("@coinbase/")) {
      return {
        filePath: path.resolve(projectRoot, "shims/empty-module.js"),
        type: "sourceFile",
      };
    }
  }

  // Check if this module should be shimmed
  if (shimmedModules[moduleName]) {
    return {
      filePath: shimmedModules[moduleName],
      type: "sourceFile",
    };
  }
  // Shim all @phosphor-icons/webcomponents subpath imports
  if (moduleName.startsWith("@phosphor-icons/webcomponents/")) {
    return {
      filePath: path.resolve(projectRoot, "shims/empty-module.js"),
      type: "sourceFile",
    };
  }

  // Handle expo-router entry point - resolve from root node_modules
  if (moduleName === "expo-router/entry" || moduleName.endsWith("expo-router/entry")) {
    return {
      filePath: path.resolve(workspaceRoot, "node_modules/expo-router/entry.js"),
      type: "sourceFile",
    };
  }

  // Fix RN 0.74.x DebuggingOverlay bug - return proper React component shim
  if (moduleName.includes("DebuggingOverlayNativeComponent")) {
    return {
      filePath: path.resolve(projectRoot, "shims/DebuggingOverlayShim.js"),
      type: "sourceFile",
    };
  }

  // Resolve @noble/curves and @noble/hashes subpaths from root node_modules
  if (moduleName.startsWith("@noble/curves")) {
    const subpath = moduleName.replace("@noble/curves", "");
    return context.resolveRequest(
      context,
      path.resolve(workspaceRoot, "node_modules/@noble/curves") + subpath,
      platform
    );
  }
  if (moduleName.startsWith("@noble/hashes")) {
    const subpath = moduleName.replace("@noble/hashes", "");
    return context.resolveRequest(
      context,
      path.resolve(workspaceRoot, "node_modules/@noble/hashes") + subpath,
      platform
    );
  }

  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

// Configure transformer for better compatibility
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
