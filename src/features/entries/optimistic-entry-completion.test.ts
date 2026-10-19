import { isDeepStrictEqual } from "node:util";
import { ConvexReactClient } from "convex/react";
import { type FunctionReference, getFunctionName } from "convex/server";
import { afterEach, expect, test } from "vitest";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { optimisticEntryCompletion } from "./optimistic-entry-completion";

// Only the network is replaced: exercise Convex's public client and its real
// optimistic cache, including server rebases, rollback and mutation settlement.
type ClientMessage = {
	type: string;
	requestId?: number;
	newVersion?: number;
	modifications?: {
		type: string;
		queryId: number;
		udfPath: string;
		args: unknown[];
	}[];
};
class ServerSocket {
	static current: ServerSocket;
	onopen = () => {};
	onmessage = (_event: { data: string }) => {};
	onclose = () => {};
	messages: ClientMessage[] = [];
	constructor() {
		ServerSocket.current = this;
	}
	send(message: string) {
		this.messages.push(JSON.parse(message));
	}
	close() {
		this.onclose();
	}
	reply(message: unknown) {
		this.onmessage({ data: JSON.stringify(message) });
	}
}
const clients: ConvexReactClient[] = [];
afterEach(async () => {
	await Promise.all(clients.splice(0).map((client) => client.close()));
});
const id = "entry-a" as Id<"dayEntries">;
const otherId = "entry-b" as Id<"dayEntries">;
const entry = {
	id,
	relatedDayEntryId: id,
	dayKey: "2026-10-19",
	title: "Mathematik üben",
	completed: false,
};
const other = {
	...entry,
	id: otherId,
	relatedDayEntryId: otherId,
	title: "Englisch üben",
};
const homework = (completed: boolean) => [
	{
		...entry,
		completed,
		time: null,
		notes: null,
		dueDateKey: null,
		dueDateLabel: null,
		plannedDateLabel: null,
		durationMinutes: null,
	},
];
const dayArgs = { dayKeys: ["2026-10-19"] };
const notificationArgs = {
	...dayArgs,
	cacheScope: "notificationPlanning" as const,
};
const weekArgs = { dayKeys: ["2026-10-19", "2026-10-20"] };

function setup() {
	const client = new ConvexReactClient("https://optimistic-test.convex.cloud", {
		webSocketConstructor: ServerSocket as unknown as typeof WebSocket,
		unsavedChangesWarning: false,
		logger: false,
	});
	clients.push(client);
	const detail = client.watchQuery(api.dayEntries.get, { id });
	const day = client.watchQuery(api.dayEntries.listByDayKeys, dayArgs);
	const week = client.watchQuery(api.dayEntries.listByDayKeys, weekArgs);
	const overview = client.watchQuery(api.dayEntries.listHomeworkOverview, {});
	const notifications = client.watchQuery(
		api.dayEntries.listByDayKeys,
		notificationArgs,
	);
	for (const watch of [detail, day, week, overview, notifications])
		watch.onUpdate(() => {});
	const socket = ServerSocket.current;
	socket.onopen();
	const additions = socket.messages.flatMap(
		(message) => message.modifications ?? [],
	);
	expect(additions.length).toBeGreaterThan(0);
	let timestamp = 0;
	const encodedTimestamp = (value: number) =>
		btoa(String.fromCharCode(value, 0, 0, 0, 0, 0, 0, 0));
	const querySet = Math.max(
		...socket.messages.map((message) => message.newVersion ?? 0),
	);
	function publish(values: {
		detail?: unknown;
		day?: unknown;
		week?: unknown;
		overview?: unknown;
		notifications?: unknown;
	}) {
		const results = [
			values.detail,
			values.day,
			values.week,
			values.overview,
			values.notifications,
		];
		const names = [
			api.dayEntries.get,
			api.dayEntries.listByDayKeys,
			api.dayEntries.listByDayKeys,
			api.dayEntries.listHomeworkOverview,
			api.dayEntries.listByDayKeys,
		];
		const args = [{ id }, dayArgs, weekArgs, {}, notificationArgs];
		const modifications = results.flatMap((value, index) => {
			if (value === undefined) return [];
			const addition = additions.find(
				(item) =>
					item.type === "Add" &&
					item.udfPath ===
						getFunctionName(names[index] as FunctionReference<"query">) &&
					isDeepStrictEqual(item.args[0], args[index]),
			);
			expect(addition, "the query must have a real subscription").toBeDefined();
			return [
				{
					type: "QueryUpdated",
					queryId: addition?.queryId,
					value,
					logLines: [],
					journal: null,
				},
			];
		});
		socket.reply({
			type: "Transition",
			startVersion: {
				querySet: timestamp ? querySet : 0,
				identity: 0,
				ts: encodedTimestamp(timestamp),
			},
			endVersion: { querySet, identity: 0, ts: encodedTimestamp(++timestamp) },
			modifications,
		});
	}
	const mutate = (completed: boolean) =>
		client.mutation(
			api.dayEntries.setCompleted,
			{ id, completed },
			{ optimisticUpdate: optimisticEntryCompletion },
		);
	const respond = (success: boolean, completed = true) => {
		const request = socket.messages.findLast(
			(message) => message.type === "Mutation",
		);
		expect(request).toBeDefined();
		socket.reply(
			success
				? {
						type: "MutationResponse",
						requestId: request?.requestId,
						success: true,
						result: completed,
						ts: encodedTimestamp(timestamp + 1),
						logLines: [],
					}
				: {
						type: "MutationResponse",
						requestId: request?.requestId,
						success: false,
						result: "Synthetic save rejection",
						logLines: [],
					},
		);
	};
	return {
		detail,
		day,
		week,
		overview,
		notifications,
		mutate,
		publish,
		respond,
	};
}

