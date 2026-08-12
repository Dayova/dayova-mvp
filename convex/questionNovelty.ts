const STOP_WORDS = new Set([
	"an",
	"auf",
	"aus",
	"bei",
	"das",
	"dem",
	"den",
	"der",
	"die",
	"ein",
	"eine",
	"einer",
	"einem",
	"einen",
	"für",
	"im",
	"in",
	"ist",
	"mit",
	"und",
	"unter",
	"von",
	"vor",
	"was",
	"wie",
	"zu",
	"zum",
	"zur",
]);

const canonicalToken = (token: string) => {
	const cleaned = token.replace(/^[.,]+|[.,]+$/g, "");
	if (/^\d+(?:[.,]\d+)?$/.test(cleaned)) return "<zahl>";
	if (/^(berechn|bestimm|ermittl)/.test(cleaned)) return "berechnen";
	if (/^(erklar|erklaer|beschreib|versteh)/.test(cleaned)) return "erklären";
	if (/^(nenn|benenn|gib)/.test(cleaned)) return "nennen";
	if (/^(vergleich|gegenuberstell|gegenueberstell)/.test(cleaned)) {
		return "vergleichen";
	}
	if (/^(begrund|begruend)/.test(cleaned)) return "begründen";
	return cleaned;
};

const normalizeQuestion = (question: string) =>
	question
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase("de")
		.replace(/[^a-z0-9äöüß.,]+/g, " ")
		.trim();

const distinctiveTokens = (question: string) =>
	new Set(
		normalizeQuestion(question)
			.split(/\s+/)
			.filter(Boolean)
			.filter((token) => !STOP_WORDS.has(token))
			.map(canonicalToken),
	);

export const areSemanticallyDuplicateQuestions = (
	left: string,
	right: string,
) => {
	const normalizedLeft = normalizeQuestion(left);
	const normalizedRight = normalizeQuestion(right);
	if (!normalizedLeft || !normalizedRight) return false;
	if (normalizedLeft === normalizedRight) return true;

	const leftTokens = distinctiveTokens(left);
	const rightTokens = distinctiveTokens(right);
	if (Math.min(leftTokens.size, rightTokens.size) < 2) return false;

	let overlap = 0;
	for (const token of leftTokens) {
		if (rightTokens.has(token)) overlap += 1;
	}
	const unionSize = new Set([...leftTokens, ...rightTokens]).size;
	const jaccard = overlap / unionSize;
	const containment = overlap / Math.min(leftTokens.size, rightTokens.size);
	return jaccard >= 0.72 || containment >= 0.88;
};
