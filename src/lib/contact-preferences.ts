import { parsePhoneNumberFromString } from "libphonenumber-js/max";

// Retain historical wording here when a later version replaces this contract.
export const CONTACT_CONSENT_VERSION = "2026-10-21.contact.v1";
export const CONTACT_FEEDBACK_LABEL =
	"Das Dayova-Team darf mich per WhatsApp zu Feedbackgesprächen einladen und für diese Gespräche anrufen.";
export const CONTACT_NEWS_LABEL =
	"Ich möchte per WhatsApp Neuigkeiten zu Dayova erhalten.";
export const CONTACT_CONSENT_NOTICE =
	"Beides ist freiwillig und jederzeit in den Einstellungen widerrufbar. Deine Auswahl hat keinen Einfluss auf deinen Zugang zu Dayova.";

export type ContactChoice = {
	phone: string;
	feedback: boolean;
	news: boolean;
	version: string;
};
export type ContactPreferences = ContactChoice & {
	revision: number;
	updatedAt: number;
};
export const emptyContactChoice = (): ContactChoice => ({
	phone: "",
	feedback: false,
	news: false,
	version: CONTACT_CONSENT_VERSION,
});

export function normalizeContactPhone(input: string): string | null {
	if (input.length > 80) return null;
	// Accept a German national number or an explicit international prefix.
	const value = input.trim().replace(/^00/, "+");
	const parsed = parsePhoneNumberFromString(value, {
		defaultCountry: "DE",
		extract: false,
	});
	return parsed?.isValid() && !parsed.ext ? parsed.number : null;
}

export function contactChoiceError(choice: ContactChoice): string | null {
	if (!choice.feedback && !choice.news) return null;
	if (choice.version !== CONTACT_CONSENT_VERSION)
		return "Die Kontakthinweise wurden aktualisiert. Bitte wähle erneut aus.";
	return normalizeContactPhone(choice.phone)
		? null
		: "Bitte gib eine gültige Telefonnummer mit Ländervorwahl ein, zum Beispiel +49 1512 3456789.";
}

export function isContactChoice(value: unknown): value is ContactChoice {
	if (!value || typeof value !== "object") return false;
	return (
		"phone" in value &&
		typeof value.phone === "string" &&
		"feedback" in value &&
		typeof value.feedback === "boolean" &&
		"news" in value &&
		typeof value.news === "boolean" &&
		"version" in value &&
		typeof value.version === "string"
	);
}

/** Strip unused input before it reaches the account-bound recovery record or server. */
export function prepareContactChoice(choice: ContactChoice): ContactChoice {
	const error = contactChoiceError(choice);
	if (error) throw new Error(error);
	return {
		feedback: choice.feedback,
		news: choice.news,
		phone:
			choice.feedback || choice.news
				? (normalizeContactPhone(choice.phone) ?? "")
				: "",
		version: CONTACT_CONSENT_VERSION,
	};
}
