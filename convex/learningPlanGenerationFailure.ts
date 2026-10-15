import { type Infer, v } from "convex/values";

export const contentGenerationFailureReasonValidator = v.union(
	v.literal("insufficientMaterial"),
	v.literal("materialProcessing"),
	v.literal("schedulingConstraints"),
	v.literal("generationProcessing"),
	v.literal("unknown"),
);

export type LearningPlanGenerationFailureReason = Infer<
	typeof contentGenerationFailureReasonValidator
>;

const errorCodeToReason: Record<string, LearningPlanGenerationFailureReason> = {
	insufficient_material: "insufficientMaterial",
	material_processing: "materialProcessing",
	scheduling_constraints: "schedulingConstraints",
	generation_processing: "generationProcessing",
	unknown: "unknown",
};

export const getLearningPlanGenerationFailureReason = (
	code: string | null,
): LearningPlanGenerationFailureReason =>
	code && Object.hasOwn(errorCodeToReason, code)
		? errorCodeToReason[code]
		: "unknown";
