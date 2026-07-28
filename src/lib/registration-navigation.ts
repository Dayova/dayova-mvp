export type RegistrationStage = "flow" | "verification" | "creating";

export const shouldHandleRegistrationBack = (
	activeIndex: number,
	stage: RegistrationStage,
) => activeIndex > 0 || stage !== "flow";
