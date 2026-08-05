import { describe, expect, jest, test } from "@jest/globals";
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
const mockUseMutation = jest.fn(
	(_reference: unknown) => mockEnsureSessionContent,
);

jest.mock("convex/react", () => ({
	useMutation: (reference: unknown) => mockUseMutation(reference),
}));

jest.mock("#convex/_generated/api", () => ({
	api: {
		learningSessionContent: {
			ensureSessionContent: "fastEnsureSessionContent",
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
	test("uses the immediate Convex mutation once when the session opens", async () => {
		mockEnsureSessionContent.mockResolvedValue({ itemCount: 4 });
		const onError = jest.fn();

		const screen = await render(<PreparationProbe enabled onError={onError} />);

		await waitFor(() => {
			expect(mockUseMutation).toHaveBeenCalledWith("fastEnsureSessionContent");
			expect(mockEnsureSessionContent).toHaveBeenCalledWith({
				sessionId: "session_1",
			});
		});
		expect(mockEnsureSessionContent).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();

		await screen.rerender(<PreparationProbe enabled onError={onError} />);
		expect(mockEnsureSessionContent).toHaveBeenCalledTimes(1);
	});
});
