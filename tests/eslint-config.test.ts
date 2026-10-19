// @vitest-environment node
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function diagnostics(code: string, filePath: string) {
	const [result] = await eslint.lintText(code, { filePath });
	expect(result.fatalErrorCount, JSON.stringify(result.messages)).toBe(0);
	return result.messages.map((message) => message.ruleId);
}

describe("ESLint integration", () => {
	it("reserves typed parsing for Convex", async () => {
		const app = await eslint.calculateConfigForFile("src/app/index.tsx");
		const backend = await eslint.calculateConfigForFile("convex/users.ts");
		expect(app.languageOptions.parserOptions.projectService).toBe(false);
		expect(backend.languageOptions.parserOptions.projectService).toBe(true);
	});

	it.each([
		{
			name: "native control aliases",
			code: 'import { Switch as NativeSwitch } from "react-native";',
			filePath: "src/app/index.tsx",
			rule: "dayova-ui/no-direct-native-controls",
		},
		{
			name: "overlay namespaces",
			code: 'import * as RN from "react-native"; RN.Alert.alert("Example");',
			filePath: "src/app/index.tsx",
			rule: "dayova-ui/no-direct-overlay-primitives",
		},
		{
			name: "interface shadows",
			code: "const style = { elevation: 4 };",
			filePath: "src/components/ui/button.tsx",
			rule: "dayova-ui/no-interface-shadows",
		},
		{
			name: "test modules in Expo Router",
			code: "export const example = 1;",
			filePath: "src/app/example.test.tsx",
			rule: "dayova-ui/no-test-modules-in-router",
		},
		{
			name: "Compose Host aliases",
			code: 'import { Host as NativeHost } from "@expo/ui/jetpack-compose"; export function Example() { return <NativeHost />; }',
			filePath: "src/app/index.tsx",
			rule: "dayova-ui/require-compose-host-theme",
		},
		{
			name: "conditional React hooks",
			code: 'import { useState } from "react"; export function Example({ enabled }: { enabled: boolean }) { if (enabled) useState(0); return null; }',
			filePath: "src/app/index.tsx",
			rule: "react-hooks/rules-of-hooks",
		},
		{
			name: "missing effect dependencies",
			code: 'import { useEffect } from "react"; export function Example({ value }: { value: string }) { useEffect(() => { console.log(value); }, []); return null; }',
			filePath: "src/app/index.tsx",
			rule: "react-hooks/exhaustive-deps",
		},
		{
			name: "React Compiler global mutation",
			code: "let count = 0; export function Example() { count += 1; return <div>{count}</div>; }",
			filePath: "src/app/index.tsx",
			rule: "react-hooks/globals",
		},
		{
			name: "test source scanning",
			code: 'import { readFileSync } from "node:fs";',
			filePath: "src/features/auth/login-screen.ui.test.tsx",
			rule: "no-restricted-imports",
		},
	])("still rejects $name without UI type information", async (fixture) => {
		expect(await diagnostics(fixture.code, fixture.filePath)).toContain(
			fixture.rule,
		);
	});

	it("accepts valid React and Dayova adapter usage", async () => {
		expect(
			await diagnostics(
				'import { Switch } from "~/components/ui/switch"; export function Example() { return <Switch checked={false} onCheckedChange={() => {}} />; }',
				"src/app/index.tsx",
			),
		).toEqual([]);
	});

	it("keeps all five enabled Convex rules effective", async () => {
		const rules = await diagnostics(
			`import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
export const oldSyntax = query(async () => null);
export const missingArgs = query({ handler: async () => null });
export async function invalidReads(ctx: QueryCtx, id: Id<"users">) {
  await ctx.db.get(id);
  await ctx.db.query("users").filter(q => q.eq(q.field("name"), "Example")).take(1);
  return ctx.db.query("users").collect();
}`,
			"convex/users.ts",
		);
		expect(rules).toEqual(
			expect.arrayContaining([
				"@convex-dev/no-old-registered-function-syntax",
				"@convex-dev/require-args-validator",
				"@convex-dev/explicit-table-ids",
				"@convex-dev/no-filter-in-query",
				"@convex-dev/no-collect-in-query",
			]),
		);
	}, 30_000);

	it("accepts bounded Convex reads and explicit table IDs", async () => {
		expect(
			await diagnostics(
				`import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
export async function validReads(ctx: QueryCtx, id: Id<"users">) {
  await ctx.db.get("users", id);
  return ctx.db.query("users").take(1);
}`,
				"convex/users.ts",
			),
		).toEqual([]);
	}, 30_000);
});
