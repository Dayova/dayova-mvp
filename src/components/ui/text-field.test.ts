import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const textFieldSource = readFileSync(
	resolve(testDirectory, "text-field.tsx"),
	"utf8",
);

describe("InsetTextField", () => {
	test("centers single-line inputs beside accessories", () => {
		expect(textFieldSource).toContain(
			'<View className="min-w-0 flex-1 justify-center self-stretch">',
		);
		expect(textFieldSource).toContain("multiline={false}");
		expect(textFieldSource).toContain("numberOfLines={1}");
		expect(textFieldSource).not.toContain(
			'className={cn("flex-none text-body-2", inputClassName)}',
		);
	});
});
