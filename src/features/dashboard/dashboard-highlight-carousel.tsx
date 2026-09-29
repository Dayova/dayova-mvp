import { Children, isValidElement, type ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

const CARD_GAP = 12;
const HORIZONTAL_PADDING = 24;
const MIN_CARD_WIDTH = 280;
const MAX_CARD_WIDTH = 420;

function DashboardHighlightCarousel({ children }: { children: ReactNode }) {
	const { width } = useWindowDimensions();
	const cards = Children.toArray(children);
	const availableWidth = Math.max(width - HORIZONTAL_PADDING * 2, 0);
	const cardWidth = Math.min(
		Math.max(width - 72, MIN_CARD_WIDTH),
		availableWidth,
		MAX_CARD_WIDTH,
	);
	const cardsWidth =
		cardWidth * cards.length + CARD_GAP * Math.max(cards.length - 1, 0);
	const horizontalPadding = Math.max(
		HORIZONTAL_PADDING,
		(width - cardsWidth) / 2,
	);
	const snapInterval = cardWidth + CARD_GAP;

	return (
		<ScrollView
			accessibilityLabel="Deine Tagesübersicht"
			accessibilityHint="Wische nach links oder rechts, um zwischen den Übersichtskarten zu wechseln."
			contentInsetAdjustmentBehavior="never"
			decelerationRate="fast"
			directionalLockEnabled
			disableIntervalMomentum
			horizontal
			nestedScrollEnabled
			showsHorizontalScrollIndicator={false}
			snapToAlignment="start"
			snapToInterval={snapInterval}
			testID="dashboard-highlight-carousel"
			contentContainerStyle={{
				paddingHorizontal: horizontalPadding,
				paddingTop: 40,
				paddingBottom: 20,
				gap: CARD_GAP,
			}}
		>
			{cards.map((child, index) => (
				<View
					key={isValidElement(child) ? child.key : String(child)}
					className="min-h-72"
					style={{ width: cardWidth }}
					testID={`dashboard-highlight-card-${index}`}
				>
					{child}
				</View>
			))}
		</ScrollView>
	);
}

export { DashboardHighlightCarousel };
