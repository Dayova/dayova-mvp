const { withInfoPlist } = require("expo/config-plugins");

const REMOVED_VOICE_PERMISSION_KEYS = [
	"NSMicrophoneUsageDescription",
	"NSSpeechRecognitionUsageDescription",
];

module.exports = function withRemovedVoicePermissions(config) {
	return withInfoPlist(config, (config) => {
		for (const key of REMOVED_VOICE_PERMISSION_KEYS) {
			delete config.modResults[key];
		}

		return config;
	});
};
