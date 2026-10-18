import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, within } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { RunningUpdateInstallation } from "~/lib/running-update-installation";
import { ReleaseInformationSheet } from "./release-information-sheet";

const mockInstallation =
	jest.fn<() => Promise<RunningUpdateInstallation | null>>();

jest.mock("~/lib/running-update-installation", () => ({
	getRunningUpdateInstallation: () => mockInstallation(),
}));
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { text: "#1A1A1A" } }),
}));
jest.mock("expo-application", () => ({
	nativeApplicationVersion: "1.0.6",
	nativeBuildVersion: "42",
}));
jest.mock("expo-updates", () => ({
	isEnabled: true,
	isEmbeddedLaunch: false,
	updateId: "running-ota",
}));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		children,
	}: {
		visible: boolean;
		children: ReactNode;
	}) => (visible ? children : null),
}));

describe("ReleaseInformationSheet", () => {
	beforeEach(() => {
		mockInstallation.mockReset();
	});

	test("shows the local date and time and explains first-launch tracking", async () => {
		const date = new Date(2026, 9, 18, 14, 35);
		mockInstallation.mockResolvedValue({ date, kind: "first-launch" });
		const screen = await render(
			<ReleaseInformationSheet visible onClose={() => {}} />,
		);
		expect(await screen.findByText("18.10.2026, 14:35")).toBeOnTheScreen();
		expect(screen.getByText("Letztes Update installiert")).toBeOnTheScreen();
		expect(
			screen.getByText("Erster Start mit diesem Update auf diesem Gerät."),
		).toBeOnTheScreen();
		expect(screen.getByText("running-ota")).toBeOnTheScreen();
	});

	test("shows a native installation date without the first-launch explanation", async () => {
		mockInstallation.mockResolvedValue({
			date: new Date(2026, 9, 16, 9, 10),
			kind: "installation",
		});
		const screen = await render(
			<ReleaseInformationSheet visible onClose={() => {}} />,
		);
		expect(await screen.findByText("16.10.2026, 09:10")).toBeOnTheScreen();
		expect(
			screen.queryByText("Erster Start mit diesem Update auf diesem Gerät."),
		).toBeNull();
	});

	test("shows an explicit unavailable state when the date is unknown", async () => {
		mockInstallation.mockResolvedValue(null);
		const screen = await render(
			<ReleaseInformationSheet visible onClose={() => {}} />,
		);
		const row = screen.getByText("Letztes Update installiert").parent;
		expect(row).not.toBeNull();
		if (row) expect(within(row).getByText("Nicht verfügbar")).toBeOnTheScreen();
	});
});
