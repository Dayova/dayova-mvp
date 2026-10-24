import { v } from "convex/values";

export const wloTopicResult = v.object({
	topics: v.array(
		v.object({
			id: v.string(),
			title: v.string(),
			subjects: v.array(v.string()),
			isAdditional: v.boolean(),
		}),
	),
	truncated: v.boolean(),
});
