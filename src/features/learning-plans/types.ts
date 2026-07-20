import type { Id } from "#convex/_generated/dataModel";

export type PickerTarget = "editDate" | "editStart" | "editEnd";

export type SessionPhase = "theory" | "practice" | "rehearsal";

export type SessionExecutionStatus =
	| "notStarted"
	| "started"
	| "completed"
	| "partiallyCompleted"
	| "missed"
	| "adjusted";

export type MissedReason =
	| "no_time"
	| "forgot"
	| "no_motivation"
	| "too_hard"
	| "too_big"
	| "unclear"
	| "other";

export type PlanSession = {
	id: Id<"learningPlanSessions">;
	phase: SessionPhase;
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	compositionVariant?: "control" | "split";
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	sortOrder: number;
	completed: boolean;
	executionStatus: SessionExecutionStatus;
	startedAt?: number;
	outcomeAt?: number;
	missedReason?: MissedReason;
	adjustedFromSessionId?: Id<"learningPlanSessions">;
};

type SessionContentItemKind =
	| "learnCard"
	| "multipleChoice"
	| "written"
	| "voice";

export type SessionAnswerRating = "notCorrect" | "partiallyCorrect" | "correct";

export type TheoryContent = {
	conceptTitle: string;
	question: string;
	explanation: string;
	keyPoints: string[];
	example: string;
	memoryCue: string;
	commonMistake: string;
};

export type SessionContentItem = {
	id: Id<"learningSessionContentItems">;
	sessionId: Id<"learningPlanSessions">;
	phase: SessionPhase;
	kind: SessionContentItemKind;
	title: string;
	prompt: string;
	front?: string;
	back?: string;
	explanation: string;
	idealAnswer: string;
	theoryContent?: TheoryContent;
	choices: Array<{ id: string; text: string }>;
	learningBlockIndex: number;
	topicId: string;
	questionAngle: string;
	coverageKey: string;
	estimatedSeconds: number;
	sortOrder: number;
};

export type SessionAnswerAttempt = {
	id: Id<"learningSessionAnswerAttempts">;
	itemId: Id<"learningSessionContentItems">;
	sessionId: Id<"learningPlanSessions">;
	selectedChoiceId?: string;
	answerText?: string;
	transcript?: string;
	rating: SessionAnswerRating;
	feedback: string;
	perfectAnswer: string;
	timeSpentSeconds?: number;
	createdAt: number;
};

type SessionAnalysis = {
	id: Id<"learningSessionAnalyses">;
	sessionId: Id<"learningPlanSessions">;
	strengths: string[];
	gaps: string[];
	recommendation: string;
	updatedAt: number;
};

export type LearningSessionContentSnapshot = {
	plan: {
		id: Id<"learningPlans">;
		subject: string;
		examTypeLabel: string;
		topicDescription: string;
	};
	session: {
		id: Id<"learningPlanSessions">;
		learningPlanId: Id<"learningPlans">;
		phase: SessionPhase;
		title: string;
		dateLabel: string;
		startTime: string;
		durationMinutes: number;
		compositionVariant: "control" | "split";
		goal: string;
		expectedOutcome: string;
		completed: boolean;
		executionStatus: SessionExecutionStatus;
	};
	praxisDurationSeconds: number | null;
	items: SessionContentItem[];
	attempts: SessionAnswerAttempt[];
	analysis: SessionAnalysis | null;
};

type LearningPlanDocument = {
	id: Id<"learningPlanDocuments">;
	fileName: string;
	fileType: string;
	fileSizeBytes: number;
};

export type UploadAsset = {
	uri: string;
	name: string;
	mimeType?: string | null;
	size?: number | null;
};

export type QuizQuestion = {
	id: string;
	prompt: string;
	targetInsight: string;
};

type LearningPlanAnswer = {
	id: Id<"learningPlanAnswers">;
	questionId: string;
	answer: string;
};

export type LearningPlanSnapshot = {
	plan: {
		id: Id<"learningPlans">;
		subject: string;
		examTypeLabel: string;
		examDateKey: string;
		examDateLabel: string;
		examTime?: string;
		durationMinutes: number;
		targetStudyMinutes?: number;
		topicDescription: string;
		notes?: string;
		status: "draft" | "questionsReady" | "generated" | "accepted";
		knowledgeQuestions: QuizQuestion[];
		sourceSummary?: string;
		topicMap: Array<{
			id: string;
			title: string;
			learningGoal: string;
			keywords: string[];
			priority: "high" | "medium" | "low";
		}>;
		insight?: {
			summary: string;
			strengths: string[];
			gaps: string[];
		};
		planningHint?: string;
		sessionCompositionVariant?: "control" | "split";
	};
	documents: LearningPlanDocument[];
	answers: LearningPlanAnswer[];
	sessions: PlanSession[];
};
