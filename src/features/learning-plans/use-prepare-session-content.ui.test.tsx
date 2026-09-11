import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, waitFor } from "@testing-library/react-native";
import { View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { usePrepareSessionContent } from "./use-prepare-session-content";

const mockEnsureSessionContent =
	jest.fn<
		(args: {
			sessionId: Id<"learningPlanSessions">;
		}) => Promise<{ itemCount: number }>
	>();
const mockUseAction = jest.fn(
	(_reference: unknown) => mockEnsureSessionContent,
);
const mockRequestAiConsent = jest.fn(async () => true);

jest.mock("convex/react", () => ({
	useAction: (reference: unknown) => mockUseAction(reference),
}));

jest.mock("~/context/AiConsentContext", () => ({
	useAiConsent: () => ({ requestAiConsent: mockRequestAiConsent }),
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		learningPlanAi: {
			ensureSessionContent: "qualityEnsureSessionContent",
		},
	},
}));

function PreparationProbe({
	enabled,
	onError,
}: {
	enabled: boolean;
	onError: (error: unknown) => void;
}) {
	usePrepareSessionContent({
		enabled,
		sessionId: "session_1" as Id<"learningPlanSessions">,
		onError,
	});
	return <View />;
}

describe("session content preparation", () => {
	beforeEach(() => {
		mockEnsureSessionContent.mockClear();
		mockUseAction.mockClear();
		mockRequestAiConsent.mockReset();
		mockRequestAiConsent.mockResolvedValue(true);
	});

	test("uses the quality content action once when the session opens", async () => {
		mockEnsureSessionContent.mockResolvedValue({ itemCount: 4 });
		const onError = jest.fn();

		const screen = await render(<PreparationProbe enabled onError={onError} />);

		await waitFor(() => {
			expect(mockUseAction).toHaveBeenCalledWith("qualityEnsureSessionContent");
			expect(mockRequestAiConsent).toHaveBeenCalledTimes(1);
			expect(mockEnsureSessionContent).toHaveBeenCalledWith({
				sessionId: "session_1",
			});
		});
		expect(mockEnsureSessionContent).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();

		await screen.rerender(<PreparationProbe enabled onError={onError} />);
		expect(mockEnsureSessionContent).toHaveBeenCalledTimes(1);
	});

	test("does not prepare AI content when consent is declined", async () => {
		mockRequestAiConsent.mockResolvedValue(false);
		const onError = jest.fn();

		await render(<PreparationProbe enabled onError={onError} />);

		await waitFor(() =>
			expect(mockRequestAiConsent).toHaveBeenCalledTimes(1),
		);
		expect(mockEnsureSessionContent).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});
});
