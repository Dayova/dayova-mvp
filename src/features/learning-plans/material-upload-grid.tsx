import { useEffect, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import type { Id } from "#convex/_generated/dataModel";
import { FeedbackTouchableOpacity } from "~/components/ui/feedback-pressable";
import { Attachment, Plus, X } from "~/components/ui/icon";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { ActionSurface, Surface } from "~/components/ui/surface";
import { Text } from "~/components/ui/text";
import type { LearningPlanSnapshot } from "~/features/learning-plans/types";
import { useDayovaTheme } from "~/lib/theme";
import { formatFileSize } from "~/lib/upload-policy";
import { cn } from "~/lib/utils";

type Document = LearningPlanSnapshot["documents"][number];
export type LoadMaterialPreview = (args: {
	id: Id<"learningPlanDocuments">;
}) => Promise<string | null>;

function MaterialPreview({
	document,
	loadPreview,
}: {
	document: Document;
	loadPreview?: LoadMaterialPreview;
}) {
	const { colors } = useDayovaTheme();
	const [uri, setUri] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const isImage = document.fileType.startsWith("image/");

	// biome-ignore lint/correctness/useExhaustiveDependencies: An explicit retry must request a fresh protected URL.
	useEffect(() => {
		if (!isImage || !loadPreview) return;
		let active = true;
		void loadPreview({ id: document.id }).then(
			(url) => {
				if (!active) return;
				setUri(url);
				setFailed(!url);
			},
			() => {
				if (active) setFailed(true);
			},
		);
		return () => {
			active = false;
		};
	}, [document.id, isImage, loadPreview, attempt]);

	if (isImage && uri && !failed) {
		return (
			<Image
				accessible
				accessibilityLabel={`Vorschau: ${document.fileName}`}
				className="h-40 w-full"
				resizeMode="contain"
				source={{ uri }}
				onError={() => setFailed(true)}
			/>
		);
	}

	if (isImage && loadPreview && !failed) {
		return (
			<ActivityIndicator
				accessibilityLabel="Vorschau wird geladen"
				color={colors.primaryStrong}
			/>
		);
	}

	if (isImage && failed) {
		return (
			<ActionSurface
				accessibilityRole="button"
				accessibilityLabel={`Vorschau für ${document.fileName} erneut laden`}
				onPress={() => {
					setUri(null);
					setFailed(false);
					setAttempt((value) => value + 1);
				}}
				className="min-h-12 items-center gap-2 bg-transparent px-3 py-3"
			>
				<Attachment size={28} color={colors.secondaryText} />
				<Text className="text-center text-body-4 text-secondary-text">
					Vorschau erneut laden
				</Text>
			</ActionSurface>
		);
	}

	const extension = document.fileName.split(".").pop();
	return (
		<View className="items-center gap-3 px-4">
			<Attachment size={36} color={colors.secondaryText} />
			<Text className="font-semibold text-body-3 text-secondary-text">
				{document.fileType === "application/pdf"
					? "PDF"
					: extension && extension.length <= 5
						? extension.toUpperCase()
						: "Datei"}
			</Text>
		</View>
	);
}

type GridProps = {
	documents?: Document[];
	canUpload?: boolean;
	onOpenUpload?: () => void;
	onRemoveDocument?: (id: Id<"learningPlanDocuments">) => void;
	loadPreview?: LoadMaterialPreview;
	mode?: "screen" | "artwork";
};

/** One shared surface for the upload step and its decorative onboarding preview. */
export function MaterialUploadGrid({
	documents = [],
	canUpload = false,
	onOpenUpload,
	onRemoveDocument,
	loadPreview,
	mode = "screen",
}: GridProps) {
	const { colors } = useDayovaTheme();
	const { shouldStackInlineContent } = useContentSizeLayout();
	const artwork = mode === "artwork";
	const stacked = !artwork && shouldStackInlineContent;
	// The decorative phone shows the first row within its fixed artboard.
	const emptySlots = artwork ? 2 : Math.max(1, 4 - documents.length);
	const cellClass = stacked ? "w-full" : "w-1/2";

	return (
		<View className="mt-7">
			<View className="-mx-2 flex-row flex-wrap">
				{documents.map((document) => (
					<View key={document.id} className={cn("mb-4 px-2", cellClass)}>
						<Surface className="flex-1 overflow-hidden rounded-[24px] border border-border">
							<View className="min-h-40 items-center justify-center bg-light-2">
								<MaterialPreview
									document={document}
									loadPreview={loadPreview}
								/>
							</View>
							<View className="gap-1 px-3 pt-3 pb-4">
								<Text
									accessibilityLabel={document.fileName}
									numberOfLines={stacked ? undefined : 2}
									className="font-semibold text-body-4 text-text"
								>
									{document.fileName}
								</Text>
								<Text className="text-body-5 text-secondary-text">
									{formatFileSize(document.fileSizeBytes)}
								</Text>
							</View>
							<View className="absolute top-2 right-2">
								<FeedbackTouchableOpacity
									accessibilityRole="button"
									accessibilityHint="Entfernt dieses hochgeladene Material aus dem Lernplan."
									hitSlop={8}
									className="h-9 w-9 items-center justify-center rounded-full bg-card"
									accessibilityLabel={`${document.fileName} entfernen`}
									disabled={!canUpload}
									onPress={() => onRemoveDocument?.(document.id)}
								>
									<X size={16} color={colors.text} strokeWidth={2.3} />
								</FeedbackTouchableOpacity>
							</View>
						</Surface>
					</View>
				))}
				{["first", "second", "third", "fourth"]
					.slice(0, emptySlots)
					.map((slot, index) => {
						const content = (
							<Plus
								size={32}
								strokeWidth={2}
								color={
									index === 0 ? colors.primaryStrong : colors.secondaryText
								}
							/>
						);
						const tileClass = cn(
							"min-h-48 flex-1 items-center justify-center rounded-[24px] border border-dashed bg-transparent",
							index === 0
								? "border-primary-strong"
								: "border-secondary-text/50",
						);
						return (
							<View key={slot} className={cn("mb-4 px-2", cellClass)}>
								{artwork ? (
									<Surface className={tileClass}>{content}</Surface>
								) : (
									<ActionSurface
										accessibilityRole="button"
										accessibilityLabel={
											documents.length
												? "Weiteres Schulmaterial hinzufügen"
												: "Schulmaterial hinzufügen"
										}
										accessibilityHint="Öffnet Kamera, Galerie oder Dateien."
										accessibilityState={{ disabled: !canUpload }}
										disabled={!canUpload}
										onPress={() => onOpenUpload?.()}
										className={tileClass}
									>
										{content}
									</ActionSurface>
								)}
							</View>
						);
					})}
			</View>
			<Text
				allowFontScaling={!artwork}
				className="text-body-4 text-secondary-text"
			>
				Themenblatt, Arbeitsblätter oder Mitschriften
			</Text>
		</View>
	);
}
