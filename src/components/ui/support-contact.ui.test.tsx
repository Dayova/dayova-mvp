import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Share } from "react-native";
import { SupportContact } from "./support-contact";

jest.mock("~/components/ui/icon", () => ({ ArrowLeft: () => null }));

const mockOpen = jest.fn<(url?: string) => Promise<boolean>>();
jest.mock("~/lib/open-external-url", () => ({
	openExternalUrl: (url?: string) => mockOpen(url),
}));
jest.mock("expo-application", () => ({
	nativeApplicationVersion: "1.0.5",
	nativeBuildVersion: "42",
}));
jest.mock("~/lib/runtime-config", () => ({ env: {} }));
jest.mock("~/components/ui/dayova-sheet-frame", () => ({
	DayovaSheetFrame: ({
		visible,
		children,
	}: {
		visible: boolean;
		children: ReactNode;
	}) => (visible ? children : null),
}));

beforeEach(() => {
	jest.restoreAllMocks();
	mockOpen.mockReset().mockResolvedValue(true);
});

describe("SupportContact", () => {
	test("offers the native copy/share sheet when no email app can open", async () => {
		mockOpen.mockResolvedValue(false);
		const share = jest
			.spyOn(Share, "share")
			.mockResolvedValue({ action: Share.sharedAction });
		const screen = await render(<SupportContact context="Abonnement" />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Support kontaktieren" }),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Adresse kopieren oder teilen" }),
		);
		expect(share).toHaveBeenCalledWith({ message: "kontakt@dayova.de" });
	});

	test("opens an editable email with screen and version context", async () => {
		const screen = await render(<SupportContact context="Abonnement" />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Support kontaktieren" }),
		);
		const url = new URL(mockOpen.mock.calls[0][0] ?? "");
		expect(url.protocol).toBe("mailto:");
		expect(url.pathname).toBe("kontakt@dayova.de");
		expect(url.searchParams.get("subject")).toBe("Dayova Support – Abonnement");
		expect(url.searchParams.get("body")).toContain("Bereich: Abonnement");
		expect(url.searchParams.get("body")).toContain("App-Version: 1.0.5 (42)");
		expect(screen.queryByText("kontakt@dayova.de")).toBeNull();
	});

	test("keeps the address available if the native share sheet fails", async () => {
		mockOpen.mockResolvedValue(false);
		jest
			.spyOn(Share, "share")
			.mockRejectedValue(new Error("Share unavailable"));
		const screen = await render(<SupportContact context="Abonnement" />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Support kontaktieren" }),
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Adresse kopieren oder teilen" }),
		);
		expect(screen.getByRole("alert")).toHaveTextContent(
			/Die Adresse konnte nicht geteilt werden/,
		);
		expect(screen.getByText("kontakt@dayova.de")).toBeOnTheScreen();
	});

	test("keeps a selectable address available when email and website cannot open", async () => {
		mockOpen.mockResolvedValue(false);
		const screen = await render(<SupportContact context="Abonnement" />);
		await fireEvent.press(
			screen.getByRole("button", { name: "Support kontaktieren" }),
		);
		expect(screen.getByText("kontakt@dayova.de")).toHaveProp(
			"selectable",
			true,
		);
		await fireEvent.press(
			screen.getByRole("button", { name: "Support-Webseite öffnen" }),
		);
		expect(mockOpen).toHaveBeenLastCalledWith("https://dayova.com/support");
		expect(screen.getByRole("alert")).toHaveTextContent(
			/Die Webseite konnte nicht geöffnet werden\./,
		);
		expect(screen.getByText("kontakt@dayova.de")).toBeOnTheScreen();
	});

	test("prevents duplicate drafts while the mail app is opening", async () => {
		let finish: ((opened: boolean) => void) | undefined;
		mockOpen.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const screen = await render(<SupportContact context="Abonnement" />);
		const button = screen.getByRole("button", { name: "Support kontaktieren" });
		await fireEvent.press(button);
		await fireEvent.press(button);
		expect(mockOpen).toHaveBeenCalledTimes(1);
		expect(button).toHaveProp("accessibilityState", {
			busy: true,
			disabled: true,
		});
		await act(async () => finish?.(true));
		expect(button.props.accessibilityState.busy).toBe(false);
		expect(button).toBeEnabled();
	});
});
