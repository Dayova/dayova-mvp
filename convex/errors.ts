import { ConvexError } from "convex/values";

export const USER_FACING_ERROR_KIND = "userFacing";

type UserFacingBackendErrorData = {
	kind: typeof USER_FACING_ERROR_KIND;
	message: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const serializeError = (error: unknown) => {
	if (!(error instanceof Error)) return error;

	return {
		name: error.name,
		message: error.message,
		stack: error.stack,
		...("data" in error ? { data: error.data } : {}),
	};
};

export const userFacingError = (message: string) => {
	const error = new ConvexError(
		message,
	) as unknown as ConvexError<UserFacingBackendErrorData>;
	error.data = {
		kind: USER_FACING_ERROR_KIND,
		message,
	};
	return error;
};

export function throwUserFacingError(message: string): never {
	throw userFacingError(message);
}

export const getUserFacingBackendErrorMessage = (error: unknown) => {
	if (!isRecord(error) || !("data" in error) || !isRecord(error.data)) {
		return null;
	}

	return error.data.kind === USER_FACING_ERROR_KIND &&
		typeof error.data.message === "string"
		? error.data.message
		: null;
};

export const logDiagnosticError = (
	source: string,
	error: unknown,
	metadata?: Record<string, unknown>,
) => {
	console.error(`[Dayova:${source}]`, {
		error: serializeError(error),
		metadata,
		timestamp: new Date().toISOString(),
	});
};
