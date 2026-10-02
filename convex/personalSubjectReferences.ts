import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const MAX_PERSONAL_SUBJECT_REFERENCES = 1_500;

type PersonalSubjectReferenceTarget =
	| { targetKind: "dayEntry"; dayEntryId: Id<"dayEntries"> }
	| { targetKind: "learningPlan"; learningPlanId: Id<"learningPlans"> }
	| {
			targetKind: "timetableLesson";
			timetableLessonId: Id<"timetableLessons">;
	  };

const listPersonalSubjectReferences = async (
	ctx: MutationCtx,
	ownerTokenIdentifier: string,
	personalSubjectId: Id<"personalSubjects">,
) =>
	await ctx.db
		.query("personalSubjectReferences")
		.withIndex("by_ownerTokenIdentifier_and_personalSubjectId", (query) =>
			query
				.eq("ownerTokenIdentifier", ownerTokenIdentifier)
				.eq("personalSubjectId", personalSubjectId),
		)
		.take(MAX_PERSONAL_SUBJECT_REFERENCES + 1);

const addPersonalSubjectReference = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		personalSubjectId?: Id<"personalSubjects">;
		target: PersonalSubjectReferenceTarget;
	},
) => {
	if (!args.personalSubjectId) return;
	await ctx.db.insert("personalSubjectReferences", {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		personalSubjectId: args.personalSubjectId,
		...args.target,
	});
};

const removePersonalSubjectReference = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		personalSubjectId?: Id<"personalSubjects">;
		target: PersonalSubjectReferenceTarget;
	},
) => {
	let references: Doc<"personalSubjectReferences">[];
	switch (args.target.targetKind) {
		case "dayEntry": {
			const dayEntryId = args.target.dayEntryId;
			references = await ctx.db
				.query("personalSubjectReferences")
				.withIndex("by_dayEntryId", (query) =>
					query.eq("dayEntryId", dayEntryId),
				)
				.take(2);
			break;
		}
		case "learningPlan": {
			const learningPlanId = args.target.learningPlanId;
			references = await ctx.db
				.query("personalSubjectReferences")
				.withIndex("by_learningPlanId", (query) =>
					query.eq("learningPlanId", learningPlanId),
				)
				.take(2);
			break;
		}
		case "timetableLesson": {
			const timetableLessonId = args.target.timetableLessonId;
			references = await ctx.db
				.query("personalSubjectReferences")
				.withIndex("by_timetableLessonId", (query) =>
					query.eq("timetableLessonId", timetableLessonId),
				)
				.take(2);
		}
	}
	for (const reference of references) {
		if (
			reference.ownerTokenIdentifier === args.ownerTokenIdentifier &&
			(!args.personalSubjectId ||
				reference.personalSubjectId === args.personalSubjectId)
		) {
			await ctx.db.delete("personalSubjectReferences", reference._id);
		}
	}
};

const replacePersonalSubjectReference = async (
	ctx: MutationCtx,
	args: {
		ownerTokenIdentifier: string;
		previousPersonalSubjectId?: Id<"personalSubjects">;
		nextPersonalSubjectId?: Id<"personalSubjects">;
		target: PersonalSubjectReferenceTarget;
	},
) => {
	if (args.previousPersonalSubjectId === args.nextPersonalSubjectId) return;
	await removePersonalSubjectReference(ctx, {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		personalSubjectId: args.previousPersonalSubjectId,
		target: args.target,
	});
	await addPersonalSubjectReference(ctx, {
		ownerTokenIdentifier: args.ownerTokenIdentifier,
		personalSubjectId: args.nextPersonalSubjectId,
		target: args.target,
	});
};

const deleteDayEntryWithPersonalSubjectReference = async (
	ctx: MutationCtx,
	dayEntryId: Id<"dayEntries">,
) => {
	const entry = await ctx.db.get("dayEntries", dayEntryId);
	if (!entry) return null;
	await removePersonalSubjectReference(ctx, {
		ownerTokenIdentifier: entry.ownerTokenIdentifier,
		personalSubjectId: entry.personalSubjectId,
		target: { targetKind: "dayEntry", dayEntryId },
	});
	await ctx.db.delete("dayEntries", dayEntryId);
	return entry;
};

const deleteLearningPlanWithPersonalSubjectReference = async (
	ctx: MutationCtx,
	learningPlanId: Id<"learningPlans">,
) => {
	const plan = await ctx.db.get("learningPlans", learningPlanId);
	if (!plan) return null;
	await removePersonalSubjectReference(ctx, {
		ownerTokenIdentifier: plan.ownerTokenIdentifier,
		personalSubjectId: plan.personalSubjectId,
		target: { targetKind: "learningPlan", learningPlanId },
	});
	await ctx.db.delete("learningPlans", learningPlanId);
	return plan;
};

const deleteTimetableLessonWithPersonalSubjectReference = async (
	ctx: MutationCtx,
	timetableLessonId: Id<"timetableLessons">,
) => {
	const lesson = await ctx.db.get("timetableLessons", timetableLessonId);
	if (!lesson) return null;
	await removePersonalSubjectReference(ctx, {
		ownerTokenIdentifier: lesson.ownerTokenIdentifier,
		personalSubjectId: lesson.personalSubjectId,
		target: { targetKind: "timetableLesson", timetableLessonId },
	});
	await ctx.db.delete("timetableLessons", timetableLessonId);
	return lesson;
};

export {
	MAX_PERSONAL_SUBJECT_REFERENCES,
	addPersonalSubjectReference,
	deleteDayEntryWithPersonalSubjectReference,
	deleteLearningPlanWithPersonalSubjectReference,
	deleteTimetableLessonWithPersonalSubjectReference,
	listPersonalSubjectReferences,
	removePersonalSubjectReference,
	replacePersonalSubjectReference,
};
export type { PersonalSubjectReferenceTarget };
