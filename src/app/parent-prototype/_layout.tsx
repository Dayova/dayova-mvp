import { Redirect } from "expo-router";
import { DayovaTabs } from "~/components/dayova-tabs";
export default function ParentTabs() {
	if (!__DEV__ || process.env.EXPO_PUBLIC_PARENT_PROTOTYPE !== "1")
		return <Redirect href="/" />;
	return <DayovaTabs settingsLabel="Mehr" />;
}
