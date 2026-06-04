export type DiagnosticLevel = "info" | "warn" | "error";

export type DiagnosticEvent = {
	level: DiagnosticLevel;
	message: string;
	source?: string;
	error?: unknown;
	metadata?: Record<string, unknown>;
	timestamp: string;
};

export type DiagnosticSink = (event: DiagnosticEvent) => void;

const serializeError = (error: unknown) => {
	if (!(error instanceof Error)) return error;

	return {
		name: error.name,
		message: error.message,
		stack: error.stack,
		...("data" in error ? { data: error.data } : {}),
	};
};

const defaultSink: DiagnosticSink = (event) => {
	const payload = {
		source: event.source,
		error: serializeError(event.error),
		metadata: event.metadata,
		timestamp: event.timestamp,
	};
	const prefix = event.source
		? `[Dayova:${event.source}] ${event.message}`
		: `[Dayova] ${event.message}`;

	if (event.level === "error") {
		console.error(prefix, payload);
		return;
	}

	if (event.level === "warn") {
		console.warn(prefix, payload);
		return;
	}

	console.log(prefix, payload);
};

let diagnosticSink: DiagnosticSink = defaultSink;

export const setDiagnosticSink = (sink: DiagnosticSink) => {
	const previousSink = diagnosticSink;
	diagnosticSink = sink;

	return () => {
		diagnosticSink = previousSink;
	};
};

const logDiagnosticEvent = (event: Omit<DiagnosticEvent, "timestamp">) => {
	diagnosticSink({
		...event,
		timestamp: new Date().toISOString(),
	});
};

export const logDiagnosticError = (
	message: string,
	error: unknown,
	options: {
		source?: string;
		metadata?: Record<string, unknown>;
		level?: Extract<DiagnosticLevel, "warn" | "error">;
	} = {},
) => {
	logDiagnosticEvent({
		level: options.level ?? "error",
		message,
		source: options.source,
		error,
		metadata: options.metadata,
	});
};
