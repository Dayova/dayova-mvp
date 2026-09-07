import { ConvexError } from "convex/values";
import {
	USER_FACING_ERROR_KIND,
	type UserFacingErrorCode,
} from "../src/lib/user-facing-error-contract";

export { USER_FACING_ERROR_KIND } from "../src/lib/user-facing-error-contract";

type UserFacingBackendErrorData = {
	kind: typeof USER_FACING_ERROR_KIND;
	message: string;
	code?: UserFacingErrorCode;
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

export const userFacingError = (
	message: string,
	code?: UserFacingErrorCode,
) => {
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

export function throwUserFacingError(
	message: string,
	code?: UserFacingErrorCode,
): never {
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
