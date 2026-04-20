const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enableSymlinks = true;

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  inlineRem: 16,
});
