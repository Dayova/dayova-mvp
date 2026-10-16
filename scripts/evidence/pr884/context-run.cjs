const { execFileSync } = require("node:child_process");
const path = require("node:path");
const capture = path.join(__dirname, "capture.cjs");
const run = (...args) =>
	execFileSync(process.execPath, [capture, ...args], {
		stdio: "inherit",
		timeout: 60_000,
	});
const quiet = (...args) =>
	execFileSync(process.execPath, [capture, ...args], {
		stdio: "ignore",
		timeout: 60_000,
	});
function scene(name, subject, query, output, extra = []) {
	quiet("open", name, `subject=${subject}`, "topics=Inventur", ...extra);
	quiet("tap", "Themen suchen");
	quiet("type", query);
	quiet("hide-keyboard");
	run("shot", output);
}
run("record", "context-accounting");
try {
	scene("live", "Rechnungswesen", "Bilanz", "41-personal-accounting-results");
	quiet("tap", "Bilanz zur Themenliste hinzufügen");
	quiet("scroll", "down");
	run("shot", "42-accounting-append");
	scene("live", "Mathematik", "Bilanz", "43-legacy-maths-additional");
	scene("live", "Mein Spezialfach", "Bilanz", "44-unknown-subject-results");
} finally {
	run("stop-record", "context-accounting");
}
scene("live", "Mathe LK", "Vektor", "45-course-name-results");
scene("live", "Wirtschaft und Recht", "Bilanz", "46-combined-subject-results");
scene("controlled-context", "Bio LK", "Zelle", "47-controlled-ambiguity");
scene("live", "Rechnungswesen", "Bilanz", "48-context-dark", ["theme=dark"]);
