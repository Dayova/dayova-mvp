import { describe, expect, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { OnboardingProvider, useOnboarding } from "./OnboardingContext";

function RouteConsumer({ routeKey }: { routeKey: string }) {
	const {
		answers,
		isRegistrationStage,
		isStepVisited,
		setAnswer,
		setRegistrationStage,
		setStepError,
		stepErrors,
		visitStep,
	} = useOnboarding();
	return (
		<View testID={`route-${routeKey}`}>
			<Text>{answers.name || "empty"}</Text>
			<Text>{stepErrors.name ?? "no-error"}</Text>
			<Text>{isStepVisited("name") ? "visited" : "not-visited"}</Text>
			<Text>
				{isRegistrationStage("verification") ? "verification" : "flow"}
			</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Populate flow"
				onPress={() => {
					setAnswer("name", "Mina");
					setStepError("name", "Bitte prüfe den Namen.");
					visitStep("name");
					setRegistrationStage("verification");
				}}
			/>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Change another answer"
				onPress={() => setAnswer("email", "mina@example.com")}
			/>
		</View>
	);
}

function RouteHost() {
	const [routeKey, setRouteKey] = useState("first");
	return (
		<OnboardingProvider>
			<RouteConsumer key={routeKey} routeKey={routeKey} />
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Replace route consumer"
				onPress={() => setRouteKey("second")}
			/>
		</OnboardingProvider>
	);
}

describe("OnboardingProvider route-independent state", () => {
	test("preserves answers, field errors, authorization and registration stage across screen unmounts", async () => {
		const screen = await render(<RouteHost />);

		await fireEvent.press(
			screen.getByRole("button", { name: "Populate flow" }),
		);
		expect(screen.getByText("Mina")).toBeOnTheScreen();
		expect(screen.getByText("Bitte prüfe den Namen.")).toBeOnTheScreen();
		expect(screen.getByText("visited")).toBeOnTheScreen();
		expect(screen.getByText("verification")).toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", { name: "Change another answer" }),
		);
		expect(screen.getByText("Bitte prüfe den Namen.")).toBeOnTheScreen();

		await fireEvent.press(
			screen.getByRole("button", { name: "Replace route consumer" }),
		);
		expect(screen.getByTestId("route-second")).toBeOnTheScreen();
		expect(screen.getByText("Mina")).toBeOnTheScreen();
		expect(screen.getByText("Bitte prüfe den Namen.")).toBeOnTheScreen();
		expect(screen.getByText("visited")).toBeOnTheScreen();
		expect(screen.getByText("verification")).toBeOnTheScreen();
	});
});
