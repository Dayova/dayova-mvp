import { v } from "convex/values";

export const contactChoiceValidator = v.object({
	phone: v.string(),
	feedback: v.boolean(),
	news: v.boolean(),
	version: v.string(),
});
export const contactPreferencesValidator = contactChoiceValidator.extend({
	revision: v.number(),
	updatedAt: v.number(),
});
