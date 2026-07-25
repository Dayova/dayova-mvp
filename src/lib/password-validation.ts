export const meetsPasswordRequirements = (value: string) =>
	value.length >= 8 && value.trim().length > 0;
