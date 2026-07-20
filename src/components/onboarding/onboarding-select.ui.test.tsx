import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { OnboardingSelect } from "./onboarding-select";

jest.mock("~/components/ui/select-sheet", () => {
	const ReactNative =
		jest.requireActual<typeof import("react-native")>("react-native");

	return {
		SelectSheet: ({
			visible,
			title,
			options,
			formatOptionLabel,
			onSelect,
			onClose,
		}: {
			visible: boolean;
			title: string;
			options: readonly string[];
			formatOptionLabel?: (value: string) => string;
			onSelect: (value: string) => void;
			onClose: () => void;
		}) =>
			visible ? (
				<ReactNative.View accessibilityLabel={title} accessibilityViewIsModal>
					{options.map((option) => {
						const label = formatOptionLabel?.(option) ?? option;
						return (
							<ReactNative.Pressable
								key={option}
								accessibilityLabel={label}
								accessibilityRole="radio"
								onPress={() => {
									onSelect(option);
									onClose();
								}}
							>
								<ReactNative.Text>{label}</ReactNative.Text>
							</ReactNative.Pressable>
						);
					})}
				</ReactNative.View>
			) : null,
	};
});

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		ChevronDown: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
	};
});

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { secondaryText: "#697586" } }),
}));

describe("OnboardingSelect", () => {
	test("opens the matching Dayova selection sheet and exposes expanded state", async () => {
		const onChange = jest.fn();
		const screen = await render(
			<OnboardingSelect
				accessibilityLabel="Klassenstufe auswählen"
				formatLabel={(grade) => `${grade}. Klasse`}
				onChange={onChange}
				options={["8", "9", "10"]}
				testID="onboarding-grade-picker"
				title="Klassenstufe auswählen"
				value="9"
			/>,
		);

		const trigger = screen.getByRole("button", {
			name: "Klassenstufe auswählen",
		});
		expect(trigger.props.accessibilityState).toEqual({ expanded: false });
		expect(screen.getByText("9. Klasse").props.className).toContain(
			"text-center",
		);

		await fireEvent.press(trigger);

		expect(trigger.props.accessibilityState).toEqual({ expanded: true });
		expect(
			screen
				.getAllByLabelText("Klassenstufe auswählen")
				.some((element) => element.props.accessibilityViewIsModal === true),
		).toBe(true);

		await fireEvent.press(screen.getByRole("radio", { name: "10. Klasse" }));

		expect(onChange).toHaveBeenCalledWith("10");
		expect(trigger.props.accessibilityState).toEqual({ expanded: false });
	});
});
