const { AndroidConfig, withAndroidStyles } = require("expo/config-plugins");

const DAYOVA_PRIMARY_RESOURCE = "@color/colorPrimary";
const DAYOVA_CONTROL_COLOR_ITEMS = [
	"colorAccent",
	"android:colorAccent",
	"colorControlActivated",
	"android:colorControlActivated",
];

function applyDayovaAndroidStyles(styles) {
	let nextStyles = styles;
	for (const name of DAYOVA_CONTROL_COLOR_ITEMS) {
		nextStyles = AndroidConfig.Styles.assignStylesValue(nextStyles, {
			add: true,
			parent: AndroidConfig.Styles.getAppThemeGroup(),
			name,
			value: DAYOVA_PRIMARY_RESOURCE,
		});
	}
	return nextStyles;
}

module.exports = function withDayovaAndroidTheme(config) {
	return withAndroidStyles(config, (config) => {
		config.modResults = applyDayovaAndroidStyles(config.modResults);
		return config;
	});
};

module.exports.applyDayovaAndroidStyles = applyDayovaAndroidStyles;
