import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { NotificationButton } from "./notification-button";

const mockPush = jest.fn();
const mockUseQuery = jest.fn();
let mockHasUnread = false;
let mockIsConvexAuthenticated = true;
let mockUser: { clerkId: string } | null = { clerkId: "user_123" };

jest.mock("expo-router", () => ({
	router: { push: mockPush },
}));

jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: mockIsConvexAuthenticated }),
	useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock("#convex/_generated/api", () => ({
	api: { notifications: { getUnreadSummary: "getUnreadSummary" } },
}));

jest.mock("~/context/AuthContext", () => ({
	useAuthSession: () => ({ user: mockUser }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { border: "#D0D5DD", surface: "#FFFFFF", text: "#101828" },
	}),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Bell: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
	};
});

describe("NotificationButton", () => {
	beforeEach(() => {
		mockHasUnread = false;
		mockIsConvexAuthenticated = true;
		mockUser = { clerkId: "user_123" };
		mockPush.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({ hasUnread: mockHasUnread }));
	});

	test("skips the Convex query until both Clerk and Convex are authenticated", async () => {
		mockIsConvexAuthenticated = false;
		const signedOut = await render(<NotificationButton />);

		expect(mockUseQuery).toHaveBeenLastCalledWith("getUnreadSummary", "skip");
		await act(() => signedOut.unmount());

		mockIsConvexAuthenticated = true;
		mockUser = null;
		await render(<NotificationButton />);

		expect(mockUseQuery).toHaveBeenLastCalledWith("getUnreadSummary", "skip");
	});

	test("announces unread notifications on the actionable control", async () => {
		mockHasUnread = true;

		const screen = await render(<NotificationButton />);

		expect(
			screen.getByRole("button", {
				name: "In-App-Mitteilungen öffnen, neue Mitteilungen vorhanden",
			}),
		).toBeOnTheScreen();
	});

	test("keeps the default action label without unread notifications", async () => {
		const screen = await render(<NotificationButton />);

		expect(
			screen.getByRole("button", { name: "In-App-Mitteilungen öffnen" }),
		).toBeOnTheScreen();
	});
});
