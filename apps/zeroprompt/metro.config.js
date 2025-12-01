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
  // Force Coinbase SDK to resolve to our empty shim
  "@coinbase/wallet-sdk": path.resolve(projectRoot, "shims/empty-module.js"),
};

// Block problematic module bundles
config.resolver.blockList = [
  /node_modules\/@wagmi\/connectors\/dist\/esm\/exports\/index\.bundle.*/,
];

// Configure transformer for better compatibility
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
