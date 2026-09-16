import { describe, expect, it, vi } from "vitest";
import { publishProductionOta, verifyChannel, verifyPublication } from "../scripts/publish-production-ota.mjs";

const sha = "a".repeat(40);
const channel = { currentPage: { name: "production", isPaused: false,
	branchMapping: JSON.stringify({ version: 0, data: [{ branchId: "branch-id", branchMappingLogic: "true" }] }),
	updateBranches: [{ name: "production", id: "branch-id" }] } };
const updates = ["ios", "android"].map((platform) => ({ platform, id: `${platform}-id`, group: "group-id",
	runtimeVersion: "1.0.5", gitCommitHash: sha, branch: "production" }));

function harness(fail?: string) {
	const run = vi.fn((command: string, args: string[]) => {
		if (command === "git") return args[0] === "rev-parse" ? sha : "";
		if (command === "expo") { if (fail === "export") throw new Error("Android export failed"); return ""; }
		if (args[0] === "channel:view") return JSON.stringify(fail === "channel" ? {} : channel);
		if (fail === "publish") throw Object.assign(new Error("Connection lost"), {
			stdout: JSON.stringify(updates.slice(0, 1)),
		});
		return JSON.stringify(fail === "partial" ? updates.slice(0, 1) : updates);
	});
	const guard = vi.fn(() => ({ safe: fail !== "guard", reason: "Native mismatch" }));
	const log = vi.fn();
	return { run, guard, log, publish: () => publishProductionOta({ sourceSha: sha, runtimeVersion: "1.0.5", run, guard, log }) };
}

describe("production publication boundary", () => {
	it("exports both platforms before a single publication of that bundle and returns provenance", () => {
		const h = harness();
		expect(h.publish()).toHaveLength(2);
		expect(h.run).toHaveBeenCalledWith("expo", ["export", "--platform", "all", "--output-dir", "dist"], false);
		const publishCalls = h.run.mock.calls.filter(([, args]) => args[0] === "update");
		expect(publishCalls).toHaveLength(1);
		expect(publishCalls[0][1]).toEqual(expect.arrayContaining(["all", "--skip-bundler", "--environment", "production", `Production OTA from ${sha}`]));
		expect(h.guard).toHaveBeenCalledTimes(2);
	});
	it.each(["guard", "export", "channel"])("never publishes after %s failure", (failure) => {
		const h = harness(failure);
		expect(h.publish).toThrow();
		expect(h.run.mock.calls.some(([, args]) => args[0] === "update")).toBe(false);
	});
	it("rejects source changes between export and publication", () => {
		const h = harness();
		h.run.mockImplementationOnce(() => sha).mockImplementationOnce(() => "")
			.mockImplementationOnce(() => "").mockImplementationOnce(() => "b".repeat(40));
		expect(h.publish).toThrow("exact reviewed main SHA");
		expect(h.run.mock.calls.some(([, args]) => args[0] === "update")).toBe(false);
	});
	it.each(["publish", "partial"])("reports %s uncertainty without retrying", (failure) => {
		const h = harness(failure);
		expect(h.publish).toThrow();
		expect(h.run.mock.calls.filter(([, args]) => args[0] === "update")).toHaveLength(1);
		expect(h.log).toHaveBeenCalledWith(expect.stringContaining("Do not retry automatically"));
		if (failure === "publish") expect(h.log).toHaveBeenCalledWith(JSON.stringify(updates.slice(0, 1)));
	});
	it("rejects runtime or commit drift in the published response", () => {
		expect(() => verifyPublication(updates, sha, "1.0.4")).toThrow();
		expect(() => verifyPublication(updates, "b".repeat(40), "1.0.5")).toThrow();
	});
	it("rejects paused, split, and remapped production channels", () => {
		for (const override of [{ isPaused: true }, { branchMapping: JSON.stringify({ version: 0, data: [] }) },
			{ updateBranches: [{ name: "other", id: "branch-id" }] }]) {
			expect(() => verifyChannel({ currentPage: { ...channel.currentPage, ...override } })).toThrow();
		}
	});
});
