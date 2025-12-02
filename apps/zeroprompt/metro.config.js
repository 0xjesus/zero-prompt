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
  "@noble/hashes": path.resolve(projectRoot, "node_modules/@noble/hashes"),
  "@noble/curves": path.resolve(projectRoot, "node_modules/@noble/curves"),
  "expo-linear-gradient": path.resolve(workspaceRoot, "node_modules/expo-linear-gradient"),
  "@phosphor-icons/webcomponents": path.resolve(workspaceRoot, "node_modules/@phosphor-icons/webcomponents"),
  // Force problematic SDKs to resolve to our empty shim
  "@coinbase/wallet-sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "@metamask/sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "porto": path.resolve(projectRoot, "shims/porto/index.js"),
  "porto/internal": path.resolve(projectRoot, "shims/porto/internal.js"),
};

// Block problematic module bundles
config.resolver.blockList = [
  /node_modules\/@wagmi\/connectors\/dist\/esm\/exports\/index\.bundle.*/,
];

// Custom resolver to redirect problematic modules to shims
const shimmedModules = {
  "@metamask/sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "@coinbase/wallet-sdk": path.resolve(projectRoot, "shims/empty-module.js"),
  "porto": path.resolve(projectRoot, "shims/porto/index.js"),
  "porto/internal": path.resolve(projectRoot, "shims/porto/internal.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
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
