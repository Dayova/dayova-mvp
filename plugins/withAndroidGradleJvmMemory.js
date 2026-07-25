const { withGradleProperties } = require("expo/config-plugins");

const GRADLE_JVM_ARGS_PROPERTY = "org.gradle.jvmargs";
const DAYOVA_GRADLE_JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

function applyAndroidGradleJvmMemory(properties) {
	const existingProperty = properties.find(
		(property) =>
			property.type === "property" && property.key === GRADLE_JVM_ARGS_PROPERTY,
	);

	if (existingProperty) {
		existingProperty.value = DAYOVA_GRADLE_JVM_ARGS;
	} else {
		properties.push({
			type: "property",
			key: GRADLE_JVM_ARGS_PROPERTY,
			value: DAYOVA_GRADLE_JVM_ARGS,
		});
	}

	return properties;
}

module.exports = function withAndroidGradleJvmMemory(config) {
	return withGradleProperties(config, (config) => {
		config.modResults = applyAndroidGradleJvmMemory(config.modResults);
		return config;
	});
};

module.exports.applyAndroidGradleJvmMemory = applyAndroidGradleJvmMemory;
module.exports.DAYOVA_GRADLE_JVM_ARGS = DAYOVA_GRADLE_JVM_ARGS;
