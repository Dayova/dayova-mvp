import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { DayovaSheetFrame } from "~/components/ui/dayova-sheet-frame";
import { Text } from "~/components/ui/text";
import {
	getRunningUpdateInstallation,
	type RunningUpdateInstallation,
} from "~/lib/running-update-installation";

export function ReleaseInformationSheet({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
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
		["Version", Application.nativeApplicationVersion ?? unavailable],
		["Build", Application.nativeBuildVersion ?? unavailable],
		[
			"Letztes Update installiert",
			installation
				? new Intl.DateTimeFormat("de-DE", {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(installation.date)
				: unavailable,
		],
		["Kanal", Updates.channel ?? unavailable],
		["Runtime", Updates.runtimeVersion ?? unavailable],
		[
			"Quelle",
			Updates.isEmbeddedLaunch
				? "App-Bundle"
				: Updates.isEnabled
					? "OTA"
					: unavailable,
		],
		["Laufendes Update", Updates.updateId ?? unavailable],
		[
			"Notfallstart",
			Updates.isEmergencyLaunch
				? "Ja"
				: Updates.isEnabled
					? "Nein"
					: unavailable,
		],
	];

	return (
		<DayovaSheetFrame
			visible={visible}
			onClose={onClose}
			title="App-Informationen"
			scrollable
		>
			<View className="gap-4">
				{information.map(([label, value]) => (
					<View key={label} className="gap-1">
						<Text className="font-poppins text-body-4 text-secondary-text">
							{label}
						</Text>
						<Text selectable className="font-poppins text-body-3 text-text">
							{value}
						</Text>
						{label === "Letztes Update installiert" &&
						installation?.kind === "first-launch" ? (
							<Text className="font-poppins text-body-4 text-secondary-text">
								Erster Start mit diesem Update auf diesem Gerät.
							</Text>
						) : null}
					</View>
				))}
			</View>
		</DayovaSheetFrame>
	);
}
