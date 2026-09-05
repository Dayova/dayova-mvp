import { redirectNativeIntentPath } from "~/lib/native-intent-redirect";

export function redirectSystemPath({
	path,
}: {
	path: string;
	initial: boolean;
}) {
	return redirectNativeIntentPath(path);
}
