import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/ui/button";
import { SnapCarouselSelector } from "~/components/ui/snap-carousel-selector";
import { Text } from "~/components/ui/text";
import { useOnboarding } from "~/context/OnboardingContext";
import {
	formatOnboardingDuration,
	ONBOARDING_DURATION_OPTIONS,
} from "./onboarding-learning-times";
import { OnboardingSelect } from "./onboarding-select";

const CUSTOM = "custom";
const CHOICES = [...ONBOARDING_DURATION_OPTIONS.map(String), CUSTOM];
const HOURS = Array.from({ length: 20 }, (_, index) => String(index + 4));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index));
const unitFor = (value: string) =>
	value === "60"
		? "Stunde"
		: value === CUSTOM || Number(value) >= 60
			? "Stunden"
			: "Minuten";
const labelFor = (value: string) =>
	value === CUSTOM
		? "Mehr als 4 Stunden"
		: formatOnboardingDuration(Number(value));
const primaryLabelFor = (value: string) =>
	value === CUSTOM
		? ">4"
		: String(Number(value) < 60 ? Number(value) : Number(value) / 60).replace(
				".",
				",",
			);

export function StudyDurationAnswer() {
	const { answers, setAnswer } = useOnboarding();
	// Keep a restored legacy selection visible until the learner changes it.
	const [choices] = useState(() =>
		["10", "20"].includes(answers.studyTime)
			? [...ONBOARDING_DURATION_OPTIONS, Number(answers.studyTime)]
					.sort((a, b) => a - b)
					.map(String)
					.concat(CUSTOM)
			: CHOICES,
	);
	const [custom, setCustom] = useState(
		Number(answers.studyTime) > 240 || answers.studyTime === CUSTOM,
	);
	const initialMinutes =
		Number(answers.studyTime) > 240 ? Number(answers.studyTime) : 255;
	const [hours, setHours] = useState(String(Math.floor(initialMinutes / 60)));
	const [minutes, setMinutes] = useState(String(initialMinutes % 60));
	const selected = custom
		? CUSTOM
		: choices.includes(answers.studyTime)
			? answers.studyTime
			: "30";
	const selectedIndex = choices.indexOf(selected);
	const hasSelection = Boolean(answers.studyTime);
	useEffect(() => {
		if (
			answers.studyTime &&
			answers.studyTime !== CUSTOM &&
			Number(answers.studyTime) <= 240 &&
			!choices.includes(answers.studyTime)
		) {
			const nearest = ONBOARDING_DURATION_OPTIONS.reduce<number>(
				(closest, option) =>
					Math.abs(option - Number(answers.studyTime)) <
					Math.abs(closest - Number(answers.studyTime))
						? option
						: closest,
				30,
			);
			setAnswer("studyTime", String(nearest));
		}
	}, [answers.studyTime, choices, setAnswer]);
	const updateCustom = (nextHours: string, nextMinutes: string) => {
		setHours(nextHours);
		setMinutes(nextMinutes);
		const total = Number(nextHours) * 60 + Number(nextMinutes);
		setAnswer("studyTime", total > 240 ? String(total) : CUSTOM);
	};
	return (
		<View className="w-full items-center gap-4">
			<SnapCarouselSelector
				accessibilityLabel="Tägliche Lernzeit"
				accessibilityValue={
					hasSelection
						? labelFor(selected)
						: `${labelFor(selected)} Vorschau, noch nicht ausgewählt`
				}
				decrementLabel="Weniger Lernzeit"
				incrementLabel="Mehr Lernzeit"
				items={choices}
				selectedIndex={selectedIndex}
				getItemKey={(value) => value}
				getItemPrimaryLabel={primaryLabelFor}
				getItemSecondaryLabel={unitFor}
				getItemProgress={(_, index) => (index + 1) / choices.length}
				primaryLabel={primaryLabelFor(selected)}
				secondaryLabel={unitFor(selected)}
				progress={(selectedIndex + 1) / choices.length}
				onSelect={(value) => {
					setCustom(value === CUSTOM);
					if (value === CUSTOM) updateCustom(hours, minutes);
					else setAnswer("studyTime", value);
				}}
			/>
			{!hasSelection ? (
				<Button
					size="sm"
					accessibilityLabel="30 Minuten auswählen"
					onPress={() => setAnswer("studyTime", "30")}
				>
					<Text>30 Minuten auswählen</Text>
				</Button>
			) : null}
			{custom ? (
				<View className="w-full gap-3">
					<Text
						accessibilityRole="header"
						className="text-center font-semibold text-body-2 text-text"
					>
						Wie viele Stunden und Minuten?
					</Text>
					<OnboardingSelect
						accessibilityLabel="Lerndauer in Stunden"
						title="Stunden auswählen"
						testID="study-duration-hours"
						value={hours}
						options={HOURS}
						formatLabel={(value) => `${value} Stunden`}
						onChange={(value) => updateCustom(value, minutes)}
					/>
					<OnboardingSelect
						accessibilityLabel="Zusätzliche Minuten"
						title="Minuten auswählen"
						testID="study-duration-minutes"
						value={minutes}
						options={MINUTES}
						formatLabel={(value) =>
							`${value} ${value === "1" ? "Minute" : "Minuten"}`
						}
						onChange={(value) => updateCustom(hours, value)}
					/>
					{answers.studyTime === CUSTOM ? (
						<Text
							accessibilityRole="alert"
							className="text-center text-body-4 text-destructive"
						>
							Wähle mehr als 4 Stunden oder gehe zur Auswahl „4 Stunden“ zurück.
						</Text>
					) : null}
				</View>
			) : null}
			<Text className="text-center text-body-4 text-secondary-text">
				Du kannst deine Lernzeiten später jederzeit anpassen.
			</Text>
		</View>
	);
}
