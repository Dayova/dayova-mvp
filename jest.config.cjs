module.exports = {
	preset: "jest-expo",
	moduleNameMapper: {
		"^#convex/(.*)$": "<rootDir>/convex/$1",
		"^~/(.*)$": "<rootDir>/src/$1",
	},
	testRegex: "\\.ui\\.test\\.tsx$",
	transformIgnorePatterns: [
		"node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|@gorhom/.*|@rn-primitives/.*|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop|react-native-reanimated|react-native-safe-area-context|react-native-svg))",
	],
};
