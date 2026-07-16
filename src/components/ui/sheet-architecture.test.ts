import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, "../../..");
const sourceRoot = resolve(projectRoot, "src");
const framePath = resolve(testDirectory, "dayova-sheet-frame.tsx");

function collectSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return collectSourceFiles(path);
		return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
	});
}

const sourceFiles = collectSourceFiles(sourceRoot).filter(
	(path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"),
);

function projectPath(path: string) {
	return relative(projectRoot, path).replaceAll("\\", "/");
}

describe("Dayova sheet architecture", () => {
	test("routes every app-owned sheet through the shared frame", () => {
		expect(existsSync(framePath)).toBe(true);
		const specializedSheets = sourceFiles.filter((path) =>
			path.endsWith("-sheet.tsx"),
		);

		expect(specializedSheets.map(projectPath)).toEqual(
			expect.arrayContaining([
				"src/components/ui/action-sheet.tsx",
				"src/components/ui/confirmation-sheet.tsx",
				"src/components/ui/select-sheet.tsx",
			]),
		);
		for (const path of specializedSheets) {
			expect(readFileSync(path, "utf8"), projectPath(path)).toContain(
				"DayovaSheetFrame",
			);
		}
	});

	test("keeps Gorhom sheet primitives private to the shared frame", () => {
		const offenders = sourceFiles.flatMap((path) => {
			const source = readFileSync(path, "utf8");
			if (!source.includes('from "@gorhom/bottom-sheet"')) return [];
			if (path === framePath) return [];
			if (
				projectPath(path) === "src/app/_layout.tsx" &&
				source.includes("BottomSheetModalProvider") &&
				!source.match(/BottomSheet(?!ModalProvider)/)
			) {
				return [];
			}
			return [projectPath(path)];
		});

		expect(offenders).toEqual([]);
	});

	test("does not bypass the sheet system with React Native overlays", () => {
		const offenders = sourceFiles.flatMap((path) => {
			const source = readFileSync(path, "utf8");
			const importsReactNativeOverlay =
				/import\s*{[^}]*\b(?:Modal|Alert|ActionSheetIOS)\b[^}]*}\s*from\s*["']react-native["']/s.test(
					source,
				);
			return importsReactNativeOverlay ? [projectPath(path)] : [];
		});

		expect(offenders).toEqual([]);
	});

	test("removes the legacy modal abstractions", () => {
		expect(existsSync(resolve(testDirectory, "bottom-modal.tsx"))).toBe(false);
		expect(existsSync(resolve(testDirectory, "action-modal.tsx"))).toBe(false);
	});

	test("enables the local ESLint guard for immediate feedback", () => {
		const eslintConfig = readFileSync(
			resolve(projectRoot, "eslint.config.mjs"),
			"utf8",
		);

		expect(eslintConfig).toContain('"no-direct-overlay-primitives"');
		expect(eslintConfig).toContain(
			'"dayova-ui/no-direct-overlay-primitives": "error"',
		);
	});
});
