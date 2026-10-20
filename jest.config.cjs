module.exports = {
	preset: "jest-expo",
	maxWorkers: Number(process.env.CI_JEST_WORKERS ?? 1),
	collectCoverageFrom: ["src/**/*.tsx", "!src/**/*.ui.test.tsx"],
	coverageDirectory: ".maestro/artifacts/ci/coverage/jest",
	coverageReporters: ["text-summary", "json-summary", "lcov", "html"],
	moduleNameMapper: {
		"^@hugeicons/core-free-icons$": "<rootDir>/tests/adapters/hugeicons.cjs",
		"^#convex/(.*)$": "<rootDir>/convex/$1",
		"^\\.\\./\\.\\./modules/dayova-system-appearance$":
			"<rootDir>/tests/mocks/dayova-system-appearance.cjs",
		"^@hugeicons/core-free-icons/(.*)$":
			"<rootDir>/node_modules/@hugeicons/core-free-icons/dist/esm/$1.js",
		"^~/(.*)$": "<rootDir>/src/$1",
	},
	testRegex: "\\.ui\\.test\\.tsx$",
	transformIgnorePatterns: [
		"node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|@gorhom/.*|@hugeicons/.*|@rn-primitives/.*|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|standard-navigation|nativewind|react-native-css-interop|react-native-reanimated|react-native-safe-area-context|react-native-svg))",
	],
};
