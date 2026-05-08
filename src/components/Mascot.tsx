import { type FC, useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path, Rect } from "react-native-svg";

interface MascotProps {
	size?: number;
	pose?:
		| "default"
		| "curious"
		| "thinking"
		| "encouraging"
		| "celebrating"
		| "writing"
		| "secure"
		| "thumbs-up";
}

export const Mascot: FC<MascotProps> = ({ size = 120, pose = "default" }) => {
	const [floatAnim] = useState(() => new Animated.Value(0));
	const [moodAnim] = useState(() => new Animated.Value(0));

	useEffect(() => {
		const floatLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(floatAnim, {
					toValue: 1,
					duration: pose === "celebrating" ? 760 : 2100,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(floatAnim, {
					toValue: 0,
					duration: pose === "celebrating" ? 760 : 2100,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
			]),
		);
		const moodLoop = Animated.loop(
			Animated.sequence([
				Animated.timing(moodAnim, {
					toValue: 1,
					duration: 680,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(moodAnim, {
					toValue: 0,
					duration: 680,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
			]),
		);

		floatLoop.start();
		moodLoop.start();

		return () => {
			floatLoop.stop();
			moodLoop.stop();
		};
	}, [floatAnim, moodAnim, pose]);

	const translateY = floatAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [0, pose === "celebrating" ? -14 : -7],
	});
	const rotate = moodAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [
			pose === "thinking" ? "-4deg" : "-2deg",
			pose === "curious" || pose === "celebrating" ? "5deg" : "2deg",
		],
	});
	const scale = moodAnim.interpolate({
		inputRange: [0, 1],
		outputRange: [1, pose === "celebrating" ? 1.07 : 1.025],
	});

	return (
		<View
			className="items-center justify-center"
			style={{ height: size, width: size }}
		>
			<Animated.View
				style={{ transform: [{ translateY }, { rotate }, { scale }] }}
			>
				<Svg width={size} height={size} viewBox="0 0 120 120">
					<MoodEffects pose={pose} />
					<Body pose={pose} />
					<Arms pose={pose} />
					<Head pose={pose} />
					<Face pose={pose} />
					<Props pose={pose} />
				</Svg>
			</Animated.View>
		</View>
	);
};

function MoodEffects({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	if (pose === "celebrating") {
		return (
			<G>
				<Circle cx="18" cy="24" r="3" fill="#FFB02E" />
				<Circle cx="101" cy="28" r="2.5" fill="#3A7BFF" />
				<Path d="M28 15 L32 23 L23 22 Z" fill="#18A058" />
				<Path
					d="M88 17 L94 12 L99 19"
					stroke="#7C5CFF"
					strokeWidth="3"
					strokeLinecap="round"
					fill="none"
				/>
			</G>
		);
	}

	if (pose === "thinking" || pose === "curious") {
		return (
			<G>
				<Circle cx="91" cy="22" r="6" fill="#FFFFFF" />
				<Circle cx="103" cy="15" r="10" fill="#FFFFFF" />
				<Path
					d="M100 11 Q107 11 107 17 Q107 21 102 24 M102 29 L102 29"
					stroke="#3A7BFF"
					strokeWidth="3"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</G>
		);
	}

	return null;
}

function Body({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	const hoodie = pose === "secure" ? "#4D3AAE" : "#6043D8";

	return (
		<G>
			<Ellipse cx="60" cy="113" rx="36" ry="5" fill="#DDE7FF" opacity="0.7" />
			<Path
				d="M34 68 Q36 50 60 50 Q84 50 86 68 L91 105 Q74 113 60 113 Q46 113 29 105 Z"
				fill={hoodie}
			/>
			<Path
				d="M43 58 Q60 73 77 58 Q73 51 60 51 Q47 51 43 58Z"
				fill="#2F246B"
				opacity="0.55"
			/>
			<Path
				d="M48 69 Q51 77 56 83"
				stroke="#BDAFFF"
				strokeWidth="2"
				strokeLinecap="round"
				fill="none"
			/>
			<Path
				d="M72 69 Q69 77 64 83"
				stroke="#BDAFFF"
				strokeWidth="2"
				strokeLinecap="round"
				fill="none"
			/>
			<Circle cx="55" cy="85" r="2" fill="#BDAFFF" />
			<Circle cx="65" cy="85" r="2" fill="#BDAFFF" />
		</G>
	);
}

function Arms({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	if (pose === "celebrating") {
		return (
			<G>
				<Path
					d="M37 76 Q24 60 22 42"
					stroke="#6043D8"
					strokeWidth="10"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M83 76 Q96 58 99 40"
					stroke="#6043D8"
					strokeWidth="10"
					strokeLinecap="round"
					fill="none"
				/>
				<Circle cx="21" cy="40" r="6" fill="#F4A36B" />
				<Circle cx="100" cy="38" r="6" fill="#F4A36B" />
			</G>
		);
	}

	if (pose === "encouraging" || pose === "thumbs-up") {
		return (
			<G>
				<Path
					d="M34 79 Q22 83 17 96"
					stroke="#6043D8"
					strokeWidth="10"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M84 77 Q96 74 102 64"
					stroke="#6043D8"
					strokeWidth="10"
					strokeLinecap="round"
					fill="none"
				/>
				<Path
					d="M101 63 Q110 62 110 55 L110 51 Q110 48 106 48 L103 48 Q102 40 97 42 Q94 44 94 51"
					fill="#F4A36B"
				/>
			</G>
		);
	}

	return (
		<G>
			<Path
				d="M34 79 Q23 85 20 100"
				stroke="#6043D8"
				strokeWidth="10"
				strokeLinecap="round"
				fill="none"
			/>
			<Path
				d={pose === "writing" ? "M84 78 Q78 91 66 101" : "M84 78 Q96 82 101 96"}
				stroke="#6043D8"
				strokeWidth="10"
				strokeLinecap="round"
				fill="none"
			/>
			<Circle cx="20" cy="101" r="6" fill="#F4A36B" />
			<Circle
				cx={pose === "writing" ? 65 : 101}
				cy={pose === "writing" ? 101 : 97}
				r="6"
				fill="#F4A36B"
			/>
		</G>
	);
}

function Head({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	return (
		<G>
			<Circle cx="60" cy="44" r="27" fill="#F5A66E" />
			<Circle cx="35" cy="46" r="7" fill="#F39A63" />
			<Circle cx="85" cy="46" r="7" fill="#F39A63" />
			<Path
				d="M36 35 Q38 16 59 16 Q78 16 85 34 Q70 27 55 32 Q47 35 36 35Z"
				fill="#3A2017"
			/>
			<Path d="M38 30 Q45 14 59 21 Q52 27 38 30Z" fill="#5B3324" />
			<Path d="M52 25 Q61 7 73 23 Q63 27 52 25Z" fill="#6A3C2A" />
			<Path d="M66 25 Q83 14 86 36 Q76 30 66 25Z" fill="#4B2A1E" />
			<Path d="M29 45 Q30 35 37 29 Q35 44 40 55 Q32 54 29 45Z" fill="#2A1711" />
			{pose === "secure" ? (
				<Path
					d="M39 20 Q60 7 81 20"
					stroke="#DDE7FF"
					strokeWidth="3"
					strokeLinecap="round"
					fill="none"
					opacity="0.8"
				/>
			) : null}
		</G>
	);
}

function Face({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	const happy =
		pose === "encouraging" ||
		pose === "celebrating" ||
		pose === "thumbs-up" ||
		pose === "default";
	const focused = pose === "writing" || pose === "secure";

	return (
		<G>
			<Path
				d="M44 39 Q49 36 54 39"
				stroke="#2B170F"
				strokeWidth="3"
				strokeLinecap="round"
				fill="none"
			/>
			<Path
				d="M66 39 Q71 36 76 39"
				stroke="#2B170F"
				strokeWidth="3"
				strokeLinecap="round"
				fill="none"
			/>
			{happy ? (
				<>
					<Circle cx="50" cy="47" r="4.5" fill="#FFFFFF" />
					<Circle cx="70" cy="47" r="4.5" fill="#FFFFFF" />
					<Circle cx="51" cy="47" r="2.5" fill="#2B170F" />
					<Circle cx="71" cy="47" r="2.5" fill="#2B170F" />
					<Path
						d="M51 57 Q60 67 70 57"
						stroke="#2B170F"
						strokeWidth="3"
						strokeLinecap="round"
						fill="none"
					/>
				</>
			) : focused ? (
				<>
					<Path
						d="M46 47 Q50 45 54 47"
						stroke="#2B170F"
						strokeWidth="3"
						strokeLinecap="round"
						fill="none"
					/>
					<Path
						d="M66 47 Q70 45 74 47"
						stroke="#2B170F"
						strokeWidth="3"
						strokeLinecap="round"
						fill="none"
					/>
					<Path
						d="M54 59 Q60 62 66 59"
						stroke="#2B170F"
						strokeWidth="2.6"
						strokeLinecap="round"
						fill="none"
					/>
				</>
			) : (
				<>
					<Circle cx="50" cy="47" r="3.5" fill="#2B170F" />
					<Circle cx="70" cy="47" r="3.5" fill="#2B170F" />
					<Path
						d={
							pose === "thinking"
								? "M56 60 Q60 57 64 60"
								: "M55 58 Q60 62 65 58"
						}
						stroke="#2B170F"
						strokeWidth="2.6"
						strokeLinecap="round"
						fill="none"
					/>
				</>
			)}
			<Ellipse cx="43" cy="56" rx="4" ry="2.5" fill="#EF7C6E" opacity="0.35" />
			<Ellipse cx="77" cy="56" rx="4" ry="2.5" fill="#EF7C6E" opacity="0.35" />
		</G>
	);
}

function Props({ pose }: { pose: NonNullable<MascotProps["pose"]> }) {
	if (pose === "writing") {
		return (
			<G>
				<Rect x="34" y="96" width="48" height="13" rx="4" fill="#FFFFFF" />
				<Path
					d="M40 101 L60 101 M40 105 L56 105"
					stroke="#DDE7FF"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<Path
					d="M62 93 L75 105"
					stroke="#FFB02E"
					strokeWidth="4"
					strokeLinecap="round"
				/>
				<Path
					d="M75 105 L78 109"
					stroke="#2B170F"
					strokeWidth="2"
					strokeLinecap="round"
				/>
			</G>
		);
	}

	if (pose === "secure") {
		return (
			<G>
				<Rect x="83" y="88" width="22" height="16" rx="4" fill="#18A058" />
				<Path
					d="M88 88 L88 82 Q94 75 100 82 L100 88"
					stroke="#18A058"
					strokeWidth="4"
					strokeLinecap="round"
					fill="none"
				/>
				<Circle cx="94" cy="96" r="2" fill="#FFFFFF" />
			</G>
		);
	}

	return null;
}
