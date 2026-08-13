import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { ErrorMessage } from "./error-message";

describe("ErrorMessage accessibility", () => {
	test("announces rendered errors without requiring visual focus", async () => {
		const screen = await render(
			<ErrorMessage>Speichern fehlgeschlagen</ErrorMessage>,
		);

		const error = screen.getByRole("alert");
		expect(error).toHaveTextContent("Speichern fehlgeschlagen");
		expect(error.props.accessibilityLiveRegion).toBe("polite");
		expect(error.props.selectable).toBe(true);
	});
});
