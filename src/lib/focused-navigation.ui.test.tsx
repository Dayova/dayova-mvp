import { describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import AppLayout from "~/app/(app)/_layout";
import AnalyticsLayout from "~/app/analyse/_layout";
import TimetableLayout from "~/app/timetable/_layout";

jest.mock("~/lib/theme", () => ({ useDayovaTheme: () => ({ colors: {} }) }));
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
		NativeTabs: Object.assign(View, {
			Trigger: Object.assign(View, { Icon: () => null, Label: Text }),
		}),
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
	test("redirects every old analysis child route to learning plans", async () => {
		const screen = await render(<AnalyticsLayout />);
		expect(screen.getByText("/learning-plans")).toBeTruthy();
	});
	test("redirects the old timetable route to Heute", async () => {
		const screen = await render(<TimetableLayout />);
		expect(screen.getByText("/home")).toBeTruthy();
	});
});
