"use node";

/** Extract lesson text only: large PDF metadata is not needed by the AI pipeline. */
export async function extractPdfText(bytes: Uint8Array, maxChars: number) {
	const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const task = getDocument({
		// PDF.js transfers ownership; keep the original bytes for vision fallback.
		data: new Uint8Array(bytes),
		isEvalSupported: false,
		useSystemFonts: true,
		verbosity: 0,
	});
	try {
		const document = await task.promise;
		let text = "";
		for (
			let number = 1;
			number <= document.numPages && text.length < maxChars;
			number++
		) {
			const page = await document.getPage(number);
			try {
				const content = await page.getTextContent();
				for (const item of content.items) {
					if (!("str" in item)) continue;
					text += item.str.slice(0, maxChars - text.length);
					if (text.length >= maxChars) break;
					text += item.hasEOL ? "\n" : " ";
				}
				if (text.endsWith(" ")) text = text.slice(0, -1);
				if (text.length < maxChars && !text.endsWith("\n")) text += "\n";
			} finally {
				page.cleanup();
			}
		}
		return text;
	} finally {
		await task.destroy();
	}
}
