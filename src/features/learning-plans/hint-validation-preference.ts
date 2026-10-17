import { applicationId } from "expo-application";
import Constants from "expo-constants";

export const isHintValidationAvailable =
	__DEV__ ||
	Constants.expoConfig?.extra?.internalHintValidation === true ||
	applicationId === "com.dayova.dev" ||
	applicationId === "com.dayova.validation" ||
	applicationId === "de.dayova.app-dev";
