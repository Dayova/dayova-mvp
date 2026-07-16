import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(testDirectory, "../../app");
const settingsSource = readFileSync(
	resolve(appDirectory, "(app)/settings.tsx"),
	"utf8",
);
const passwordChangePath = resolve(appDirectory, "change-password.tsx");
const passwordChangeSource = existsSync(passwordChangePath)
	? readFileSync(passwordChangePath, "utf8")
	: "";

describe("password change flow", () => {
	test("is reachable from settings", () => {
		expect(settingsSource).toContain('label="Passwort ändern"');
		expect(settingsSource).toContain('router.push("/change-password")');
	});

	test("requires the current password and confirms the new password", () => {
		expect(existsSync(passwordChangePath)).toBe(true);
		expect(passwordChangeSource).toContain("<ScreenScroll");
		expect(passwordChangeSource).toContain('autoComplete="current-password"');
		expect(
			passwordChangeSource.match(/autoComplete="new-password"/g),
		).toHaveLength(2);
		expect(passwordChangeSource.match(/accessory=\{/g)).toHaveLength(3);
		expect(passwordChangeSource).toContain('placeholder="Erneut eingeben"');
		expect(passwordChangeSource).toContain("newPassword !== confirmPassword");
		expect(passwordChangeSource).toContain("await changePassword({");
	});

	test("explains session revocation and confirms success", () => {
		expect(passwordChangeSource).toContain("<WarningBanner");
		expect(passwordChangeSource).toContain(
			"Alle anderen Geräte werden aus Sicherheitsgründen abgemeldet.",
		);
		expect(passwordChangeSource).toContain("<SuccessConfirmationScreen");
		expect(passwordChangeSource).toContain('title="Passwort geändert"');
	});
});
