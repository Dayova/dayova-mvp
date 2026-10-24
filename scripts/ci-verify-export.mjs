import { readFileSync } from "node:fs";
import {
	productionExportContext,
	verifyProductionExport,
} from "./production-export.mjs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const directory = verifyProductionExport(
	process.argv[2],
	productionExportContext({
		sourceSha: process.env.CI_SOURCE_SHA,
		runtimeVersion: version,
		env: process.env,
	}),
);
console.log(
	JSON.stringify({
		status: "verified",
		sourceSha: process.env.CI_SOURCE_SHA,
		directory,
	}),
);
