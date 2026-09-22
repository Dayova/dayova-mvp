import { type Infer, v } from "convex/values";

// Includes custom language subjects and course suffixes (e.g. Englisch LK).
const LANGUAGE_SUBJECT =
	/\b(deutsch|german|englisch|english|französisch|franzoesisch|french|spanisch|spanish|latein|latin|italienisch|italian|russisch|russian|griechisch|altgriechisch|greek|portugiesisch|portuguese|chinesisch|mandarin|chinese|japanisch|japanese|arabisch|arabic|türkisch|tuerkisch|turkish|polnisch|polish|niederländisch|niederlaendisch|dutch|hebräisch|hebraeisch|hebrew|koreanisch|korean|schwedisch|dänisch|daenisch|norwegisch|finnisch|tschechisch|ukrainisch|rumänisch|rumaenisch|ungarisch|persisch|hindi|sorbisch|literatur|sprache|sprachen|fremdsprache|fremdsprachen)\b/i;

export function isPodcastSubject(subject: string) {
	return LANGUAGE_SUBJECT.test(subject.normalize("NFC"));
}

// Unknown custom subjects can opt in explicitly; do not guess their language.
export function canOfferPodcast(subject: string) {
	return (
		isPodcastSubject(subject) ||
		!/\b(mathematik|mathe|physik|chemie|biologie|geschichte|politik|geografie|geographie|sport|kunst|musik|informatik|wirtschaft|religion|ethik)\b/i.test(
			subject,
		)
	);
}

export const podcastScriptValidator = v.object({
	turns: v.array(
		v.object({
			speaker: v.union(v.literal("Mira"), v.literal("Noah")),
			text: v.string(),
		}),
	),
	questions: v.array(
		v.object({
			prompt: v.string(),
			options: v.array(v.string()),
			correctIndex: v.number(),
			explanation: v.string(),
		}),
	),
});
export type PodcastScript = Infer<typeof podcastScriptValidator>;

export const podcastFields = {
	ownerTokenIdentifier: v.string(),
	learningPlanId: v.id("learningPlans"),
	sessionId: v.id("learningPlanSessions"),
	fingerprint: v.string(),
	status: v.union(
		v.literal("script"),
		v.literal("audio"),
		v.literal("ready"),
		v.literal("failed"),
	),
	attempt: v.number(),
	script: v.optional(podcastScriptValidator),
	storageId: v.optional(v.id("_storage")),
	durationSeconds: v.optional(v.number()),
	positionSeconds: v.number(),
	listened: v.boolean(),
	answers: v.array(v.number()),
	error: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
};

export function validatePodcastScript(script: PodcastScript) {
	if (
		script.turns.length < 4 ||
		script.turns.length > 40 ||
		new Set(script.turns.map((turn) => turn.speaker)).size !== 2 ||
		script.turns.some((turn) => !turn.text.trim() || turn.text.length > 1800) ||
		script.turns.reduce((sum, turn) => sum + turn.text.length, 0) > 14000 ||
		script.questions.length !== 3 ||
		script.questions.some(
			(question) =>
				question.options.length !== 3 ||
				!Number.isInteger(question.correctIndex) ||
				question.correctIndex < 0 ||
				question.correctIndex > 2,
		)
	) {
		throw new Error("Invalid podcast script");
	}
	return script;
}
