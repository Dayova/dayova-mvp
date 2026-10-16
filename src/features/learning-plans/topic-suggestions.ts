/** Matches complete entries without interpreting or rewriting the learner's scope. */
const topicKey = (value: string) =>
	value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

export function includesTopicSuggestion(description: string, title: string) {
	const key = topicKey(title);
	return description.split(/\r?\n/).some((line) => {
		const entry = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "");
		return (
			topicKey(entry) === key ||
			entry.split(/[,;]/).some((part) => topicKey(part) === key)
		);
	});
}

/** Appends a suggestion while preserving every character already entered. */
export function appendTopicSuggestion(description: string, title: string) {
	if (includesTopicSuggestion(description, title)) return description;
	const separator = description && !description.endsWith("\n") ? "\n" : "";
	return `${description}${separator}${title}`;
}
