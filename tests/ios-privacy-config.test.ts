import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_INFO_PLIST_PATH = resolve(process.cwd(), "ios/Dayova/Info.plist");

const REQUIRED_IOS_PRIVACY_KEYS = [
	"NSMicrophoneUsageDescription",
	"NSSpeechRecognitionUsageDescription",
	"NSCameraUsageDescription",
	"NSPhotoLibraryUsageDescription",
] as const;

const readNativeInfoPlistValue = (key: string) => {
	const plist = readFileSync(IOS_INFO_PLIST_PATH, "utf8");
	const match = plist.match(
		new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`),
	);
	return match?.[1] ?? null;
};

const readFinalExpoInfoPlist = () => {
	const output = execFileSync(
		"npx",
		["expo", "config", "--type", "introspect", "--json"],
		{
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				APP_VARIANT: "production",
			},
		},
	);

	return JSON.parse(output).ios?.infoPlist ?? {};
};

describe("iOS privacy purpose strings", () => {
	it("keeps required privacy keys in the final Expo iOS config and any generated native plist", () => {
		const finalInfoPlist = readFinalExpoInfoPlist();
		const nativeInfoPlistExists = existsSync(IOS_INFO_PLIST_PATH);

		for (const key of REQUIRED_IOS_PRIVACY_KEYS) {
			const appConfigValue = finalInfoPlist[key];

			expect(appConfigValue, `${key} missing from final Expo iOS config`).toEqual(
				expect.any(String),
			);

			if (nativeInfoPlistExists) {
				const nativeValue = readNativeInfoPlistValue(key);
				expect(
					nativeValue,
					`${key} missing from ios/Dayova/Info.plist`,
				).toEqual(appConfigValue);
			}
		}
	});
});
