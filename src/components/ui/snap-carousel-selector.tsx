import { useCallback, useEffect, useRef } from "react";
import { type FlatList, useWindowDimensions, View } from "react-native";
import Animated, {
	interpolate,
	type SharedValue,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Text } from "~/components/ui/text";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const CAROUSEL_ITEM_WIDTH = 68;
const CAROUSEL_MAX_WIDTH = 360;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 40;
const MINIMUM_PROGRESS = 0.16;

type SnapCarouselSelectorBaseProps<Item> = {
	accessibilityLabel: string;
	accessibilityValue: string;
	decrementLabel: string;
	getItemKey: (item: Item) => string;
	incrementLabel: string;
	items: readonly Item[];
	onSelect: (item: Item) => void;
	selectedIndex: number;
};

type SnapCarouselValueBubbleProps = {
	primaryLabel: string;
	progress: number;
	secondaryLabel: string;
	showValueBubble?: true;
};

type SnapCarouselTickLabelProps<Item> = {
	progress?: never;
	primaryLabel?: never;
	renderItemLabel: (item: Item, index: number, isSelected: boolean) => string;
	secondaryLabel?: never;
	showValueBubble: false;
};

type SnapCarouselSelectorProps<Item> = SnapCarouselSelectorBaseProps<Item> &
	(SnapCarouselValueBubbleProps | SnapCarouselTickLabelProps<Item>);

