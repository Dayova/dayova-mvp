"use node";

import { Readable } from "node:stream";

/** Stream large SDK JSON bodies instead of allocating another full UTF-8 copy. */
export const vertexFetch: typeof fetch = async (input, init) => {
	const body = init?.body;
	if (typeof body !== "string" || body.length <= 1024 * 1024) {
		return fetch(input, init);
	}
	const stream = Readable.toWeb(
		Readable.from(
			(function* () {
				for (let offset = 0; offset < body.length; ) {
					let end = Math.min(offset + 64 * 1024, body.length);
					if (
						end < body.length &&
						body.charCodeAt(end - 1) >= 0xd800 &&
						body.charCodeAt(end - 1) <= 0xdbff
					)
						end -= 1;
					yield Buffer.from(body.slice(offset, end), "utf8");
					offset = end;
				}
			})(),
			{ objectMode: false, highWaterMark: 64 * 1024 },
		),
		{
			strategy: {
				highWaterMark: 64 * 1024,
				size: (chunk: Uint8Array) => chunk.byteLength,
			},
		},
	);

	// Node requires duplex for streaming requests. Chunk boundaries above preserve
	// Unicode surrogate pairs. Both queues use byte-based backpressure.
	const request: RequestInit & { duplex: "half" } = {
		...init,
		body: stream as ReadableStream<Uint8Array>,
		duplex: "half",
	};
	return fetch(input, request);
};
