import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function sanitizeMaestroArtifacts(directory, env = process.env) {
	directory = resolve(directory);
	if (
		basename(directory) !== "tests" ||
		basename(dirname(directory)) !== ".maestro"
	)
		throw new Error(
			"Redaction is restricted to a .maestro/tests artifact directory",
		);
	if (!existsSync(directory)) return { files: 0, redacted: 0, removed: 0 };
	const result = { files: 0, redacted: 0, removed: 0 };
	try {
		const values = [env.MAESTRO_CI_EMAIL, env.MAESTRO_CI_PASSWORD];
		if (values.some((value) => !value || value.length < 8))
			throw new Error(
				"Configured smoke credentials are required for artifact redaction",
			);
		const patterns = [
			...new Set(
				values.flatMap((value) => [
					value,
					JSON.stringify(value).slice(1, -1),
					encodeURIComponent(value),
					new URLSearchParams({ value }).toString().slice(6),
					Buffer.from(value).toString("base64"),
				]),
			),
		].sort((a, b) => b.length - a.length);
		const visit = (path) => {
			const stat = lstatSync(path);
			if (stat.isSymbolicLink())
				throw new Error("Artifact symlinks are not allowed");
			if (stat.isDirectory()) {
				for (const name of readdirSync(path)) visit(join(path, name));
				return;
			}
			if (!stat.isFile()) throw new Error("Unexpected artifact file type");
			result.files++;
			const bytes = readFileSync(path);
			if (!patterns.some((value) => bytes.includes(Buffer.from(value)))) return;
			let text = bytes.toString("utf8");
			if (!Buffer.from(text).equals(bytes)) {
				unlinkSync(path);
				result.removed++;
				return;
			}
			for (const value of patterns) text = text.replaceAll(value, "[redacted]");
			writeFileSync(path, text);
			if (
				patterns.some((value) =>
					readFileSync(path).includes(Buffer.from(value)),
				)
			)
				throw new Error("Artifact redaction verification failed");
			result.redacted++;
		};
		visit(directory);
		writeFileSync(join(directory, "redaction.json"), JSON.stringify(result));
		return result;
	} catch (error) {
		// An upload must never proceed with an incompletely sanitized tree.
		rmSync(directory, { recursive: true, force: true });
		throw error;
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	console.log(
		JSON.stringify(sanitizeMaestroArtifacts(join(homedir(), ".maestro/tests"))),
	);
}
