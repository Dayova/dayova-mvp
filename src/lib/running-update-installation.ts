import * as Application from "expo-application";
import { File, Paths } from "expo-file-system";
import * as Updates from "expo-updates";
import { z } from "zod";

export type RunningUpdateInstallation = {
	date: Date;
	kind: "installation" | "first-launch";
};

const firstLaunchesSchema = z.record(z.string(), z.iso.datetime());
let installation: Promise<RunningUpdateInstallation | null> | undefined;

async function readInstallation(): Promise<RunningUpdateInstallation | null> {
	if (process.env.EXPO_OS === "web" || !Updates.isEnabled) return null;

	const launchedAt = new Date();
	if (process.env.EXPO_OS === "android" && Updates.isEmbeddedLaunch) {
		try {
			const date = await Application.getLastUpdateTimeAsync();
			if (Number.isFinite(date.getTime())) {
				return { date, kind: "installation" };
			}
		} catch {
			// Fall back to the first observed launch when the OS date is unavailable.
		}
	}

	if (!Updates.updateId) return null;

	try {
		const file = new File(Paths.document, "running-update-first-launches.json");
		const firstLaunches = file.exists
			? firstLaunchesSchema.parse(await file.json())
			: {};
		// A native build change must also be recognized when it runs the same OTA.
		const key = JSON.stringify([
			Application.nativeApplicationVersion,
			Application.nativeBuildVersion,
			Updates.runtimeVersion,
			Updates.updateId,
			Updates.isEmbeddedLaunch,
		]);
		const stored = firstLaunches[key];
		if (stored) return { date: new Date(stored), kind: "first-launch" };

		firstLaunches[key] = launchedAt.toISOString();
		await file.write(JSON.stringify(firstLaunches));
		return { date: launchedAt, kind: "first-launch" };
	} catch (error) {
		// Never substitute today's date for an unreadable installation history.
		console.warn("Unable to read or record running update installation", error);
		return null;
	}
}

/** Call at app startup, before the settings screen is opened. */
export function getRunningUpdateInstallation() {
	installation ??= readInstallation();
	return installation;
}
