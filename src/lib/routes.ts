export const ROUTES = {
	home: "/home",
	settings: "/settings",
	learningTimes: "/learning-times",
	learningPlans: "/learning-plans",
	analytics: "/analyse",
	analyticsKnowledge: "/analyse/wissensstand",
	analyticsProblem: "/analyse/lernhuerde",
	analyticsNextStep: "/analyse/naechster-schritt",
	analyticsHistory: "/analyse/entwicklung",
	createExam: "/entry/new?type=exam",
	createHomework: "/entry/new?type=homework",
	createLearningPlan: "/learning-plans/new",
} as const;

export const withReturnTo = (path: string, returnTo?: string) =>
	returnTo
		? (`${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}` as const)
		: path;

export const getSafeReturnTo = (returnTo?: string) =>
	returnTo?.startsWith("/") && !returnTo.startsWith("//")
		? returnTo
		: undefined;
