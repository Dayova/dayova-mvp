import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { LearningReminderOffer } from "./learning-reminder-offer";

let mockSeen = false;
let mockEnabled = true;
const mockSave = jest.fn(async (_args: unknown) => undefined);
const mockRequest = jest.fn(async () => ({ granted: true, canAskAgain: true }));
const mockPermissions = jest.fn(async () => ({
	granted: false,
	canAskAgain: true,
}));
jest.mock("convex/react", () => ({
	useQuery: () => ({
		systemNotificationsEnabled: mockEnabled,
		learningReminderOfferSeen: mockSeen,
	}),
	useMutation: () => mockSave,
}));
jest.mock("~/lib/notification-permissions", () => ({
	getNotificationsModule: () => ({
		getPermissionsAsync: mockPermissions,
		requestPermissionsAsync: mockRequest,
	}),
	hasNotificationPermission: (
		_module: unknown,
		permission: { granted: boolean },
	) => permission.granted,
}));
jest.mock("~/components/ui/confirmation-sheet", () => ({
	ConfirmationSheet: (props: {
		visible: boolean;
		onConfirm: () => void;
		onClose: () => void;
	}) => {
		const { View, Pressable, Text } =
			jest.requireActual<typeof import("react-native")>("react-native");
		return props.visible ? (
			<View>
				<Pressable onPress={props.onConfirm}>
					<Text>Aktivieren</Text>
				</Pressable>
				<Pressable onPress={props.onClose}>
					<Text>Später</Text>
				</Pressable>
			</View>
		) : null;
	},
}));
beforeEach(() => {
	jest.clearAllMocks();
	mockSeen = false;
	mockEnabled = true;
});
test("offers permission in the scheduled learning plan and persists activation", async () => {
	const screen = await render(<LearningReminderOffer />);
	await waitFor(() => expect(screen.getByText("Aktivieren")).toBeOnTheScreen());
	expect(mockRequest).not.toHaveBeenCalled();
	await fireEvent.press(screen.getByText("Aktivieren"));
	await waitFor(() =>
		expect(mockSave).toHaveBeenCalledWith({
			systemNotificationsEnabled: true,
			learningReminderOfferSeen: true,
		}),
	);
});
test("later persists dismissal without requesting system permission", async () => {
	const screen = await render(<LearningReminderOffer />);
	await waitFor(() => expect(screen.getByText("Später")).toBeOnTheScreen());
	await fireEvent.press(screen.getByText("Später"));
	expect(mockSave).toHaveBeenCalledWith({ learningReminderOfferSeen: true });
	expect(mockRequest).not.toHaveBeenCalled();
});
test.each([
	"seen",
	"disabled",
])("respects an existing %s decision", async (decision) => {
	mockSeen = decision === "seen";
	mockEnabled = decision !== "disabled";
	const screen = await render(<LearningReminderOffer />);
	expect(screen.queryByText("Aktivieren")).toBeNull();
	expect(mockPermissions).not.toHaveBeenCalled();
});
