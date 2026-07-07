const { getDefaultConfig } = require("expo/metro-config");

// NativeWind 4 / react-native-css-interop 0.2 emits an old synthetic Metro
// change-event shape that crashes Metro 0.84. This makes css-interop use its
// filesystem-backed watcher path instead.
process.env.REACT_NATIVE_IDE_LIB_PATH ??= "nativewind-file-system";

// Release builds do not need NativeWind's long-lived Tailwind watcher. Without
// this flag, expo-updates resource generation can finish writing app.manifest
// but keep waiting on NativeWind's child Tailwind process. Android does not
// always set CONFIGURATION for that task, so EAS/production bundles are also
// treated as one-shot generation. See patches/README.md.
const nativeBuildConfiguration = process.env.CONFIGURATION;
const isDebugNativeBuild = nativeBuildConfiguration?.includes("Debug") ?? false;
const isReleaseLikeBundle =
	(nativeBuildConfiguration && !isDebugNativeBuild) ||
	process.env.EAS_BUILD === "true" ||
	process.env.NODE_ENV === "production";

if (isReleaseLikeBundle) {
	process.env.NATIVEWIND_DISABLE_WATCH ??= "true";
}

const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

config.transformer = {
	...transformer,
	babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};
config.resolver = {
	...resolver,
	assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
	sourceExts: [...resolver.sourceExts, "svg"],
};

module.exports = withNativeWind(config, {
	input: "./src/global.css",
	inlineRem: 16,
});
