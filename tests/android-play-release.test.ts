import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

type AndroidSubmitProfile = {
	android: {
		releaseStatus: "completed" | "draft";
		track: "alpha" | "beta" | "internal" | "production";
	};
};

const easConfig = JSON.parse(
	readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
) as {
	build: {
		production: {
			autoIncrement: boolean;
			channel: string;
			environment: string;
			env: { APP_VARIANT: string };
		};
	};
	submit: Record<string, AndroidSubmitProfile>;
};

const workflow = parseYaml(
	readFileSync(
		new URL("../.eas/workflows/android-play-test.yml", import.meta.url),
		"utf8",
	),
) as {
	on: {
		workflow_dispatch: {
			inputs: {
				track: {
					options: string[];
					required: boolean;
					type: string;
				};
			};
		};
	};
	jobs: Record<
		string,
		{
			needs?: string[];
			params?: Record<string, string>;
			steps?: Array<{ env?: Record<string, string>; run?: string }>;
			type: string;
		}
	>;
};

describe("Android Google Play testing releases", () => {
	it("uses one production-signed, auto-incremented build for every Play track", () => {
		expect(easConfig.build.production).toMatchObject({
			autoIncrement: true,
			channel: "production",
			environment: "production",
			env: { APP_VARIANT: "production" },
		});
	});

	it("maps the named submit profiles to the intended Google Play tracks", () => {
		expect(easConfig.submit.internal.android).toEqual({
			track: "internal",
			releaseStatus: "completed",
		});
		expect(easConfig.submit.closed.android).toEqual({
			track: "alpha",
			releaseStatus: "completed",
		});
		expect(easConfig.submit.open.android).toEqual({
			track: "beta",
			releaseStatus: "completed",
		});
		expect(easConfig.submit.production.android).toEqual({
			track: "production",
			releaseStatus: "draft",
		});
	});

	it("checks and builds before requiring approval for a closed or open submission", () => {
		expect(workflow.on.workflow_dispatch.inputs.track).toEqual({
			type: "choice",
			description: "Google Play testing track for this new release candidate",
			required: true,
			options: ["closed", "open"],
		});

		expect(workflow.jobs.checks.steps?.map((step) => step.run)).toEqual([
			undefined,
			undefined,
			"pnpm check",
			"pnpm test",
		]);
		expect(workflow.jobs.build_android).toMatchObject({
			needs: ["checks"],
			type: "build",
			params: { platform: "android", profile: "production" },
		});
		expect(workflow.jobs.approve_submission).toMatchObject({
			needs: ["review_candidate"],
			type: "require-approval",
		});
		expect(workflow.jobs.submit_android).toMatchObject({
			needs: ["build_android", "approve_submission"],
			type: "submit",
			params: {
				build_id: "${{ needs.build_android.outputs.build_id }}",
				profile: "${{ inputs.track }}",
			},
		});
	});
});
