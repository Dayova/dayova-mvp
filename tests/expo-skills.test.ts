// @vitest-environment node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("accepts the installed Expo catalog through the composition validator", () => {
	const result = spawnSync(
		process.execPath,
		[
			fileURLToPath(
				new URL("../scripts/update-expo-skills.mjs", import.meta.url),
			),
			"--validate-current",
		],
		{ cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" },
	);
	expect(result.error).toBeUndefined();
	expect(result.status, result.stdout + result.stderr).toBe(0);
});
