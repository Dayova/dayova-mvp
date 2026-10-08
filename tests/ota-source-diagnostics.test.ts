// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import yaml from "yaml";

const workflow = yaml.parse(
	readFileSync(
		new URL("../.eas/workflows/ota-source-diagnostics.yml", import.meta.url),
		"utf8",
	),
);

it("verifies an input SHA against main before production dependency installation", () => {
	const verifier = workflow.jobs.verify_source;
	const diagnose = workflow.jobs.diagnose;

	expect(verifier.environment).toBeUndefined();
	expect(verifier.steps[0]).toEqual({
		uses: "eas/checkout",
		with: { ref: "refs/heads/main" },
	});
	expect(verifier.steps[1].run).toContain('git fetch origin refs/heads/main --unshallow');
	expect(verifier.steps[1].run).toContain('git cat-file -e "$source_sha^{commit}"');
	expect(verifier.steps[1].run).toContain('git merge-base --is-ancestor "$source_sha" HEAD');
	expect(verifier.steps[1].run).toContain('set-output source_sha "$source_sha"');
	expect(diagnose.needs).toEqual(["verify_source"]);
	expect(diagnose.environment).toBe("production");
	expect(diagnose.env.OTA_SOURCE_SHA).toBe("${{ needs.verify_source.outputs.source_sha }}");
	expect(diagnose.steps[0]).toEqual({
		uses: "eas/checkout",
		with: { ref: "${{ needs.verify_source.outputs.source_sha }}" },
	});
});