function SnapCarouselSelector<Item>(props: SnapCarouselSelectorProps<Item>) {
	const {
		accessibilityLabel,
		accessibilityValue,
		decrementLabel,
		getItemKey,
		incrementLabel,
		items,
		onSelect,
		selectedIndex,
	} = props;
	const valueBubbleConfig =
		props.showValueBubble === false
			? null
			: {
					primaryLabel: props.primaryLabel,
					progress: props.progress,
					secondaryLabel: props.secondaryLabel,
				};
	const renderItemLabel =
		props.showValueBubble === false ? props.renderItemLabel : undefined;
	const { colors } = useDayovaTheme();
	const listRef = useRef<FlatList<Item>>(null);
	const { width } = useWindowDimensions();
	const carouselWidth = Math.min(width, CAROUSEL_MAX_WIDTH);
	const sidePadding = Math.max((carouselWidth - CAROUSEL_ITEM_WIDTH) / 2, 0);
	const lastIndex = Math.max(items.length - 1, 0);
	const safeSelectedIndex = Math.min(Math.max(selectedIndex, 0), lastIndex);
	const safeProgress =
		valueBubbleConfig === null
			? 0
			: Math.min(Math.max(valueBubbleConfig.progress, 0), 1);
	const showValueBubble = valueBubbleConfig !== null;
	const scrollX = useSharedValue(safeSelectedIndex * CAROUSEL_ITEM_WIDTH);

	const selectIndex = useCallback(
		(nextIndex: number, animated = true) => {
			const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
			const nextItem = items[clampedIndex];
			if (nextItem === undefined) return;

			onSelect(nextItem);
			listRef.current?.scrollToOffset({
				offset: clampedIndex * CAROUSEL_ITEM_WIDTH,
				animated,
			});
		},
		[items, lastIndex, onSelect],
	);

	useEffect(() => {
		scrollX.set(safeSelectedIndex * CAROUSEL_ITEM_WIDTH);
		listRef.current?.scrollToOffset({
			offset: safeSelectedIndex * CAROUSEL_ITEM_WIDTH,
			animated: false,
		});
	}, [safeSelectedIndex, scrollX]);

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollX.set(event.contentOffset.x);
		},
	});

	const handleScrollEnd = useCallback(
		(offsetX: number) => {
			const nextIndex = Math.min(
				Math.max(Math.round(offsetX / CAROUSEL_ITEM_WIDTH), 0),
				lastIndex,
			);
			if (nextIndex === safeSelectedIndex) return;
			const nextItem = items[nextIndex];
			if (nextItem !== undefined) onSelect(nextItem);
		},
		[items, lastIndex, onSelect, safeSelectedIndex],
	);

	const handleAccessibilityAction = ({
		nativeEvent,
	}: {
		nativeEvent: { actionName: string };
	}) => {
		if (nativeEvent.actionName === "increment") {
			selectIndex(safeSelectedIndex + 1);
		}
		if (nativeEvent.actionName === "decrement") {
			selectIndex(safeSelectedIndex - 1);
		}
	};

	return (
		<View className="w-full items-center">
			{showValueBubble ? (
				<View className="h-22 w-22 items-center justify-center rounded-full border-4 border-primary/20">
					<Svg
						width={88}
						height={88}
						// SVG geometry is not expressible through NativeWind classes.
						style={{ position: "absolute" }}
					>
						<Circle
							cx="44"
							cy="44"
							r="40"
							fill="transparent"
							stroke={colors.primary}
							strokeWidth="4"
							strokeLinecap="round"
							strokeDasharray={`${Math.max(MINIMUM_PROGRESS, safeProgress) * CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
							transform="rotate(-90 44 44)"
						/>
					</Svg>
					<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
						{valueBubbleConfig.primaryLabel}
					</Text>
					<Text className="-mt-1 text-center font-poppins font-semibold text-body-5 text-text">
						{valueBubbleConfig.secondaryLabel}
					</Text>
				</View>
			) : null}

			<View
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={{ text: accessibilityValue }}
				accessibilityActions={[
					{ name: "increment", label: incrementLabel },
					{ name: "decrement", label: decrementLabel },
				]}
				onAccessibilityAction={handleAccessibilityAction}
				className={cn(
					"justify-center",
					showValueBubble ? "mt-12 h-[92px]" : "h-[132px]",
				)}
				// The carousel width follows the current window width.
				style={{ width: carouselWidth }}
			>
				<Animated.FlatList
					ref={listRef}
					data={items}
					keyExtractor={getItemKey}
					horizontal
					bounces={false}
					decelerationRate="fast"
					snapToInterval={CAROUSEL_ITEM_WIDTH}
					snapToAlignment="start"
					showsHorizontalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={scrollHandler}
					onMomentumScrollEnd={(event) =>
						handleScrollEnd(event.nativeEvent.contentOffset.x)
					}
					onScrollEndDrag={(event) =>
						handleScrollEnd(event.nativeEvent.contentOffset.x)
					}
					getItemLayout={(_, index) => ({
						length: CAROUSEL_ITEM_WIDTH,
						offset: CAROUSEL_ITEM_WIDTH * index,
						index,
					})}
					contentContainerStyle={{
						// Centering the first and last runtime-sized items needs measured padding.
						paddingHorizontal: sidePadding,
						alignItems: "center",
					}}
					className="grow-0"
					renderItem={({ item, index }) => (
						<SnapCarouselTick
							index={index}
							itemWidth={CAROUSEL_ITEM_WIDTH}
							scrollX={scrollX}
							activeColor={colors.primary}
							inactiveColor={colors.border}
							inactiveLabelColor={colors.secondaryText}
							label={
								renderItemLabel?.(item, index, index === safeSelectedIndex)
							}
							selected={index === safeSelectedIndex}
						/>
					)}
				/>
			</View>
		</View>
	);
}

function SnapCarouselTick({
	activeColor,
	inactiveColor,
	index,
	itemWidth,
	inactiveLabelColor,
	label,
	scrollX,
	selected,
}: {
	activeColor: string;
	inactiveColor: string;
	index: number;
	inactiveLabelColor: string;
	itemWidth: number;
	label?: string;
	scrollX: SharedValue<number>;
	selected: boolean;
}) {
	const animatedStyle = useAnimatedStyle(() => {
		const distance = Math.abs(scrollX.get() / itemWidth - index);
		return {
			opacity: interpolate(distance, [0, 1, 2], [1, 0.82, 0.58], "clamp"),
			transform: [
				{
					scale: interpolate(distance, [0, 1, 2], [1, 0.82, 0.72], "clamp"),
				},
			],
		};
	});

	const barStyle = useAnimatedStyle(() => {
		const distance = Math.abs(scrollX.get() / itemWidth - index);
		return {
			width: interpolate(distance, [0, 1, 2], [7, 4, 3], "clamp"),
			height: interpolate(distance, [0, 1, 2], [72, 36, 28], "clamp"),
			backgroundColor: distance < 0.5 ? activeColor : inactiveColor,
		};
	});

	return (
		<Animated.View
			className={cn(
				"items-center justify-center",
				label ? "h-[118px]" : "h-[78px]",
			)}
			// Width and transform depend on the carousel geometry and animated position.
			style={[{ width: itemWidth }, animatedStyle]}
		>
			<View className="h-[78px] items-center justify-center">
				<Animated.View
					className="rounded-[3px]"
					// Reanimated computes the tick dimensions and active color while scrolling.
					style={barStyle}
				/>
			</View>
			{label ? (
				<Text
					className="mt-1 min-h-9 text-center font-poppins font-semibold text-body-5"
					numberOfLines={2}
					// The active label color follows the runtime theme.
					style={{ color: selected ? activeColor : inactiveLabelColor }}
				>
					{label}
				</Text>
			) : null}
		</Animated.View>
	);
}

export { SnapCarouselSelector };
