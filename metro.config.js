const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const projectRoot = __dirname;
const nodeModulesPath = path.resolve(projectRoot, "node_modules");
const pnpmStorePath = path.resolve(projectRoot, "node_modules/.pnpm");
const pnpmVirtualNodeModulesPath = path.resolve(
  projectRoot,
  "node_modules/.pnpm/node_modules"
);

config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  nodeModulesPath,
  pnpmVirtualNodeModulesPath,
];
config.watchFolders = [
  ...new Set([
    ...(config.watchFolders ?? []),
    nodeModulesPath,
    pnpmStorePath,
    pnpmVirtualNodeModulesPath,
  ]),
];

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  inlineRem: 16,
});
