import { Buffer } from "node:buffer";

/** Synthetic 13-page worksheet: real image streams plus distinct lesson text per page. */
export function schoolMaterialPdf(
	targetBytes = 40 * 1024 * 1024,
	pageCount = 13,
) {
	const objects: Buffer[] = [];
	const add = (body: string | Buffer) => objects.push(Buffer.from(body));

	add("<< /Type /Catalog /Pages 2 0 R >>");
	add(
		`<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${4 + i * 3} 0 R`).join(" ")}] /Count ${pageCount} >>`,
	);
	add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
	for (let i = 0; i < pageCount; i++) {
		const pageId = 4 + i * 3;
		add(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> /XObject << /Im ${pageId + 2} 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
		);
		const text = `q 400 0 0 400 50 200 cm /Im Do Q\nBT /F1 16 Tf 50 780 Td (Arbeitsblatt ${i + 1}: Lineare Funktionen) Tj 0 -30 Td (y = 2x + 3. Berechne y fuer x = ${i}.) Tj ET`;
		add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
		const pixels = Buffer.alloc(1024 * 1024 * 3, 240);
		add(
			Buffer.concat([
				Buffer.from(
					`<< /Type /XObject /Subtype /Image /Width 1024 /Height 1024 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${pixels.length} >>\nstream\n`,
				),
				pixels,
				Buffer.from("\nendstream"),
			]),
		);
	}
	const chunks = [Buffer.from("%PDF-1.7\n")];
	const offsets = [0];
	let length = chunks[0].length;
	for (const [i, body] of objects.entries()) {
		offsets.push(length);
		const chunk = Buffer.concat([
			Buffer.from(`${i + 1} 0 obj\n`),
			body,
			Buffer.from("\nendobj\n"),
		]);
		chunks.push(chunk);
		length += chunk.length;
	}
	const trailer = Buffer.from(
		`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
			.slice(1)
			.map((x) => `${String(x).padStart(10, "0")} 00000 n \n`)
			.join(
				"",
			)}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`,
	);
	const padding = targetBytes - length - trailer.length;
	if (padding < 0)
		throw new Error("Target size is smaller than worksheet content");
	// Whitespace after EOF pads the exact boundary without changing the page streams.
	return Buffer.concat(
		[...chunks, trailer, Buffer.alloc(padding, 32)],
		targetBytes,
	);
}
