import { execFileSync } from "node:child_process";

const event = process.env.CI_EVENT_NAME;
const forced = process.env.CI_NATIVE_FORCE === "true" || event === "schedule";
let paths = [];
if (!forced && event !== "workflow_dispatch") {
	const base = process.env.CI_BASE_SHA;
	if (base && /^[a-f0-9]{40}$/.test(base) && !/^0+$/.test(base)) {
		execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", base], {
			stdio: ["ignore", "ignore", "inherit"],
		});
	} else if (process.env.CI_REF_NAME?.startsWith("gh-readonly-queue/main/")) {
		execFileSync("git", ["fetch", "--no-tags", "--depth=1", "origin", "main"], {
			stdio: ["ignore", "ignore", "inherit"],
		});
	} else {
		throw new Error(
			"A native-scope decision requires a verified comparison commit",
		);
	}
	paths = execFileSync(
		"git",
		["diff", "--name-only", "-z", "FETCH_HEAD", "HEAD"],
		{ encoding: "utf8" },
	)
		.split("\0")
		.filter(Boolean);
}
const relevant = paths.filter((path) =>
	/^(app\.config\.cts|eas\.json|package\.json|pnpm-(lock\.yaml|workspace\.yaml)|(?:plugins|modules|patches|\.maestro)\/|src\/(?:context|features\/auth)\/|\.eas\/workflows\/ci\.yml|scripts\/(?:ci-native-changes|auth-smoke)\.mjs)/.test(
		path,
	),
);
console.log(
	JSON.stringify({
		required: forced || relevant.length > 0,
		comparison: process.env.CI_BASE_SHA ?? "main",
		paths: relevant,
	}),
);
