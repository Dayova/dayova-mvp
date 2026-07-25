import { describe, expect, test } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Pressable } from "react-native";
import { ListRow } from "~/components/ui/list-row";

describe("ListRow accessibility", () => {
	test("leaves trailing controls exposed when the row is not interactive", async () => {
		const screen = await render(
			<ListRow
				label="Design"
				trailing={
					<Pressable
						accessibilityLabel="Systemdesign"
						accessibilityRole="radio"
					/>
				}
			/>,
		);

		expect(screen.toJSON()).toMatchObject({
			props: {
				accessible: false,
			},
		});
		expect(
			screen.getByRole("radio", { name: "Systemdesign" }),
		).toBeOnTheScreen();
	});
});
