let colorScheme = "light";
let beforeNextSubscription;
const listeners = new Set();

const appearanceModule = {
	addListener: (_eventName, listener) => {
		beforeNextSubscription?.();
		beforeNextSubscription = undefined;
		listeners.add(listener);

		return { remove: () => listeners.delete(listener) };
	},
	getColorScheme: () => colorScheme,
	__emit: (nextColorScheme) => {
		colorScheme = nextColorScheme;
		for (const listener of listeners) {
			listener({ colorScheme });
		}
	},
	__getSubscriberCount: () => listeners.size,
	__reset: () => {
		colorScheme = "light";
		beforeNextSubscription = undefined;
		listeners.clear();
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
