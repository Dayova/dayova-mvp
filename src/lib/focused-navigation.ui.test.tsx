import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import AppLayout from "~/app/(app)/_layout";
import AnalyticsLayout from "~/app/analyse/_layout";
import TimetableLayout from "~/app/timetable/_layout";

let mockSurface = "#FFFFFF";
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { surface: mockSurface } }),
}));
const originalPlatform = Platform.OS;
afterEach(() => {
	Platform.OS = originalPlatform;
	mockSurface = "#FFFFFF";
});
jest.mock("expo-router", () => ({
	Redirect: ({ href }: { href: string }) => {
		const { Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return <Text>{href}</Text>;
	},
}));
jest.mock("expo-router/unstable-native-tabs", () => {
	const { View, Text } =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		NativeTabs: Object.assign(
			(props: Record<string, unknown>) => (
				<View testID="native-tabs" {...props} />
			),
			{
				Trigger: Object.assign(View, { Icon: () => null, Label: Text }),
			},
		),
	};
});

describe("focused app navigation", () => {
	test("offers Heute, Pläne and Einstellungen without Analyse or Mehr", async () => {
		const screen = await render(<AppLayout />);
		for (const label of ["Heute", "Pläne", "Einstellungen"])
			expect(screen.getByText(label)).toBeTruthy();
		expect(screen.queryByText("Analyse")).toBeNull();
		expect(screen.queryByText("Mehr")).toBeNull();
	});
	test("updates Android's background on the same mounted navigator before navigating", async () => {
		Platform.OS = "android";
		const screen = await render(<AppLayout />);
		const tabs = screen.getByTestId("native-tabs");
		expect(tabs.props.backgroundColor).toBe("#FFFFFF");
		mockSurface = "#1F1E24";
		await screen.rerender(<AppLayout />);
		expect(screen.getByTestId("native-tabs")).toBe(tabs);
		expect(tabs.props.backgroundColor).toBe("#1F1E24");
		mockSurface = "#FFFFFF";
		await screen.rerender(<AppLayout />);
		expect(tabs.props.backgroundColor).toBe("#FFFFFF");
	});

	test("preserves iOS's native adaptive background", async () => {
		Platform.OS = "ios";
		const screen = await render(<AppLayout />);
		expect(
			screen.getByTestId("native-tabs").props.backgroundColor,
		).toBeUndefined();
	});

	test("redirects every old analysis child route to learning plans", async () => {
		const screen = await render(<AnalyticsLayout />);
		expect(screen.getByText("/learning-plans")).toBeTruthy();
	});
	test("redirects the old timetable route to Heute", async () => {
		const screen = await render(<TimetableLayout />);
		expect(screen.getByText("/home")).toBeTruthy();
	});
});
