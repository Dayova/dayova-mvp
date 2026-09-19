import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { MaterialCard } from "./learning-plan-ui";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Native =
		jest.requireActual<typeof import("react-native")>("react-native");
	return {
		Attachment: (props: Record<string, unknown>) =>
			React.createElement(Native.View, props),
		X: (props: Record<string, unknown>) =>
			React.createElement(Native.View, props),
	};
});

jest.mock("~/components/ui/portrait-content", () => ({
	useContentSizeLayout: () => ({ shouldStackInlineContent: false }),
}));

jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({ colors: { destructive: "#E5484D" } }),
}));

describe("MaterialCard retry", () => {
	test("gates rapid presses synchronously and exposes per-action busy state", async () => {
		let resolveRetry = () => {};
		const onRetry = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveRetry = resolve;
				}),
		);
		const onRemove = jest.fn();
		const screen = await render(
			<MaterialCard
				name="Arbeitsblatt.pdf"
				onRemove={onRemove}
				onRetry={onRetry}
				size={1_024}
				status="failed"
			/>,
		);
		const retryButton = screen.getByRole("button", {
			name: "Arbeitsblatt.pdf erneut verarbeiten",
		});

		await fireEvent.press(retryButton);
		await fireEvent.press(retryButton);
		expect(onRetry).toHaveBeenCalledTimes(1);
		resolveRetry();
		await Promise.resolve();

		await screen.rerender(
			<MaterialCard
				isRetrying
				name="Arbeitsblatt.pdf"
				onRemove={onRemove}
				onRetry={onRetry}
				size={1_024}
				status="failed"
			/>,
		);
		expect(
			screen.getByRole("button", {
				name: "Arbeitsblatt.pdf erneut verarbeiten",
			}).props.accessibilityState,
		).toEqual({ busy: true, disabled: true });

		await screen.rerender(
			<MaterialCard
				name="Arbeitsblatt.pdf"
				onRemove={onRemove}
				onRetry={onRetry}
				size={1_024}
				status="failed"
			/>,
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Arbeitsblatt.pdf erneut verarbeiten",
			}),
		);
		expect(onRetry).toHaveBeenCalledTimes(2);
		resolveRetry();
		await Promise.resolve();
	});
});
