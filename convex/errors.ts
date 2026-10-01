import { ConvexError } from "convex/values";

export const USER_FACING_ERROR_KIND = "userFacing";

type UserFacingBackendErrorData = {
	kind: typeof USER_FACING_ERROR_KIND;
	message: string;
	code?: string;
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

export const userFacingError = (message: string, code?: string) => {
	const error = new ConvexError(
		message,
	) as unknown as ConvexError<UserFacingBackendErrorData>;
	error.data = {
		kind: USER_FACING_ERROR_KIND,
		message,
		...(code ? { code } : {}),
	};
	return error;
};

export function throwUserFacingError(message: string, code?: string): never {
	throw userFacingError(message, code);
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

export const getUserFacingBackendErrorCode = (error: unknown) => {
	if (!isRecord(error) || !("data" in error) || !isRecord(error.data)) {
		return null;
	}

	return error.data.kind === USER_FACING_ERROR_KIND &&
		typeof error.data.code === "string"
		? error.data.code
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
