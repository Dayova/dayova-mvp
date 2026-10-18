import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("hairline border class merging", () => {
	test("keeps the answer card border when selection changes its color", () => {
		const base =
			"rounded-[24px] border-border border-hairline bg-card shadow-black/5 shadow-sm";

		for (const selected of [false, true, false, true]) {
			const classes = cn(
				base,
				selected && "border-primary bg-system-subtle",
			).split(" ");

			expect(classes).toContain("border-hairline");
			expect(classes).toContain(selected ? "border-primary" : "border-border");
			expect(classes).toContain("rounded-[24px]");
			expect(classes).not.toContain(
				selected ? "border-border" : "border-primary",
			);
		}
	});

	test("still resolves competing border widths", () => {
		expect(cn("border-hairline border-primary", "border-2")).toBe(
			"border-primary border-2",
		);
		expect(cn("border-2 border-primary", "border-hairline")).toBe(
			"border-primary border-hairline",
		);
	});
});
