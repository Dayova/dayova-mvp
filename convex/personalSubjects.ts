import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { throwUserFacingError } from "./errors";

const MAX_PERSONAL_SUBJECTS = 100;
const MAX_REFERENCES_PER_TABLE = 500;
const MAX_SUBJECT_NAME_LENGTH = 60;

const BUILT_IN_SUBJECTS = [
	"Mathematik",
	"Deutsch",
	"Englisch",
	"Biologie",
	"Chemie",
	"Physik",
	"Geschichte",
	"Erdkunde",
	"Sozialkunde",
	"Informatik",
	"Kunst",
	"Musik",
	"Sport",
] as const;

const normalizeSubjectName = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

const cleanSubjectName = (value: string) => {
	const name = value.trim().replace(/\s+/g, " ");
	if (!name) throwUserFacingError("Gib einen Fachnamen ein.");
	if (name.length > MAX_SUBJECT_NAME_LENGTH) {
		throwUserFacingError(
			`Der Fachname darf höchstens ${MAX_SUBJECT_NAME_LENGTH} Zeichen lang sein.`,
		);
	}
	return name;
};

const builtInSubjectByNormalizedName = new Map(
	BUILT_IN_SUBJECTS.map((name) => [normalizeSubjectName(name), name]),
);

const requireOwnerTokenIdentifier = async (ctx: QueryCtx | MutationCtx) => {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throwUserFacingError("Nicht authentifiziert.");
	return identity.tokenIdentifier;
};

const personalSubjectValidator = v.object({
	id: v.id("personalSubjects"),
	name: v.string(),
});

const createResultValidator = v.union(
	v.object({
		kind: v.literal("builtIn"),
		name: v.string(),
	}),
	v.object({
		kind: v.literal("personal"),
		id: v.id("personalSubjects"),
		name: v.string(),
	}),
);

export const list = query({
	args: {},
	returns: v.object({
		personal: v.array(personalSubjectValidator),
		reusableTimetableSubjects: v.array(v.string()),
	}),
	handler: async (ctx) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const personalSubjects = await ctx.db
			.query("personalSubjects")
			.withIndex("by_ownerTokenIdentifier_and_normalizedName", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(MAX_PERSONAL_SUBJECTS);
		const personalNames = new Set(
			personalSubjects.map((subject) => subject.normalizedName),
		);

		const activeTimetable = await ctx.db
			.query("timetables")
			.withIndex("by_ownerTokenIdentifier_and_status", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("status", "active"),
			)
			.order("desc")
			.first();
		const activeLessons = activeTimetable
			? await ctx.db
					.query("timetableLessons")
					.withIndex("by_timetableId_and_dayOfWeek_and_startTime", (q) =>
						q.eq("timetableId", activeTimetable._id),
					)
					.take(200)
			: [];
		const reusableTimetableSubjects = Array.from(
			new Map(
				activeLessons
					.filter((lesson) => !lesson.subjectIsOneTime)
					.map((lesson) => cleanSubjectName(lesson.subject))
					.filter((name) => {
						const normalizedName = normalizeSubjectName(name);
						return (
							!builtInSubjectByNormalizedName.has(normalizedName) &&
							!personalNames.has(normalizedName)
						);
					})
					.map((name) => [normalizeSubjectName(name), name]),
			).values(),
		).sort((left, right) => left.localeCompare(right, "de-DE"));

		return {
			personal: personalSubjects
				.map((subject) => ({ id: subject._id, name: subject.name }))
				.sort((left, right) => left.name.localeCompare(right.name, "de-DE")),
			reusableTimetableSubjects,
		};
	},
});

export const create = mutation({
	args: { name: v.string() },
	returns: createResultValidator,
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const name = cleanSubjectName(args.name);
		const normalizedName = normalizeSubjectName(name);
		const builtInName = builtInSubjectByNormalizedName.get(normalizedName);
		if (builtInName) return { kind: "builtIn" as const, name: builtInName };

		const existing = await ctx.db
			.query("personalSubjects")
			.withIndex("by_ownerTokenIdentifier_and_normalizedName", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("normalizedName", normalizedName),
			)
			.unique();
		if (existing) {
			return {
				kind: "personal" as const,
				id: existing._id,
				name: existing.name,
			};
		}

		const current = await ctx.db
			.query("personalSubjects")
			.withIndex("by_ownerTokenIdentifier_and_normalizedName", (q) =>
				q.eq("ownerTokenIdentifier", ownerTokenIdentifier),
			)
			.take(MAX_PERSONAL_SUBJECTS);
		if (current.length >= MAX_PERSONAL_SUBJECTS) {
			throwUserFacingError(
				"Du hast bereits sehr viele persönliche Fächer gespeichert. Lösche zuerst ein nicht mehr benötigtes Fach.",
			);
		}

		const now = Date.now();
		const id = await ctx.db.insert("personalSubjects", {
			ownerTokenIdentifier,
			name,
			normalizedName,
			createdAt: now,
			updatedAt: now,
		});
		return { kind: "personal" as const, id, name };
	},
});

const renamedEntryTitle = (title: string, oldName: string, newName: string) => {
	if (title === oldName) return newName;
	const prefix = `${oldName} `;
	return title.startsWith(prefix)
		? `${newName}${title.slice(oldName.length)}`
		: title;
};

