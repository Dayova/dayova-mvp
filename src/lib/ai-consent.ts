const AI_CONSENT_VERSION = "2026-09-05.vertex-ai.v1";
const AI_CONSENT_PROVIDER = "Google Cloud Vertex AI";

const AI_CONSENT_REQUIRED_MESSAGE =
	"Bestätige zuerst die KI-Datenverarbeitung in den Einstellungen.";

type AiConsentStatus = "notSet" | "granted" | "declined" | "withdrawn";

type AiConsentSnapshot = {
	status: AiConsentStatus;
	version: string | null;
	updatedAt: number | null;
	grantedAt: number | null;
	hasCurrentConsent: boolean;
};

export type { AiConsentSnapshot, AiConsentStatus };
export { AI_CONSENT_PROVIDER, AI_CONSENT_REQUIRED_MESSAGE, AI_CONSENT_VERSION };
