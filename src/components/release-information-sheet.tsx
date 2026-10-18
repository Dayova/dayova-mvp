import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import {
	Clock3,
	CloudDownload,
	Cpu,
	Package,
	Radio,
	Repeat,
	Shield,
	Tag,
} from "~/components/ui/icon";
import { Text } from "~/components/ui/text";
import {
	getRunningUpdateInstallation,
	type RunningUpdateInstallation,
} from "~/lib/running-update-installation";
import { useDayovaTheme } from "~/lib/theme";

export function ReleaseInformationSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const { colors } = useDayovaTheme();
	const [installation, setInstallation] =
		useState<RunningUpdateInstallation | null>(null);
	useEffect(() => {
		if (!visible) return;
		let active = true;
		void getRunningUpdateInstallation().then((value) => {
			if (active) setInstallation(value);
		});
		return () => {
			active = false;
		};
	}, [visible]);

	const unavailable = "Nicht verfügbar";
	// Read the running update, never an available or downloaded candidate.
	const information = [
		{
			label: "Version",
			value: Application.nativeApplicationVersion ?? unavailable,
			icon: Tag,
		},
		{
			label: "Build",
			value: Application.nativeBuildVersion ?? unavailable,
			icon: Package,
		},
		{
			label: "Letztes Update installiert",
			value: installation
				? new Intl.DateTimeFormat("de-DE", {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(installation.date)
				: unavailable,
			icon: Clock3,
			description:
				installation?.kind === "first-launch"
					? "Erster Start mit diesem Update auf diesem Gerät."
					: undefined,
		},
		{ label: "Kanal", value: Updates.channel ?? unavailable, icon: Radio },
		{
			label: "Runtime",
			value: Updates.runtimeVersion ?? unavailable,
			icon: Cpu,
		},
		{
			label: "Quelle",
			value: Updates.isEmbeddedLaunch
				? "App-Bundle"
				: Updates.isEnabled
					? "OTA"
					: unavailable,
			icon: CloudDownload,
		},
		{
			label: "Laufendes Update",
			value: Updates.updateId ?? unavailable,
			icon: Repeat,
		},
		{
			label: "Notfallstart",
			value: Updates.isEmergencyLaunch
				? "Ja"
				: Updates.isEnabled
					? "Nein"
					: unavailable,
			icon: Shield,
		},
	];

	return (
		<DayovaSheetFrame
			visible={visible}
			onClose={onClose}
			title="App-Informationen"
			scrollable
		>
			<View className="gap-4">
				{information.map(({ label, value, icon: Icon, description }) => (
					<View key={label} className="flex-row items-start gap-3">
						<View
							accessible={false}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"
						>
							<Icon size={20} color={colors.text} strokeWidth={2} />
						</View>
						<View className="min-w-0 flex-1 gap-1">
							<Text className="font-poppins text-body-4 text-secondary-text">
								{label}
							</Text>
							<Text selectable className="font-poppins text-body-3 text-text">
								{value}
							</Text>
							{description ? (
								<Text className="font-poppins text-body-4 text-secondary-text">
									{description}
								</Text>
							) : null}
						</View>
					</View>
				))}
			</View>
		</DayovaSheetFrame>
	);
}
