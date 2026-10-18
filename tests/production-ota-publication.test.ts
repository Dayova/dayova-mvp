import { describe, expect, it, vi } from "vitest";
import { publicationLockBranch, publishProductionOta, verifyChannel, verifyPublication } from "../scripts/publish-production-ota.mjs";

const sha = "a".repeat(40);
const channel = { currentPage: { name: "production", isPaused: false,
	branchMapping: JSON.stringify({ version: 0, data: [{ branchId: "branch-id", branchMappingLogic: "true" }] }),
	updateBranches: [{ name: "production", id: "branch-id" }] } };
const updates = ["ios", "android"].map((platform) => ({ platform, id: `${platform}-id`, group: "group-id",
	runtimeVersion: "1.0.5", gitCommitHash: sha, branch: "production" }));

function harness(fail?: string, server = { locked: false }) {
	const run = vi.fn((command: string, args: string[]) => {
		if (command === "git") return args[0] === "rev-parse" ? sha : "";
		if (command === "expo") { if (fail === "export") throw new Error("Android export failed"); return ""; }
		if (args[0] === "channel:view") return JSON.stringify(fail === "channel" ? {} : channel);
		if (args[0] === "branch:create") {
			if (server.locked) throw new Error("A branch already exists");
			server.locked = true;
			if (fail === "acquire") return ""; // Server accepted it, response was lost.
			return JSON.stringify({ id: "lock-id", name: publicationLockBranch });
		}
		if (args[0] === "branch:delete") {
			if (fail === "release") throw new Error("Lock release failed");
			server.locked = false;
			return JSON.stringify({ id: "lock-id" });
		}
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
	it.each([
		{ phase: "before-export", head: "b".repeat(40), gitStatus: "", reason: "HEAD does not match OTA_SOURCE_SHA" },
		{ phase: "before-export", head: sha, gitStatus: "?? generated-file\n", reason: "working tree is dirty" },
		{ phase: "after-export", head: sha, gitStatus: " M package.json\n", reason: "working tree is dirty" },
	])("diagnoses $reason $phase without publishing", ({ phase, head, gitStatus, reason }) => {
		const h = harness();
		if (phase === "after-export") {
			h.run.mockImplementationOnce(() => sha)
				.mockImplementationOnce(() => "")
				.mockImplementationOnce(() => "");
		}
		h.run.mockImplementationOnce(() => head).mockImplementationOnce(() => gitStatus);
		expect(h.publish).toThrow(reason);
		expect(h.log).toHaveBeenCalledWith(JSON.stringify({
			status: "source-verification", phase, expectedSha: sha, actualSha: head,
			gitStatus: gitStatus.trimEnd(),
		}));
		expect(h.guard).toHaveBeenCalledTimes(phase === "after-export" ? 1 : 0);
		expect(h.run.mock.calls.some(([command]) => command === "eas")).toBe(false);
	});
	it.each([undefined, "short-sha"])("diagnoses invalid source SHA %s without publishing", (sourceSha) => {
		const h = harness();
		expect(() => publishProductionOta({ sourceSha, runtimeVersion: "1.0.5", ...h }))
			.toThrow("OTA_SOURCE_SHA is missing or invalid");
		expect(h.log).toHaveBeenCalledWith(JSON.stringify({
			status: "source-verification", phase: "before-export", expectedSha: sourceSha ?? null,
			actualSha: sha, gitStatus: "",
		}));
		expect(h.guard).not.toHaveBeenCalled();
		expect(h.run.mock.calls.some(([command]) => command !== "git")).toBe(false);
	});
	it("exports both platforms before a single publication of that bundle and returns provenance", () => {
		const h = harness();
		expect(h.publish()).toHaveLength(2);
		expect(h.run).toHaveBeenCalledWith("expo", ["export", "--platform", "all", "--output-dir", "dist"], false);
		const publishCalls = h.run.mock.calls.filter(([, args]) => args[0] === "update");
		expect(publishCalls).toHaveLength(1);
		expect(publishCalls[0][1]).toEqual(expect.arrayContaining(["all", "--skip-bundler", "--environment", "production", `Production OTA from ${sha}`]));
		expect(h.guard).toHaveBeenCalledTimes(2);
		const operations = h.run.mock.calls.map(([, args]) => args[0]);
		expect(operations.indexOf("branch:create")).toBeLessThan(operations.indexOf("update"));
		expect(operations.indexOf("branch:delete")).toBeGreaterThan(operations.indexOf("update"));
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
	it.each(["acquire", "publish", "partial", "release"])("a persisted lock blocks a separate later invocation after %s uncertainty", (failure) => {
		const server = { locked: false };
		const first = harness(failure, server);
		expect(first.publish).toThrow();
		expect(server.locked).toBe(true);
		if (failure !== "release") {
			expect(first.run.mock.calls.some(([, args]) => args[0] === "branch:delete")).toBe(false);
		}
		const next = harness(undefined, server);
		expect(next.publish).toThrow("already exists");
		expect(next.run.mock.calls.some(([, args]) => ["update", "branch:delete"].includes(args[0]))).toBe(false);
	});
	it("blocks a new worker when the old worker disappears without completing its catch", () => {
		const server = { locked: false };
		const first = harness("publish", server);
		first.log.mockImplementation((message: string) => {
			if (message.includes('"status":"publication-locked"')) throw new Error("Worker terminated");
		});
		expect(first.publish).toThrow("Worker terminated");
		const next = harness(undefined, server);
		expect(next.publish).toThrow("already exists");
		expect(next.run.mock.calls.some(([, args]) => args[0] === "update")).toBe(false);
	});
	it("allows a later invocation only after a verified publication releases the lock", () => {
		const server = { locked: false };
		expect(harness(undefined, server).publish()).toHaveLength(2);
		expect(server.locked).toBe(false);
		expect(harness(undefined, server).publish()).toHaveLength(2);
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
