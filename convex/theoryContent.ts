import { type Infer, v } from "convex/values";

export const theoryContentValidator = v.object({
	conceptTitle: v.string(),
	question: v.string(),
	explanation: v.string(),
	keyPoints: v.array(v.string()),
	example: v.string(),
	memoryCue: v.string(),
	commonMistake: v.string(),
});

export type TheoryContent = Infer<typeof theoryContentValidator>;
