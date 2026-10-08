/** Local preview data only; no Convex document or production API dependency. */
export type PodcastScript = {
	turns: { speaker: "Mira" | "Noah"; text: string }[];
	questions: {
		prompt: string;
		options: string[];
		correctIndex: number;
		explanation: string;
	}[];
};
