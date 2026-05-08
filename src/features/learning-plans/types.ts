import type { Id } from "#convex/_generated/dataModel";

export type PickerTarget = "editDate" | "editStart" | "editEnd";

export type SessionPhase = "theory" | "practice" | "rehearsal";

export type PlanSession = {
	id: Id<"learningPlanSessions">;
	phase: SessionPhase;
	title: string;
	dateKey: string;
	dateLabel: string;
	startTime: string;
	durationMinutes: number;
	goal: string;
	tasks: string[];
	expectedOutcome: string;
	sortOrder: number;
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
		examTime: string;
		durationMinutes: number;
		topicDescription: string;
		notes?: string;
		status: "draft" | "questionsReady" | "generated" | "accepted";
		knowledgeQuestions: QuizQuestion[];
		sourceSummary?: string;
		insight?: {
			summary: string;
			strengths: string[];
			gaps: string[];
		};
	};
	documents: LearningPlanDocument[];
	answers: LearningPlanAnswer[];
	sessions: PlanSession[];
};
