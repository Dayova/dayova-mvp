export type RegistrationStage = "flow" | "verification" | "creating";

export type RegistrationStepKind =
	| "intro"
	| "range"
	| "fact"
	| "days"
	| "time"
	| "payoff"
	| "text"
	| "wheel";

type RegistrationBackContext = {
	activeIndex: number;
	isBusy: boolean;
	platform: string;
	stage: RegistrationStage;
	stepKind: RegistrationStepKind;
};

const HORIZONTAL_GESTURE_STEP_KINDS = new Set<RegistrationStepKind>([
	"intro",
	"range",
]);

export const shouldHandleRegistrationBack = (
	activeIndex: number,
	stage: RegistrationStage,
) => activeIndex > 0 || stage !== "flow";

export const shouldEnableRegistrationRouteBack = (
	activeIndex: number,
	stage: RegistrationStage,
	isBusy: boolean,
) => activeIndex === 0 && stage === "flow" && !isBusy;

export const shouldEnableRegistrationEdgeBack = ({
	activeIndex,
	isBusy,
	platform,
	stage,
	stepKind,
}: RegistrationBackContext) => {
	if (platform !== "ios" || isBusy || stage === "creating") return false;
	if (stage === "verification") return true;
	if (activeIndex === 0) return false;

	return !HORIZONTAL_GESTURE_STEP_KINDS.has(stepKind);
};

const REGISTRATION_EDGE_BACK_MIN_DISTANCE = 64;
const REGISTRATION_EDGE_BACK_MAX_DISTANCE = 92;
const REGISTRATION_EDGE_BACK_VIEWPORT_RATIO = 0.18;
const REGISTRATION_EDGE_BACK_MIN_VELOCITY = 760;

export const shouldCommitRegistrationEdgeBack = ({
	direction,
	translationX,
	velocityX,
	viewportWidth,
}: {
	direction: -1 | 1;
	translationX: number;
	velocityX: number;
	viewportWidth: number;
}) => {
	"worklet";
	const directionalTranslation = translationX * direction;
	const directionalVelocity = velocityX * direction;
	const distanceThreshold = Math.min(
		Math.max(
			viewportWidth * REGISTRATION_EDGE_BACK_VIEWPORT_RATIO,
			REGISTRATION_EDGE_BACK_MIN_DISTANCE,
		),
		REGISTRATION_EDGE_BACK_MAX_DISTANCE,
	);

	return (
		directionalTranslation >= distanceThreshold ||
		(directionalTranslation >= 28 &&
			directionalVelocity >= REGISTRATION_EDGE_BACK_MIN_VELOCITY)
	);
};
