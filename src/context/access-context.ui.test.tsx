import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { AccessProvider } from "./AccessContext";

const mockUseQuery = jest.fn<(query: unknown, args: unknown) => unknown>(
	() => undefined,
);
const mockSession = {
	isConvexUserSynced: false,
	isSessionLoading: false,
	user: { clerkId: "user_123" },
};

jest.mock("convex/react", () => ({
	useAction: () => jest.fn(),
	useConvexAuth: () => ({ isAuthenticated: true }),
	useMutation: () => jest.fn(),
	useQuery: (query: unknown, args: unknown) => mockUseQuery(query, args),
}));

jest.mock("expo-secure-store", () => ({
	getItemAsync: jest.fn(async () => null),
	setItemAsync: jest.fn(async () => undefined),
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => mockSession,
}));

describe("AccessProvider", () => {
	beforeEach(() => {
		mockUseQuery.mockClear();
		mockSession.isConvexUserSynced = false;
	});

	test("waits for the authenticated user to be synced before querying access", async () => {
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			expect(mockUseQuery.mock.calls[0]?.[1]).toBe("skip");
		} finally {
			screen.unmount();
		}
	});

	test("queries access after the authenticated user has been synced", async () => {
		mockSession.isConvexUserSynced = true;
		const screen = await render(
			<AccessProvider>
				<Text>App</Text>
			</AccessProvider>,
		);

		try {
			expect(mockUseQuery.mock.calls[0]?.[1]).toEqual({
				now: expect.any(Number),
			});
		} finally {
			screen.unmount();
		}
	});
});
