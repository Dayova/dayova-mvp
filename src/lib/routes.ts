export const ROUTES = {
	home: "/home",
	settings: "/settings",
	learningTimes: "/learning-times",
	learningPlans: "/learning-plans",
	createExam: "/entry/new?type=exam",
	createHomework: "/entry/new?type=homework",
	createLearningPlan: "/learning-plans/new",
	createLearningPlanTopic: "/learning-plans/topic",
} as const;

export const withReturnTo = (path: string, returnTo?: string) =>
	returnTo
		? (`${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}` as const)
		: path;

export const getSafeReturnTo = (returnTo?: string) =>
	returnTo?.startsWith("/") && !returnTo.startsWith("//")
		? returnTo
		: undefined;
