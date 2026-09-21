import { Linking } from "react-native";
import { logDiagnosticError } from "./diagnostics";

export const openExternalUrl = async (url?: string) => {
	if (!url) return false;

	try {
		await Linking.openURL(url);
		return true;
	} catch (error) {
		logDiagnosticError("Unable to open external URL.", error, {
			source: "externalUrl.open",
			level: "warn",
		});
		return false;
	}
};
