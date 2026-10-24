import {
	type ComponentRef,
	createContext,
	type ReactNode,
	use,
	useRef,
	useState,
} from "react";
import { ScrollView, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { X } from "~/components/ui/icon";
import { SelectionOptionRow } from "~/components/ui/selection-option-row";
import { ActionSurface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";

const ChipWidthContext = createContext<number | undefined>(undefined);

/** Reveal appended choices and keep the viewport in bounds after removals. */
export function SearchSelectionRow({
	children,
	count,
	label,
}: {
	children: ReactNode;
	count: number;
	label: string;
}) {
	const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
	const previousCount = useRef(count);
	const offset = useRef(0);
	const [width, setWidth] = useState<number>();
	const reduceMotion = useReducedMotion();
	return (
		<ScrollView
			ref={scroll}
			horizontal
			accessibilityLabel={label}
			showsHorizontalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
			className="mt-1 grow-0"
			contentContainerStyle={{ alignItems: "center", gap: 8 }}
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			onScroll={(event) => {
				offset.current = event.nativeEvent.contentOffset.x;
			}}
			scrollEventThrottle={16}
			onContentSizeChange={(contentWidth) => {
				const added = count > previousCount.current;
				const removed = count < previousCount.current;
				previousCount.current = count;
				if (added) scroll.current?.scrollToEnd({ animated: !reduceMotion });
				else if (removed && width !== undefined) {
					// Android can retain the old offset after content shrinks, leaving
					// the remaining chips clipped or entirely outside the viewport.
					offset.current = Math.max(
						0,
						Math.min(offset.current, contentWidth - width),
					);
					scroll.current?.scrollTo({ x: offset.current, animated: false });
				}
			}}
		>
			<ChipWidthContext value={width}>{children}</ChipWidthContext>
		</ScrollView>
	);
}

export function SearchSelectionChip({
	title,
	onRemove,
	disabled = false,
}: {
	title: string;
	onRemove: () => void;
	disabled?: boolean;
}) {
	const { colors } = useDayovaTheme();
	const maxWidth = use(ChipWidthContext);
	return (
		<ActionSurface
			accessibilityRole="button"
			accessibilityLabel={`${title} entfernen`}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onRemove}
			style={{ maxWidth }}
			className="min-h-12 shrink-0 flex-row items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
		>
			<Text className="shrink font-poppins text-body-3 text-text">{title}</Text>
			<View accessible={false} importantForAccessibility="no-hide-descendants">
				<X size={16} color={colors.text} />
			</View>
		</ActionSurface>
	);
}

export function SearchSuggestion({
	title,
	detail,
	hint,
	selected,
	disabled,
	onPress,
	className,
	custom = false,
	customLabel,
}: {
	title: string;
	custom?: boolean;
	customLabel?: string;
	detail?: string;
	hint?: string;
	selected: boolean;
	disabled: boolean;
	onPress: () => void;
	className?: string;
}) {
	return (
		<SelectionOptionRow
			accessibilityRole="checkbox"
			accessibilityLabel={title}
			accessibilityHint={hint}
			selected={selected}
			disabled={disabled}
			onPress={onPress}
			className={className}
			label={
				custom
					? (customLabel ??
						(selected
							? `„${title}“ ausgewählt`
							: `„${title}“ als eigenes Thema hinzufügen`))
					: title
			}
			description={custom ? undefined : detail}
		/>
	);
}
