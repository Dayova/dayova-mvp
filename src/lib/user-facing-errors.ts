import { logDiagnosticError } from "./diagnostics";

export const USER_FACING_ERROR_KIND = "userFacing";

const CONVEX_WRAPPER_PATTERN = /^\[CONVEX[^\n]*\]\s*/i;
const PRODUCTION_CONVEX_NOISE = new Set([
	"called by client",
	"server error",
	"server error called by client",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const normalizeDiagnosticText = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLowerCase();

const getErrorData = (error: unknown) =>
	isRecord(error) && "data" in error ? error.data : null;

const getExplicitUserFacingMessage = (error: unknown) => {
	const data = getErrorData(error);
	if (
		isRecord(data) &&
		data.kind === USER_FACING_ERROR_KIND &&
		typeof data.message === "string"
	) {
		return data.message.trim() || null;
	}

	return null;
};

const getDevelopmentConvexMessage = (message: string) => {
	const uncaughtErrorMatch =
		/Uncaught (?:Error|ConvexError):\s*([\s\S]*?)(?:\n\s*at |\n\s*Called by client|$)/.exec(
			message,
		);
	if (!uncaughtErrorMatch?.[1]) return null;

	const cleaned = uncaughtErrorMatch[1].trim();
	return cleaned || null;
};

const cleanPlainMessage = (message: string) => {
	const cleaned = message
		.replace(CONVEX_WRAPPER_PATTERN, "")
		.replace(/^Server Error\s*/i, "")
		.trim();
	if (!cleaned) return null;

	const normalized = normalizeDiagnosticText(cleaned);
	if (PRODUCTION_CONVEX_NOISE.has(normalized)) return null;
	if (
		normalized.includes("[convex") ||
		normalized.includes("called by client")
	) {
		return null;
	}

	return cleaned;
};

export const extractUserFacingErrorMessage = (error: unknown) => {
	const explicitMessage = getExplicitUserFacingMessage(error);
	if (explicitMessage) return explicitMessage;

	if (!(error instanceof Error)) return null;

	return (
		getDevelopmentConvexMessage(error.message) ??
		cleanPlainMessage(error.message)
	);
};

export const getUserFacingErrorMessage = (
	error: unknown,
	fallback: string,
	options: {
		source?: string;
		metadata?: Record<string, unknown>;
		log?: boolean;
	} = {},
) => {
	if (options.log !== false) {
		logDiagnosticError("Handled user-visible error", error, {
			source: options.source,
			metadata: options.metadata,
			level: getExplicitUserFacingMessage(error) ? "warn" : "error",
		});
	}

	return extractUserFacingErrorMessage(error) ?? fallback;
};
