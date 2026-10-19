import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { SuccessConfirmationScreen } from "./success-confirmation-screen";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
	__esModule: true,
	default: () => ({ fontScale: 1, height: 568, scale: 3, width: 393 }),
}));

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Check: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
	};
});

describe("SuccessConfirmationScreen", () => {
	test("shows the saved result and lets the learner finish", async () => {
		const onFinish = jest.fn();
		const screen = await render(
			<SuccessConfirmationScreen
				title="Dein Lernplan wurde erfolgreich aktualisiert"
				detailLabel="Die Änderungen sind gespeichert."
				detailValue="Mathematik · Lineare Funktionen"
				description="Du kannst jetzt mit deinem aktualisierten Lernplan fortfahren."
				onFinish={onFinish}
			/>,
		);
		expect(
			screen.getByText("Die Änderungen sind gespeichert."),
		).toBeOnTheScreen();
		expect(
			screen.getByText("Mathematik · Lineare Funktionen"),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Fertig" }));
		expect(onFinish).toHaveBeenCalledTimes(1);
	});
});
