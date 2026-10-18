const { withXcodeProject } = require("expo/config-plugins");

const IN_APP_PURCHASE_CAPABILITY = "com.apple.InAppPurchase";
const STORE_KIT_FRAMEWORK = "StoreKit.framework";

function enableIosInAppPurchase(project) {
	const { uuid: targetId } = project.getFirstTarget();
	const { firstProject } = project.getFirstProject();
	let targetAttributes = firstProject.attributes.TargetAttributes[targetId];
	if (!targetAttributes) {
		targetAttributes = {};
		firstProject.attributes.TargetAttributes[targetId] = targetAttributes;
	}
	let systemCapabilities = targetAttributes.SystemCapabilities;
	if (!systemCapabilities) {
		systemCapabilities = {};
		targetAttributes.SystemCapabilities = systemCapabilities;
	}

	systemCapabilities[IN_APP_PURCHASE_CAPABILITY] = { enabled: 1 };

	if (!project.hasFile(STORE_KIT_FRAMEWORK)) {
		project.addFramework(STORE_KIT_FRAMEWORK, { target: targetId });
	}

	return project;
}

module.exports = function withIosInAppPurchase(config) {
	return withXcodeProject(config, (config) => {
		enableIosInAppPurchase(config.modResults);
		return config;
	});
};

module.exports.enableIosInAppPurchase = enableIosInAppPurchase;
module.exports.IN_APP_PURCHASE_CAPABILITY = IN_APP_PURCHASE_CAPABILITY;
module.exports.STORE_KIT_FRAMEWORK = STORE_KIT_FRAMEWORK;
