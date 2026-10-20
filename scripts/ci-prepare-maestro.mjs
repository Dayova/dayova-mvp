import { execFileSync } from "node:child_process";

if (process.platform === "darwin") {
	if (process.env.MAESTRO_APP_ID !== "de.dayova.app-dev")
		throw new Error("Simulator setup is restricted to the isolated CI app");
	// Maestro cannot inspect iOS 26's password-save sheet. Appium uses this
	// simulator preference too; keep the app's actual password semantics intact.
	// https://github.com/appium/appium-ios-simulator/blob/master/lib/extensions/settings.ts
	const command = ["simctl", "spawn", "booted", "defaults"];
	execFileSync("xcrun", [
		...command,
		"write",
		"com.apple.WebUI",
		"AutoFillPasswords",
		"-bool",
		"NO",
	]);
	const value = execFileSync(
		"xcrun",
		[...command, "read", "com.apple.WebUI", "AutoFillPasswords"],
		{ encoding: "utf8" },
	).trim();
	if (value !== "0")
		throw new Error("Simulator password AutoFill remains enabled");
	console.log("Disposable iOS simulator password AutoFill verified disabled");
}
