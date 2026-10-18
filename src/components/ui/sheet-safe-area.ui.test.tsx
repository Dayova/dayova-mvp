import { expect, jest, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";
import {
	SheetSafeAreaProvider,
	useSheetSafeAreaInsets,
} from "./sheet-safe-area";

jest.mock("react-native-safe-area-context", () =>
	jest.requireActual("react-native-safe-area-context"),
);

function InsetsProbe() {
	return <Text>{useSheetSafeAreaInsets().bottom}</Text>;
}

test("uses the screen inset even when a tab contributes a larger local inset", async () => {
	const screen = await render(
		<SafeAreaInsetsContext.Provider
			value={{ top: 59, bottom: 34, left: 0, right: 0 }}
		>
			<SheetSafeAreaProvider>
				<SafeAreaInsetsContext.Provider
					value={{ top: 59, bottom: 83, left: 0, right: 0 }}
				>
					<InsetsProbe />
				</SafeAreaInsetsContext.Provider>
			</SheetSafeAreaProvider>
		</SafeAreaInsetsContext.Provider>,
	);
	expect(screen.getByText("34")).toBeOnTheScreen();
});

test("works in standalone native previews without the app provider", async () => {
	const screen = await render(
		<SafeAreaInsetsContext.Provider
			value={{ top: 24, bottom: 24, left: 0, right: 0 }}
		>
			<InsetsProbe />
		</SafeAreaInsetsContext.Provider>,
	);
	expect(screen.getByText("24")).toBeOnTheScreen();
});
