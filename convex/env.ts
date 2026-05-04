const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const readOptionalEnv = (name: string) => {
	const rawValue = process.env[name];
	if (typeof rawValue !== "string") return undefined;

	const trimmedValue = rawValue.trim();
	return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const readRequiredEnv = (name: string, errorMessage?: string) => {
	const value = readOptionalEnv(name);
	if (!value) {
		throw new Error(errorMessage ?? `${name} ist nicht konfiguriert.`);
	}

	return value;
};

export const readBooleanEnv = (name: string, fallback = false) => {
	const value = readOptionalEnv(name);
	if (!value) return fallback;

	return TRUE_VALUES.has(value.toLowerCase());
};
