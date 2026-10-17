import { describe, expect, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
	createNavigatorFactory,
	NavigationContainer,
	StackActions,
	StackRouter,
	useNavigation,
	useNavigationBuilder,
	usePreventRemoveContext,
} from "expo-router/react-navigation";
import { type ReactNode, useState } from "react";
import { Button, Text, View } from "react-native";
import { useBackIntent } from "./navigation";

// Exercise the real router and prevention context consumed by native-stack.
// Native gesture delivery itself is covered by the recorded Maestro flow.
function Protection({ label }: { label: string }) {
	const { preventedRoutes } = usePreventRemoveContext();
	return (
		<Text testID={label}>
			{Object.values(preventedRoutes).some((route) => route.preventRemove)
				? "protected"
				: "unprotected"}
		</Text>
	);
}

function TestNavigator({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	const { state, descriptors, NavigationContent } = useNavigationBuilder(
		StackRouter,
		{ children },
	);
	return (
		<NavigationContent>
			<Protection label={label} />
			{state.routes.map((route, index) => (
				<View
					key={route.key}
					style={{ display: index === state.index ? "flex" : "none" }}
				>
					{descriptors[route.key].render()}
				</View>
			))}
		</NavigationContent>
	);
}

const Stack = createNavigatorFactory(TestNavigator)();
const Home = () => <Text>Home destination</Text>;

function Exam() {
	const navigation = useNavigation();
	const [step, setStep] = useState(2);
	const back = useBackIntent(
		true,
		() => {
			if (step > 1) setStep(step - 1);
			else navigation.goBack();
			return true;
		},
		{ allowRouteRemoval: step === 1 },
	);
	return (
		<View>
			<Text>{step === 2 ? "Subject step" : "Exam type step"}</Text>
			<Button title="Header back" onPress={back} />
			<Button
				title="Replace flow"
				onPress={() =>
					navigation.getParent()?.dispatch(StackActions.replace("Home"))
				}
			/>
			<Button
				title="Native parent back"
				onPress={() => navigation.getParent()?.goBack()}
			/>
		</View>
	);
}

function Creation() {
	return (
		<Stack.Navigator label="child-protection">
			<Stack.Screen name="Exam" component={Exam} />
		</Stack.Navigator>
	);
}

function App() {
	return (
		<NavigationContainer
			initialState={{
				index: 1,
				routes: [{ name: "Home" }, { name: "Creation" }],
			}}
		>
			<Stack.Navigator label="parent-protection">
				<Stack.Screen name="Home" component={Home} />
				<Stack.Screen name="Creation" component={Creation} />
			</Stack.Navigator>
		</NavigationContainer>
	);
}

describe("native back protection across nested stacks", () => {
	test("permits a deliberate replacement while native back is protected", async () => {
		await render(<App />);
		await fireEvent.press(screen.getByText("Replace flow"));
		expect(screen.getByText("Home destination")).toBeTruthy();
		expect(screen.queryByText("Subject step")).toBeNull();
	});

	test("protects the native parent during an internal step, then permits the first-step exit", async () => {
		await render(<App />);
		expect(screen.getByTestId("parent-protection").props.children).toBe(
			"protected",
		);
		await fireEvent.press(screen.getByText("Native parent back"));
		expect(screen.getByText("Exam type step")).toBeTruthy();
		expect(screen.queryByText("Home destination")).toBeNull();
		expect(screen.getByTestId("parent-protection").props.children).toBe(
			"unprotected",
		);
		await fireEvent.press(screen.getByText("Native parent back"));
		expect(screen.getByText("Home destination")).toBeTruthy();
	});
});
