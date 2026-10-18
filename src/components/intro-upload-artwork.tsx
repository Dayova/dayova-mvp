import { View } from "react-native";
import { IntroPhoneFrame } from "~/components/onboarding/intro-phone-frame";
import { Text } from "~/components/ui/text";
import {
	MaterialUploadActionCard,
	MaterialUploadStepLead,
} from "~/features/learning-plans/learning-plan-setup-steps";
export function IntroUploadArtwork({
	width = 345,
	height = 550,
}: {
	width?: number;
	height?: number;
}) {
	return (
		<IntroPhoneFrame
			width={width}
			height={height}
			testID="intro-upload-artwork"
		>
			<View className="mb-7">
				<View className="mb-3 flex-row justify-between">
					<Text
						allowFontScaling={false}
						className="font-poppins font-semibold text-body-3 text-text"
					>
						Lernplan erstellen
					</Text>
					<Text
						allowFontScaling={false}
						className="text-body-4 text-secondary-text"
					>
						70 %
					</Text>
				</View>
				<View className="h-2 rounded-full bg-primary/20">
					<View className="h-2 w-[70%] rounded-full bg-primary" />
				</View>
			</View>
			<MaterialUploadStepLead mode="artwork" />
			<MaterialUploadActionCard hasSchoolMaterial={false} mode="artwork" />
			<Text
				allowFontScaling={false}
				className="mt-4 font-poppins text-body-4 text-secondary-text"
			>
				Dein Lernplan-Entwurf bleibt gespeichert. Schulmaterial kannst du später
				ergänzen.
			</Text>
		</IntroPhoneFrame>
	);
}
