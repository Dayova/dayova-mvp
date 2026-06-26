import type { ComponentProps } from "react";
import {
	Modal,
	Pressable,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "~/components/ui/close-button";
import { ClipboardEdit, GraduationCap } from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import { DAYOVA_DESIGN_SYSTEM } from "~/lib/design-system";

type CreateType = "homework" | "exam";
type CreateTypeIcon = (
	props: ComponentProps<typeof ClipboardEdit>,
) => React.ReactElement;
type CreateTypeOptionProps = {
	icon: CreateTypeIcon;
	title: string;
	description: string;
	onPress: () => void;
	scale: number;
	width: number;
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

function CreateTypeOption({
	icon: Icon,
	title,
	description,
	onPress,
	scale,
	width,
}: CreateTypeOptionProps) {
	return (
		<TouchableOpacity
			accessibilityLabel={title}
			accessibilityRole="button"
			activeOpacity={0.86}
			onPress={onPress}
			className="flex-row items-center bg-card"
			style={{
				width,
				height: 96 * scale,
				borderRadius: 40 * scale,
				paddingHorizontal: 16 * scale,
				paddingVertical: 12 * scale,
				columnGap: 16 * scale,
				boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
			}}
		>
			<View
				className="items-center justify-center rounded-full bg-accent"
				style={{
					width: 48 * scale,
					height: 48 * scale,
					boxShadow:
						"0 2px 4px -2px rgba(24, 39, 75, 0.12), 0 4px 4px -2px rgba(24, 39, 75, 0.08)",
				}}
			>
				<Icon
					size={24 * scale}
					color={DAYOVA_DESIGN_SYSTEM.colors.primary}
					strokeWidth={1.5}
				/>
			</View>
			<View style={{ flex: 1, rowGap: 4 * scale }}>
				<Text
					className="font-poppins font-semibold text-foreground"
					style={{
						fontSize: 16 * scale,
						lineHeight: 24 * scale,
					}}
				>
					{title}
				</Text>
				<Text
					className="font-poppins text-muted-foreground"
					style={{
						fontSize: 12 * scale,
						lineHeight: 18 * scale,
					}}
				>
					{description}
				</Text>
			</View>
		</TouchableOpacity>
	);
}

export function CreateTypePickerModal({
	onRequestClose,
	onSelect,
	visible,
}: {
	onRequestClose: () => void;
	onSelect: (type: CreateType) => void;
	visible: boolean;
}) {
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const modalScale = clamp(width / 393, 0.88, 1);
	const modalOptionWidth = Math.min(width - 48 * modalScale, 345 * modalScale);
	const modalBottomPadding = Math.max(insets.bottom + 28 * modalScale, 42);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onRequestClose}
		>
			<View className="flex-1 justify-end">
				<Pressable
					className="absolute inset-0 bg-black/25"
					onPress={onRequestClose}
				/>
				<View
					className="bg-background"
					style={{
						width,
						borderTopLeftRadius: 40 * modalScale,
						borderTopRightRadius: 40 * modalScale,
						paddingTop: 24 * modalScale,
						paddingHorizontal: 24 * modalScale,
						paddingBottom: modalBottomPadding,
						boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
					}}
				>
					<View
						className="flex-row items-start justify-between gap-5"
						style={{ minHeight: 46 * modalScale }}
					>
						<View style={{ width: 311 * modalScale }}>
							<Text
								className="font-poppins font-semibold text-foreground"
								style={{
									fontSize: 16 * modalScale,
									lineHeight: 24 * modalScale,
								}}
							>
								Was möchtest du planen?
							</Text>
							<Text
								className="font-poppins text-muted-foreground"
								style={{
									fontSize: 12 * modalScale,
									lineHeight: 18 * modalScale,
								}}
							>
								Wähle aus, ob du Hausaufgaben eintragen oder einen Test
								erstellen möchtest.
							</Text>
						</View>
						<CloseButton
							accessibilityLabel="Auswahl schließen"
							onPress={onRequestClose}
						/>
					</View>

					<View
						className="items-center"
						style={{ marginTop: 12 * modalScale, rowGap: 24 * modalScale }}
					>
						<CreateTypeOption
							icon={GraduationCap}
							title="Neue Prüfung"
							description="Datum, Fach und Prüfungsart eintragen."
							scale={modalScale}
							width={modalOptionWidth}
							onPress={() => onSelect("exam")}
						/>
						<CreateTypeOption
							icon={ClipboardEdit}
							title="Neue Hausaufgabe"
							description="Fälligkeit, Fach und Lernzeit planen."
							scale={modalScale}
							width={modalOptionWidth}
							onPress={() => onSelect("homework")}
						/>
					</View>
				</View>
			</View>
		</Modal>
	);
}
