import * as Haptics from "expo-haptics";

type SelectionHapticOptions = {
	platform: string | undefined;
	selectionAsync: () => Promise<void>;
};

type SuccessHapticOptions = {
	platform: string | undefined;
};

const triggerIosHaptic = async (
	platform: string | undefined,
	trigger: () => Promise<void>,
) => {
	if (platform !== "ios") return;
	try {
		await trigger();
	} catch {
		// Haptics are an enhancement and must never interrupt app behavior.
	}
};

export const triggerSelectionHaptic = async ({
	platform,
	selectionAsync,
}: SelectionHapticOptions) => triggerIosHaptic(platform, selectionAsync);

export const triggerSuccessHaptic = async ({
	platform,
}: SuccessHapticOptions) =>
	triggerIosHaptic(platform, () =>
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
	);
