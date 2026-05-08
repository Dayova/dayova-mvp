export const startOfDay = (date: Date) => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
};

export const getDateKey = (date: Date) => startOfDay(date).toISOString();

export const parseDateKey = (value?: string) => {
	if (!value) return startOfDay(new Date());
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return startOfDay(new Date());
	return parsed;
};

export const formatDate = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(date);

export const formatDayOfMonth = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", { day: "numeric" }).format(date);

export const formatShortWeekday = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", { weekday: "short" })
		.format(date)
		.replace(".", "");

export const formatTime = (date: Date) =>
	new Intl.DateTimeFormat("de-DE", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

export const minutesFromTime = (time: string) => {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time);
	if (!match) return 17 * 60;
	return Number(match[1]) * 60 + Number(match[2]);
};

export const timeFromMinutes = (minutes: number) => {
	const normalized = ((minutes % 1440) + 1440) % 1440;
	const hour = Math.floor(normalized / 60);
	const minute = normalized % 60;
	return `${hour.toString().padStart(2, "0")}:${minute
		.toString()
		.padStart(2, "0")}`;
};

export const dateWithTime = (dateKey: string, time: string) => {
	const next = parseDateKey(dateKey);
	const minutes = minutesFromTime(time);
	next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return next;
};

export const getErrorMessage = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export const wait = (milliseconds: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const isUnauthenticatedError = (error: unknown) =>
	error instanceof Error && error.message.includes("Nicht authentifiziert");

export const retryOnceAfterAuthResume = async <TResult>(
	task: () => Promise<TResult>,
) => {
	try {
		return await task();
	} catch (error) {
		if (!isUnauthenticatedError(error)) {
			throw error;
		}

		await wait(700);
		return await task();
	}
};

export const getUploadFailureMessage = (
	provider: "convex" | "r2",
	response: Response,
	responseText: string,
) => {
	if (provider === "r2" && response.status === 403) {
		return [
			"Cloudflare R2 verweigert den Upload.",
			"Prüfe R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY, Schreibzugriff auf den Bucket aus R2_BUCKET_NAME und bei EU-Buckets R2_JURISDICTION=eu.",
		].join(" ");
	}

	const providerLabel = provider === "r2" ? "Cloudflare R2" : "Convex Storage";
	return `Upload zu ${providerLabel} ist fehlgeschlagen (${response.status} ${response.statusText})${
		responseText ? `: ${responseText.slice(0, 240)}` : "."
	}`;
};
