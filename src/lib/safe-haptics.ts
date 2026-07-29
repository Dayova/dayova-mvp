type SelectionHapticOptions = {
	platform: string | undefined;
	selectionAsync: () => Promise<void>;
};

export const triggerSelectionHaptic = async ({
	platform,
	selectionAsync,
}: SelectionHapticOptions) => {
	if (platform !== "ios") return;
	try {
		await selectionAsync();
	} catch {
		// Haptics are an enhancement and must never interrupt navigation.
	}
};
