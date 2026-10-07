export const OPERATING_SYSTEMS = ["Android", "iOS", "iPadOS"] as const;
type OperatingSystem = (typeof OPERATING_SYSTEMS)[number];

export function getOperatingSystem(
	platform: string,
	isPad = false,
): OperatingSystem | undefined {
	if (platform === "android") return "Android";
	if (platform === "ios") return isPad ? "iPadOS" : "iOS";
	return undefined;
}
