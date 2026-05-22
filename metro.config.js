const { getDefaultConfig } = require("expo/metro-config");

// NativeWind 4 / react-native-css-interop 0.2 emits an old synthetic Metro
// change-event shape that crashes Metro 0.84. This makes css-interop use its
// filesystem-backed watcher path instead.
process.env.REACT_NATIVE_IDE_LIB_PATH ??= "nativewind-file-system";

const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
	input: "./src/global.css",
	inlineRem: 16,
});
