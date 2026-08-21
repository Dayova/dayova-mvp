const { withDangerousMod } = require("expo/config-plugins");
const {
	prepareAndroidGradleJvm,
} = require("../scripts/prepare-android-gradle-jvm.cjs");

module.exports = function withAndroidGradleDaemonJvm(config) {
	return withDangerousMod(config, [
		"android",
		(config) => {
			prepareAndroidGradleJvm({
				projectRoot: config.modRequest.projectRoot,
				requireNativeProject: false,
			});
			return config;
		},
	]);
};
