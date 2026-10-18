import { type ReactNode, type RefObject, useState } from "react";
import { View, type ViewInstance } from "react-native";
import { CloseButton } from "~/components/ui/close-button";
import { Text } from "~/components/ui/text";
import { cn } from "~/lib/utils";

/** Compact chrome that gives genuinely crowded native text the full sheet width. */
export function DayovaSheetHeader({
	title,
	description,
	accessibleTitle,
	initialFocusRef,
	showCloseButton,
	closeAccessibilityLabel,
	onClose,
}: {
	title?: ReactNode;
	description?: ReactNode;
	accessibleTitle: string;
	initialFocusRef: RefObject<ViewInstance | null>;
	showCloseButton: boolean;
	closeAccessibilityLabel: string;
	onClose: () => void;
}) {
	const [fit, setFit] = useState({ text: "", needsFullWidth: false });
	const stacked = Boolean(title) && showCloseButton && fit.needsFullWidth;

	return (
		<View className="mb-6 gap-3" testID="dayova-sheet-header">
			{title || showCloseButton ? (
				<View
					className={cn(
						"gap-3",
						stacked ? "flex-col-reverse" : "flex-row items-start gap-4",
					)}
					testID="dayova-sheet-heading"
				>
					{title ? (
						<View
							ref={initialFocusRef}
							accessible
							accessibilityLabel={accessibleTitle}
							accessibilityRole="header"
							className={cn(
								"min-w-0",
								stacked || !showCloseButton
									? "w-full"
									: "min-h-12 flex-1 justify-center",
							)}
							collapsable={false}
							testID="dayova-sheet-title-row"
						>
							<Text
								accessible={false}
								accessibilityRole="header"
								className="font-poppins font-semibold text-body-1 text-text"
								onTextLayout={(event) => {
									const lines = event.nativeEvent.lines;
									// Compare rendered text, not ReactNode identity: inline JSX
									// may be recreated on every parent render. Ignore whitespace
									// and discretionary hyphens affected by native line wrapping.
									const text = lines
										.map((line) => line.text)
										.join("")
										.replace(/[\s\u00ad]/g, "");
									const needsFullWidth =
										showCloseButton &&
										((text === fit.text && fit.needsFullWidth) ||
											(!stacked && lines.length > 2));
									if (
										text !== fit.text ||
										needsFullWidth !== fit.needsFullWidth
									) {
										setFit({ text, needsFullWidth });
									}
								}}
								testID="dayova-sheet-title-text"
							>
								{title}
							</Text>
						</View>
					) : null}
					{showCloseButton ? (
						<View
							className={cn(
								"shrink-0",
								stacked ? "self-end" : !title && "ml-auto",
							)}
							testID="dayova-sheet-close-control"
						>
							<CloseButton
								accessibilityLabel={closeAccessibilityLabel}
								onPress={onClose}
							/>
						</View>
					) : null}
				</View>
			) : null}
			{description ? (
				<Text className="font-poppins text-body-3 text-secondary-text">
					{description}
				</Text>
			) : null}
		</View>
	);
}
