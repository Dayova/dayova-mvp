import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { PasswordVisibilityButton } from "./password-visibility-button";

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { secondaryText: "#697586" } }),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return { Eye: Icon, EyeOff: Icon };
});

describe("PasswordVisibilityButton", () => {
	test("exposes and enforces its disabled state", async () => {
		const onToggle = jest.fn();
		const screen = await render(
			<PasswordVisibilityButton
				fieldLabel="Passwort"
				visible={false}
				disabled
				onToggle={onToggle}
			/>,
		);
		const button = screen.getByRole("button", {
			name: "Passwort anzeigen",
			disabled: true,
		});

		await fireEvent.press(button);

		expect(button.props.accessibilityState).toEqual({ disabled: true });
		expect(onToggle).not.toHaveBeenCalled();
	});
});
