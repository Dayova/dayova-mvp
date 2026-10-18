import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Check captured UIAutomator bounds against the native system-bar boundaries.
const [xmlPath, target, minTop, maxBottom] = process.argv.slice(2);
const xml = readFileSync(xmlPath, "utf8");
const node = [...xml.matchAll(/<node\b[^>]*>/g)]
	.map((match) => match[0])
	.find(
		(node) =>
			node.includes(`text="${target}"`) ||
			node.includes(`content-desc="${target}"`),
	);
assert.ok(node, `Missing accessible content: ${target}`);
const match = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
assert.ok(match, `Missing bounds: ${target}`);
const bounds = match.slice(1).map(Number);
console.log(
	`${target}: bounds=${JSON.stringify(bounds)}, safe vertical interval=[${minTop},${maxBottom}]`,
);
assert.ok(
	bounds[1] >= Number(minTop),
	`Text overlaps status bar: ${bounds[1]} < ${minTop}`,
);
assert.ok(
	bounds[3] <= Number(maxBottom),
	`Text overlaps navigation bar: ${bounds[3]} > ${maxBottom}`,
);
console.log("PASS: content is inside the safe area");
