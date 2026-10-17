import { describe, expect, test } from "@jest/globals";
import { Stack, useNavigation, useRouter } from "expo-router";
import {
	fireEvent,
	renderRouter,
	screen,
	testRouter,
	waitFor,
} from "expo-router/testing-library";
import { useState } from "react";
import { Button, Text, View } from "react-native";
import { useBackIntent } from "./navigation";

// Exercise Expo Router's real nested stacks and removal prevention. Native
// gesture delivery itself is covered by the recorded Maestro flow.
const Home = () => <Text>Home destination</Text>;

function Exam() {
	const navigation = useNavigation();
	const router = useRouter();
	const [step, setStep] = useState(2);
	const back = useBackIntent(
		true,
		() => {
			if (step > 1) setStep(step - 1);
			else router.back();
			return true;
		},
		{ allowRouteRemoval: step === 1 },
	);
	return (
		<View>
			<Text>{step === 2 ? "Subject step" : "Exam type step"}</Text>
			<Button title="Header back" onPress={back} />
			<Button title="Replace flow" onPress={() => router.replace("/")} />
			<Button
				title="Native parent back"
				onPress={() => navigation.getParent()?.goBack()}
			/>
		</View>
	);
}

async function renderCreation() {
	return renderRouter(
		{
			_layout: {
				default: () => <Stack />,
				unstable_settings: { anchor: "index" },
			},
			index: Home,
			"creation/_layout": () => <Stack />,
			"creation/index": Exam,
		},
		{ initialUrl: "/creation" },
	);
}

describe("native back protection across nested stacks", () => {
	test("permits a deliberate replacement while native back is protected", async () => {
		const result = await renderCreation();
		expect(screen.getByText("Subject step")).toBeTruthy();
		await fireEvent.press(screen.getByText("Replace flow"));
		await waitFor(() =>
			expect(screen.getByText("Home destination")).toBeTruthy(),
		);
		expect(screen.queryByText("Subject step")).toBeNull();
		expect(result.getPathname()).toBe("/");
	});

	test("protects the native parent during an internal step, then permits the first-step exit", async () => {
		const result = await renderCreation();
		expect(testRouter.canGoBack()).toBe(true);
		await fireEvent.press(screen.getByText("Native parent back"));
		expect(screen.getByText("Exam type step")).toBeTruthy();
		expect(result.getPathname()).toBe("/creation");
		await fireEvent.press(screen.getByText("Native parent back"));
		expect(screen.getByText("Home destination")).toBeTruthy();
		expect(result.getPathname()).toBe("/");
	});
});
