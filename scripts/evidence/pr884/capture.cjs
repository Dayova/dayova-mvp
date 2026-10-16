const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn } = require("node:child_process");
const device = process.env.EVIDENCE_DEVICE || "emulator-5574";
const output =
	process.env.EVIDENCE_OUTPUT ||
	path.join(process.env.TEMP, "dayova-pr884-evidence");
fs.mkdirSync(output, { recursive: true });
function adb(...args) {
	return execFileSync("adb", ["-s", device, ...args], { encoding: "utf8" });
}
function dump() {
	adb("shell", "uiautomator", "dump", "/sdcard/pr884.xml");
	return adb("shell", "cat", "/sdcard/pr884.xml");
}
function nodes(xml) {
	return [...xml.matchAll(/<node\b([^>]+)>?/g)].map((match) =>
		Object.fromEntries(
			[...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]),
		),
	);
}
function observe() {
	const xml = dump();
	return nodes(xml);
}
function tap(label) {
	const matches = observe().filter(
		(n) => n["content-desc"] === label || n.text === label,
	);
	const target = matches.find((n) => n.clickable === "true") ?? matches[0];
	if (!target) throw new Error(`Missing visible control: ${label}`);
	if (target.enabled === "false") throw new Error(`Disabled control: ${label}`);
	const [x1, y1, x2, y2] = target.bounds.match(/\d+/g).map(Number);
	adb(
		"shell",
		"input",
		"tap",
		String(Math.round((x1 + x2) / 2)),
		String(Math.round((y1 + y2) / 2)),
	);
}
function shot(name) {
	const xml = dump();
	if (!xml.includes("PR 884 · isolierte Komponente"))
		throw new Error("Evidence component is not ready; refusing screenshot.");
	fs.writeFileSync(path.join(output, `${name}.xml`), xml);
	fs.writeFileSync(
		path.join(output, `${name}.png`),
		execFileSync("adb", ["-s", device, "exec-out", "screencap", "-p"]),
	);
	const file = path.join(output, "captures.json");
	const manifest = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
	manifest.push({
		name,
		at: new Date().toISOString(),
		device,
		context: nodes(xml)
			.filter((n) => n.text.startsWith("PR 884"))
			.map((n) => n.text),
		fontScale: adb("shell", "settings", "get", "system", "font_scale").trim(),
	});
	fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
	console.log(`Captured ${name}`);
}
async function main() {
	const [command, value, ...rest] = process.argv.slice(2);
	if (command === "open") {
		const params = new URLSearchParams({ case: value });
		for (const item of rest) {
			const split = item.indexOf("=");
			params.set(item.slice(0, split), item.slice(split + 1));
		}
		adb(
			"shell",
			"am",
			"start",
			"-a",
			"android.intent.action.VIEW",
			"-d",
			`'dayova://evidence?${params}'`,
			"com.dayova.dev",
		);
		let ready = false;
		for (let attempt = 0; attempt < 15; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 700));
			if (dump().includes(`· ${value} ·`)) {
				ready = true;
				break;
			}
		}
		if (!ready)
			throw new Error(`Evidence scenario ${value} did not become ready.`);
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.text || n["content-desc"])
					.map((n) => ({
						text: n.text,
						label: n["content-desc"],
						bounds: n.bounds,
						enabled: n.enabled,
					})),
			),
		);
	} else if (command === "shot") shot(value);
	else if (command === "tap") {
		tap(value);
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.focused === "true" || n.text || n["content-desc"])
					.map((n) => ({
						text: n.text,
						label: n["content-desc"],
						bounds: n.bounds,
						focused: n.focused,
						enabled: n.enabled,
					})),
			),
		);
	} else if (command === "type") {
		adb("shell", "input", "text", value.replace(/ /g, "%s"));
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.focused === "true")
					.map((n) => ({ text: n.text, label: n["content-desc"] })),
			),
		);
	} else if (command === "replace") {
		adb("shell", "input", "keycombination", "113", "29");
		adb("shell", "input", "text", value.replace(/ /g, "%s"));
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.focused === "true")
					.map((n) => ({ text: n.text, label: n["content-desc"] })),
			),
		);
	} else if (command === "hide-keyboard") {
		adb("shell", "input", "keyevent", "4");
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.text || n["content-desc"])
					.map((n) => ({ text: n.text, label: n["content-desc"] })),
			),
		);
	} else if (command === "scroll") {
		const sizes = [...adb("shell", "wm", "size").matchAll(/(\d+)x(\d+)/g)];
		const [, width, height] = sizes.at(-1).map(Number);
		adb(
			"shell",
			"input",
			"swipe",
			String(Math.round(width * 0.85)),
			String(Math.round(height * (value === "down" ? 0.82 : 0.3))),
			String(Math.round(width * 0.85)),
			String(Math.round(height * (value === "down" ? 0.3 : 0.82))),
			"600",
		);
		console.log(
			JSON.stringify(
				observe()
					.filter((n) => n.text || n["content-desc"])
					.map((n) => ({
						text: n.text,
						label: n["content-desc"],
						bounds: n.bounds,
					})),
			),
		);
	} else if (command === "record") {
		const log = fs.openSync(path.join(output, `${value}.log`), "w");
		const child = spawn(
			"adb",
			[
				"-s",
				device,
				"shell",
				"screenrecord",
				"--bit-rate",
				"2000000",
				"--time-limit",
				"150",
				`/sdcard/${value}.mp4`,
			],
			{ detached: true, stdio: ["ignore", log, log], windowsHide: true },
		);
		child.unref();
		console.log(`Recording ${value}; host PID ${child.pid}`);
	} else if (command === "stop-record") {
		const pid = adb("shell", "pidof", "screenrecord").trim();
		if (pid) adb("shell", "kill", "-2", pid);
		await new Promise((resolve) => setTimeout(resolve, 700));
		adb("pull", `/sdcard/${value}.mp4`, path.join(output, `${value}.mp4`));
		console.log(`Saved ${value}.mp4`);
	} else throw new Error("Unknown evidence command");
}
main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
