const { execFileSync } = require("node:child_process");
const path = require("node:path");
const capture = path.join(__dirname, "capture.cjs");
const run = (...args) =>
	execFileSync(process.execPath, [capture, ...args], { stdio: "inherit" });
const quiet = (...args) =>
	execFileSync(process.execPath, [capture, ...args], { stdio: "ignore" });
const shot = (name) => run("shot", name);
const open = (...args) => quiet("open", ...args);
const search = (text) => {
	quiet("tap", "Themen suchen");
	quiet("type", text);
	quiet("hide-keyboard");
};
switch (process.argv[2]) {
	case "recovery":
		open("loading");
		run("record", "02-loading-error-retry");
		quiet("tap", "Themen suchen");
		quiet("type", "Ge");
		shot("22-short-query-keyboard");
		quiet("replace", "Gedicht");
		shot("23-loading-keyboard");
		open("retry");
		search("Gedicht");
		shot("24-provider-error");
		quiet("tap", "Erneut versuchen");
		shot("25-retry-success");
		run("stop-record", "02-loading-error-retry");
		break;
	case "provider":
		open("live");
		run("record", "03-live-provider-accounting-long-list");
		search("Gedichtsanalyse");
		shot("26-live-spelling-variant");
		open("accounting");
		search("Bilanz");
		shot("27-own-subject-catalog-gap");
		open("tax");
		quiet("scroll", "down");
		quiet("tap", "Weiter");
		quiet("tap", "Zurück");
		quiet("scroll", "down");
		shot("28-long-list-back");
		run("stop-record", "03-live-provider-accounting-long-list");
		break;
	case "limits":
		open("empty", "topics=Gedichtanalyse");
		run("record", "04-limits-stale-subject-cache");
		search("Unbekannt");
		shot("29-no-results-free-entry");
		open("after");
		search("Vektoren".repeat(15));
		shot("30-oversized-query");
		open("many");
		search("Vektor");
		shot("31-five-results-top");
		quiet("scroll", "down");
		shot("32-refine-hint-editor");
		open("stale");
		search("Alt");
		quiet("tap", "Themen suchen");
		quiet("replace", "Neu");
		quiet("hide-keyboard");
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 16000);
		shot("33-stale-response-ignored");
		open("stale", "keep=1", "subject=Mathematik");
		shot("34-subject-changed");
		open("stale", "keep=1", "subject=Deutsch");
		shot("35-subject-cache-return");
		run("stop-record", "04-limits-stale-subject-cache");
		break;
	default:
		throw new Error("Choose recovery, provider or limits");
}
