import { Stack } from "expo-router";
import { EntryDraftProvider } from "~/features/entries/entry-draft";

export default function EntryLayout() {
	return (
		<EntryDraftProvider>
			<Stack
				screenOptions={{
					headerShown: false,
					gestureEnabled: true,
					animation: "default",
				}}
			/>
		</EntryDraftProvider>
	);
}
