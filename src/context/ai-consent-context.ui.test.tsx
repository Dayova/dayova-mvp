import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { AI_CONSENT_VERSION, type AiConsentSnapshot } from "~/lib/ai-consent";
import { AiConsentProvider, useAiConsent } from "./AiConsentContext";

const emptySnapshot: AiConsentSnapshot = {
	status: "notSet",
	version: null,
	updatedAt: null,
	grantedAt: null,
	hasCurrentConsent: false,
};
const grantedSnapshot: AiConsentSnapshot = {
	status: "granted",
	version: AI_CONSENT_VERSION,
	updatedAt: 10,
	grantedAt: 10,
	hasCurrentConsent: true,
};

let mockSnapshot: AiConsentSnapshot | undefined = emptySnapshot;
const mockSetDecision = jest.fn(async () => grantedSnapshot);
const mockWithdraw = jest.fn(async () => ({
	...grantedSnapshot,
	status: "withdrawn" as const,
	hasCurrentConsent: false,
	updatedAt: 20,
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true }),
	useQuery: () => mockSnapshot,
	useMutation: (reference: string) =>
		reference === "setDecision" ? mockSetDecision : mockWithdraw,
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		aiConsent: {
			getMine: "getMine",
			setDecision: "setDecision",
			withdraw: "withdraw",
		},
	},
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({
		user: { clerkId: "user_1" },
		isConvexUserSynced: true,
	}),
}));

jest.mock("~/features/privacy/ai-consent-sheet", () => ({
	AiConsentSheet: (() => {
		const React = jest.requireActual<typeof import("react")>("react");
		const Native =
			jest.requireActual<typeof import("react-native")>("react-native");
		return ({
			visible,
			onAccept,
			onDecline,
			onWithdraw,
		}: {
			visible: boolean;
			onAccept: () => void;
			onDecline: () => void;
			onWithdraw: () => void;
		}) =>
			visible
				? React.createElement(
						Native.View,
						null,
						React.createElement(
							Native.Pressable,
							{ accessibilityRole: "button", onPress: onAccept },
							React.createElement(Native.Text, null, "Accept"),
						),
						React.createElement(
							Native.Pressable,
							{ accessibilityRole: "button", onPress: onDecline },
							React.createElement(Native.Text, null, "Decline"),
						),
						React.createElement(
							Native.Pressable,
							{ accessibilityRole: "button", onPress: onWithdraw },
							React.createElement(Native.Text, null, "Withdraw"),
						),
					)
				: null;
	})(),
}));

jest.mock("~/lib/open-external-url", () => ({
	openExternalUrl: jest.fn(async () => true),
}));

jest.mock("~/lib/runtime-config", () => ({
	env: { EXPO_PUBLIC_PRIVACY_URL: "https://example.com/privacy" },
}));

function ConsentProbe() {
	const { requestAiConsent } = useAiConsent();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => {
				void requestAiConsent().then((allowed) => {
					mockResult = allowed ? "allowed" : "blocked";
				});
			}}
		>
			<Text>Request AI</Text>
		</Pressable>
	);
}

let mockResult = "pending";

describe("AiConsentProvider", () => {
	beforeEach(() => {
		mockSnapshot = emptySnapshot;
		mockResult = "pending";
		mockSetDecision.mockClear();
		mockWithdraw.mockClear();
	});

	test("waits for an explicit acceptance before allowing an AI action", async () => {
		const screen = await render(
			<AiConsentProvider>
				<ConsentProbe />
			</AiConsentProvider>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Request AI" }));
		expect(mockResult).toBe("pending");
		await fireEvent.press(
			await screen.findByRole("button", { name: "Accept" }),
		);

		await waitFor(() => expect(mockResult).toBe("allowed"));
		expect(mockSetDecision).toHaveBeenCalledWith({
			decision: "granted",
			version: AI_CONSENT_VERSION,
		});
	});

	test("blocks the AI action when the user declines", async () => {
		const screen = await render(
			<AiConsentProvider>
				<ConsentProbe />
			</AiConsentProvider>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Request AI" }));
		await fireEvent.press(
			await screen.findByRole("button", { name: "Decline" }),
		);

		await waitFor(() => expect(mockResult).toBe("blocked"));
	});

	test("does not interrupt users who already granted the current version", async () => {
		mockSnapshot = grantedSnapshot;
		const screen = await render(
			<AiConsentProvider>
				<ConsentProbe />
			</AiConsentProvider>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Request AI" }));

		await waitFor(() => expect(mockResult).toBe("allowed"));
		expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
	});
});
