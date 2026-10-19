const {
	withAppBuildGradle,
	withMainApplication,
} = require("expo/config-plugins");

const marker =
	"// Dayova internal validation: embedded bundle, Test Store, no Metro.";

function addValidationBuildType(contents) {
	if (contents.includes(marker)) return contents;
	return `${contents}\n${marker}
android {
    buildTypes {
        validation {
            initWith release
            matchingFallbacks = ['release']
            debuggable true
            signingConfig signingConfigs.debug
            minifyEnabled false
            shrinkResources false
        }
    }
}
`;
}

function disableValidationDeveloperSupport(contents) {
	const support =
		'useDevSupport = BuildConfig.DEBUG && BuildConfig.BUILD_TYPE != "validation",';
	if (contents.includes(support)) return contents;
	const entryPoint =
		/ExpoReactHostFactory\.getDefaultReactHost\(\s*context = applicationContext,/;
	if (!entryPoint.test(contents)) {
		throw new Error(
			"Internal validation requires the reviewed Kotlin developer-support entry point.",
		);
	}
	return contents.replace(entryPoint, (match) => `${match}\n      ${support}`);
}

function withInternalValidation(config) {
	if (config.android?.package !== "com.dayova.validation") {
		throw new Error(
			"Internal validation must use its isolated application ID.",
		);
	}
	config = withAppBuildGradle(config, (mod) => {
		if (mod.modResults.language !== "groovy")
			throw new Error("Internal validation requires Groovy app Gradle.");
		mod.modResults.contents = addValidationBuildType(mod.modResults.contents);
		return mod;
	});
	return withMainApplication(config, (mod) => {
		mod.modResults.contents = disableValidationDeveloperSupport(
			mod.modResults.contents,
		);
		return mod;
	});
}

module.exports = withInternalValidation;
module.exports.addValidationBuildType = addValidationBuildType;
module.exports.disableValidationDeveloperSupport =
	disableValidationDeveloperSupport;
