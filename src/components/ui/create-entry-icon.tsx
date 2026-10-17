import { Plus } from "~/components/ui/icon";
import { useDayovaTheme } from "~/lib/theme";

/** Shared blue glyph for the Today and plans header actions. */
export function CreateEntryIcon() {
	const { colors } = useDayovaTheme();
	return <Plus size={28} color={colors.primary} strokeWidth={1.8} />;
}