// A missing list update, in-place mutation, or rollback to an old snapshot must
// fail this worked example (A changes, B stays unchanged, latest title survives).
test("optimistically updates every loaded view and rolls back to the latest server state", async () => {
	const h = setup();
	const day = { "2026-10-19": [entry, other] };
	const week = { ...day, "2026-10-20": [other] };
	h.publish({
		detail: entry,
		day,
		week,
		overview: homework(false),
		notifications: day,
	});
	const result = h.mutate(true);
	const rejected = expect(result).rejects.toThrow("Synthetic save rejection");
	expect(h.detail.localQueryResult()).toEqual({ ...entry, completed: true });
	expect(h.day.localQueryResult()).toEqual({
		"2026-10-19": [{ ...entry, completed: true }, other],
	});
	expect(h.week.localQueryResult()).toEqual({
		"2026-10-19": [{ ...entry, completed: true }, other],
		"2026-10-20": [other],
	});
	expect(h.overview.localQueryResult()).toEqual(homework(true));
	// Side effects retain persisted input even while every UI representation changes.
	expect(h.notifications.localQueryResult()).toEqual(day);
	expect(entry.completed).toBe(false);
	expect(day["2026-10-19"][0]?.completed).toBe(false);
	const revised = { ...entry, title: "Quadratische Funktionen" };
	h.publish({
		detail: revised,
		day: { "2026-10-19": [revised, other] },
		week: { "2026-10-19": [revised, other], "2026-10-20": [other] },
		overview: [{ ...homework(false)[0], title: revised.title }],
	});
	expect(h.detail.localQueryResult()).toEqual({ ...revised, completed: true });
	h.respond(false);
	await rejected;
	expect(h.detail.localQueryResult()).toEqual(revised);
	expect(h.day.localQueryResult()).toEqual({ "2026-10-19": [revised, other] });
	expect(h.week.localQueryResult()).toEqual({
		"2026-10-19": [revised, other],
		"2026-10-20": [other],
	});
	expect(h.overview.localQueryResult()).toEqual([
		{ ...homework(false)[0], title: revised.title },
	]);
});

// Resolving on the response alone, or removing optimism before queries reflect
// a successful reopen, would expose a stale completed status and fail.
test("retains a successful optimistic reopen until the server queries catch up", async () => {
	const h = setup();
	h.publish({
		detail: { ...entry, completed: true },
		day: { "2026-10-19": [{ ...entry, completed: true }] },
		overview: homework(true),
		notifications: { "2026-10-19": [{ ...entry, completed: true }] },
	});
	let settled = false;
	const result = h.mutate(false).then(() => {
		settled = true;
	});
	expect(h.detail.localQueryResult()?.completed).toBe(false);
	h.respond(true, false);
	await Promise.resolve();
	expect(settled).toBe(false);
	expect(h.notifications.localQueryResult()).toEqual({
		"2026-10-19": [{ ...entry, completed: true }],
	});
	expect(h.detail.localQueryResult()?.completed).toBe(false);
	h.publish({
		detail: entry,
		day: { "2026-10-19": [entry] },
		overview: homework(false),
		notifications: { "2026-10-19": [entry] },
	});
	await result;
	expect(settled).toBe(true);
	expect(h.notifications.localQueryResult()).toEqual({ "2026-10-19": [entry] });
	expect(h.detail.localQueryResult()).toEqual(entry);
	expect(h.overview.localQueryResult()).toEqual(homework(false));
});

// Do not create nonexistent detail data or assume all cached queries are loaded.
test("updates a cached list without inventing loading or missing query results", async () => {
	const h = setup();
	h.publish({ detail: null, day: { "2026-10-19": [entry] } });
	const result = h.mutate(true);
	const rejected = expect(result).rejects.toThrow();
	expect(h.detail.localQueryResult()).toBeNull();
	expect(h.week.localQueryResult()).toBeUndefined();
	expect(h.overview.localQueryResult()).toBeUndefined();
	expect(h.day.localQueryResult()).toEqual({
		"2026-10-19": [{ ...entry, completed: true }],
	});
	h.respond(false);
	await rejected;
	expect(h.day.localQueryResult()).toEqual({ "2026-10-19": [entry] });
});

// Session completion has a separate backend contract; this action cannot mark it.
test("leaves learning-session completion to its own workflow", async () => {
	const h = setup();
	const session = { ...entry, relatedLearningPlanSessionId: "session-a" };
	h.publish({ detail: session, day: { "2026-10-19": [session] } });
	const result = h.mutate(true);
	const rejected = expect(result).rejects.toThrow();
	expect(h.detail.localQueryResult()).toEqual(session);
	expect(h.day.localQueryResult()).toEqual({ "2026-10-19": [session] });
	h.respond(false);
	await rejected;
});
