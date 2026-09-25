// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";

/** Valid PDF with a deliberately large, irrelevant Info dictionary. */
function pdfWithMetadata(padding: number) {
	const stream = "BT /F1 12 Tf 10 100 Td (Italian lesson text) Tj ET";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		`<< /Subject (${"x".repeat(padding)}) >>`,
	];
	let pdf = "%PDF-1.7\n";
	const offsets = [0];
	for (const [index, object] of objects.entries()) {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const startxref = pdf.length;
	pdf += `xref\n0 7\n0000000000 65535 f \n${offsets
		.slice(1)
		.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
		.join("")}`;
	pdf += `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
	return pdf;
}

test("extracts a metadata-heavy 25 MiB PDF below the action memory budget", () => {
	const directory = mkdtempSync(join(tmpdir(), "dayova-pdf-test-"));
	try {
		const file = join(directory, "25mib.pdf");
		const target = 25 * 1024 * 1024;
		let padding = target - pdfWithMetadata(0).length;
		padding += target - pdfWithMetadata(padding).length;
		const fixture = pdfWithMetadata(padding);
		expect(Buffer.byteLength(fixture)).toBe(target);
		writeFileSync(file, fixture);
		const helper = pathToFileURL(resolve("convex/pdfText.ts")).href;
		const output = execFileSync(
			process.execPath,
			[
				"--max-old-space-size=384",
				"--input-type=module",
				"-e",
				`import {readFileSync} from 'node:fs'; import {extractPdfText} from ${JSON.stringify(helper)};
			const text = await extractPdfText(readFileSync(${JSON.stringify(file)}), 8000000);
			console.log(JSON.stringify({text, rssKiB: process.resourceUsage().maxRSS}));`,
			],
			{ encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] },
		);
		const result = JSON.parse(output.trim());
		expect(result.text).toContain("Italian lesson text");
		expect(result.rssKiB).toBeLessThan(512 * 1024);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 40000);