export const rename = mutation({
	args: { id: v.id("personalSubjects"), name: v.string() },
	returns: personalSubjectValidator,
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const subject = await ctx.db.get("personalSubjects", args.id);
		if (!subject || subject.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Persönliches Fach nicht gefunden.");
		}

		const name = cleanSubjectName(args.name);
		const normalizedName = normalizeSubjectName(name);
		if (builtInSubjectByNormalizedName.has(normalizedName)) {
			throwUserFacingError(
				"Dieses Standardfach ist bereits vorhanden. Wähle einen anderen Namen.",
			);
		}
		const duplicate = await ctx.db
			.query("personalSubjects")
			.withIndex("by_ownerTokenIdentifier_and_normalizedName", (q) =>
				q
					.eq("ownerTokenIdentifier", ownerTokenIdentifier)
					.eq("normalizedName", normalizedName),
			)
			.unique();
		if (duplicate && duplicate._id !== subject._id) {
			throwUserFacingError("Dieses persönliche Fach ist bereits gespeichert.");
		}
		if (subject.normalizedName === normalizedName && subject.name === name) {
			return { id: subject._id, name: subject.name };
		}

		const [entries, plans, lessons] = await Promise.all([
			ctx.db
				.query("dayEntries")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
			ctx.db
				.query("learningPlans")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
			ctx.db
				.query("timetableLessons")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
		]);
		if (
			entries.length > MAX_REFERENCES_PER_TABLE ||
			plans.length > MAX_REFERENCES_PER_TABLE ||
			lessons.length > MAX_REFERENCES_PER_TABLE
		) {
			throwUserFacingError(
				"Dieses Fach wird sehr häufig verwendet und konnte nicht sicher umbenannt werden. Bitte kontaktiere den Support.",
			);
		}

		for (const entry of entries) {
			await ctx.db.patch("dayEntries", entry._id, {
				subject: name,
				title: renamedEntryTitle(entry.title, subject.name, name),
			});
		}
		for (const plan of plans) {
			await ctx.db.patch("learningPlans", plan._id, {
				subject: name,
				updatedAt: Date.now(),
			});
		}
		for (const lesson of lessons) {
			await ctx.db.patch("timetableLessons", lesson._id, {
				subject: name,
				updatedAt: Date.now(),
			});
		}
		await ctx.db.patch("personalSubjects", subject._id, {
			name,
			normalizedName,
			updatedAt: Date.now(),
		});
		return { id: subject._id, name };
	},
});

export const remove = mutation({
	args: { id: v.id("personalSubjects") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const ownerTokenIdentifier = await requireOwnerTokenIdentifier(ctx);
		const subject = await ctx.db.get("personalSubjects", args.id);
		if (!subject || subject.ownerTokenIdentifier !== ownerTokenIdentifier) {
			throwUserFacingError("Persönliches Fach nicht gefunden.");
		}
		const [entries, plans, lessons] = await Promise.all([
			ctx.db
				.query("dayEntries")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
			ctx.db
				.query("learningPlans")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
			ctx.db
				.query("timetableLessons")
				.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (q) =>
					q
						.eq("ownerTokenIdentifier", ownerTokenIdentifier)
						.eq("personalSubjectId", subject._id),
				)
				.take(MAX_REFERENCES_PER_TABLE + 1),
		]);
		if (
			entries.length > MAX_REFERENCES_PER_TABLE ||
			plans.length > MAX_REFERENCES_PER_TABLE ||
			lessons.length > MAX_REFERENCES_PER_TABLE
		) {
			throwUserFacingError(
				"Dieses Fach wird sehr häufig verwendet und konnte nicht sicher gelöscht werden. Bitte kontaktiere den Support.",
			);
		}
		for (const entry of entries) {
			await ctx.db.patch("dayEntries", entry._id, {
				personalSubjectId: undefined,
			});
		}
		for (const plan of plans) {
			await ctx.db.patch("learningPlans", plan._id, {
				personalSubjectId: undefined,
			});
		}
		for (const lesson of lessons) {
			await ctx.db.patch("timetableLessons", lesson._id, {
				personalSubjectId: undefined,
			});
		}
		await ctx.db.delete("personalSubjects", subject._id);
		return null;
	},
});

const resolveSubjectSelection = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		subject: string;
		personalSubjectId?: Id<"personalSubjects">;
	},
) => {
	const subject = cleanSubjectName(args.subject);
	if (!args.personalSubjectId) return { subject };

	const personalSubject = await ctx.db.get(
		"personalSubjects",
		args.personalSubjectId,
	);
	if (
		!personalSubject ||
		personalSubject.ownerTokenIdentifier !== args.ownerTokenIdentifier
	) {
		throwUserFacingError(
			"Dieses persönliche Fach ist nicht mehr verfügbar. Wähle es bitte erneut aus.",
		);
	}
	return {
		subject: personalSubject.name,
		personalSubjectId: personalSubject._id,
	};
};

export {
	BUILT_IN_SUBJECTS,
	cleanSubjectName,
	normalizeSubjectName,
	resolveSubjectSelection,
};
