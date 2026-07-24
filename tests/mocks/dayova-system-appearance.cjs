let colorScheme = "light";
let beforeNextSubscription;
let releaseSnapshotShieldGenerations = [];
const listeners = {
	onChange: new Set(),
	onResume: new Set(),
};

const appearanceModule = {
	addListener: (eventName, listener) => {
		if (eventName === "onChange") {
			beforeNextSubscription?.();
			beforeNextSubscription = undefined;
		}
		listeners[eventName].add(listener);

		return { remove: () => listeners[eventName].delete(listener) };
	},
	getColorScheme: () => colorScheme,
	releaseSnapshotShield: (generation) => {
		releaseSnapshotShieldGenerations.push(generation);
	},
	__emit: (nextColorScheme) => {
		colorScheme = nextColorScheme;
		for (const listener of listeners.onChange) {
			listener({ colorScheme });
		}
	},
	__emitResume: (generation) => {
		for (const listener of listeners.onResume) listener({ generation });
	},
	__getReleaseSnapshotShieldGenerations: () => [
		...releaseSnapshotShieldGenerations,
	],
	__getSubscriberCount: () => listeners.onChange.size,
	__reset: () => {
		colorScheme = "light";
		beforeNextSubscription = undefined;
		releaseSnapshotShieldGenerations = [];
		listeners.onChange.clear();
		listeners.onResume.clear();
	},
	__setBeforeNextSubscription: (nextColorScheme) => {
		beforeNextSubscription = () => {
			colorScheme = nextColorScheme;
		};
	},
};

module.exports = {
	__esModule: true,
	default: appearanceModule,
};
