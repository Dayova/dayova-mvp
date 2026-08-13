import { useCallback, useEffect, useRef, useState } from "react";
import {
	type FlatList,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	interpolate,
	type SharedValue,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";
import { useContentSizeLayout } from "~/components/ui/portrait-content";
import { Text } from "~/components/ui/text";
import {
	getRangeValueBadgeSize,
	getRangeValueContentLayout,
} from "~/features/auth/auth-content-size-layout";
import { useDayovaTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

const CAROUSEL_ITEM_WIDTH = 68;
const CAROUSEL_MAX_WIDTH = 360;
const PROGRESS_RING_SIZE = 88;
const PROGRESS_RING_CENTER = PROGRESS_RING_SIZE / 2;
const PROGRESS_RING_RADIUS = 40;
const PROGRESS_RING_STROKE_WIDTH = 4;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;
const MINIMUM_PROGRESS = 0.16;

export const getSnapCarouselPreviewIndex = ({
	offsetX,
	itemWidth,
	lastIndex,
}: {
	offsetX: number;
	itemWidth: number;
	lastIndex: number;
}) =>
	Math.min(
		Math.max(Math.round(offsetX / Math.max(itemWidth, 1)), 0),
		lastIndex,
	);

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

type SnapCarouselValueBubbleProps<Item> = {
	getItemPrimaryLabel?: (item: Item, index: number) => string;
	getItemProgress?: (item: Item, index: number) => number;
	primaryLabel: string;
	progress: number;
	secondaryLabel: string;
	showValueBubble?: true;
};

type SnapCarouselTickLabelProps<Item> = {
	progress?: never;
	primaryLabel?: never;
	renderItemLabel?: (item: Item, index: number, isSelected: boolean) => string;
	secondaryLabel?: never;
	showValueBubble: false;
};

type SnapCarouselSelectorProps<Item> = SnapCarouselSelectorBaseProps<Item> &
	(SnapCarouselValueBubbleProps<Item> | SnapCarouselTickLabelProps<Item>);

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
					getItemPrimaryLabel: props.getItemPrimaryLabel,
					getItemProgress: props.getItemProgress,
				};
	const renderItemLabel =
		props.showValueBubble === false ? props.renderItemLabel : undefined;
	const hasTickLabels = renderItemLabel !== undefined;
	const { colors } = useDayovaTheme();
	const listRef = useRef<FlatList<Item>>(null);
	const { fontScale, width } = useWindowDimensions();
	const { shouldStackInlineContent, usableWidth } = useContentSizeLayout({
		requestedHorizontalPadding: 24,
	});
	const carouselWidth = Math.min(
		shouldStackInlineContent ? usableWidth : width,
		CAROUSEL_MAX_WIDTH,
	);
	const itemWidth = shouldStackInlineContent
		? Math.min(112, Math.max(CAROUSEL_ITEM_WIDTH, 52 * fontScale))
		: CAROUSEL_ITEM_WIDTH;
	const sidePadding = Math.max((carouselWidth - itemWidth) / 2, 0);
	const valueBadgeSize = getRangeValueBadgeSize({
		fontScale,
		shouldStackInlineContent,
	});
	const valueContentLayout = getRangeValueContentLayout(fontScale);
	const lastIndex = Math.max(items.length - 1, 0);
	const safeSelectedIndex = Math.min(Math.max(selectedIndex, 0), lastIndex);
	const safeProgress =
		valueBubbleConfig === null
			? 0
			: Math.min(Math.max(valueBubbleConfig.progress, 0), 1);
	const showValueBubble = valueBubbleConfig !== null;
	const scrollX = useSharedValue(safeSelectedIndex * itemWidth);
	const previewIndexOnUI = useSharedValue(safeSelectedIndex);
	const [previewIndex, setPreviewIndex] = useState(safeSelectedIndex);
	const safePreviewIndex = Math.min(Math.max(previewIndex, 0), lastIndex);
	const previewItem = items[safePreviewIndex];
	const previewPrimaryLabel =
		valueBubbleConfig !== null &&
		previewItem !== undefined &&
		valueBubbleConfig.getItemPrimaryLabel
			? valueBubbleConfig.getItemPrimaryLabel(previewItem, safePreviewIndex)
			: valueBubbleConfig?.primaryLabel;
	const previewProgress =
		valueBubbleConfig !== null &&
		previewItem !== undefined &&
		valueBubbleConfig.getItemProgress
			? valueBubbleConfig.getItemProgress(previewItem, safePreviewIndex)
			: valueBubbleConfig?.progress;
	const safePreviewProgress = Math.min(
		Math.max(previewProgress ?? safeProgress, 0),
		1,
	);

	const updatePreviewIndex = useCallback((nextIndex: number) => {
		setPreviewIndex((currentIndex) =>
			currentIndex === nextIndex ? currentIndex : nextIndex,
		);
	}, []);

	const selectIndex = useCallback(
		(nextIndex: number, animated = true) => {
			const clampedIndex = Math.min(Math.max(nextIndex, 0), lastIndex);
			const nextItem = items[clampedIndex];
			if (nextItem === undefined) return;

			onSelect(nextItem);
			listRef.current?.scrollToOffset({
				offset: clampedIndex * itemWidth,
				animated,
			});
		},
		[itemWidth, items, lastIndex, onSelect],
	);

	useEffect(() => {
		scrollX.set(safeSelectedIndex * itemWidth);
		previewIndexOnUI.set(safeSelectedIndex);
		listRef.current?.scrollToOffset({
			offset: safeSelectedIndex * itemWidth,
			animated: false,
		});
	}, [itemWidth, previewIndexOnUI, safeSelectedIndex, scrollX]);

	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			const nextOffset = event.contentOffset.x;
			scrollX.set(nextOffset);
			if (!showValueBubble) return;
			// Keep UI-thread arithmetic inside the worklet. Calling a normal JS helper
			// synchronously here crashes native Reanimated/Worklets while dragging.
			const nextPreviewIndex = Math.min(
				Math.max(Math.round(nextOffset / Math.max(itemWidth, 1)), 0),
				lastIndex,
			);
			if (nextPreviewIndex === previewIndexOnUI.get()) return;
			previewIndexOnUI.set(nextPreviewIndex);
			scheduleOnRN(updatePreviewIndex, nextPreviewIndex);
		},
	});

	const handleScrollEnd = useCallback(
		(offsetX: number) => {
			const nextIndex = Math.min(
				Math.max(Math.round(offsetX / itemWidth), 0),
				lastIndex,
			);
			if (nextIndex === safeSelectedIndex) return;
			const nextItem = items[nextIndex];
			if (nextItem !== undefined) onSelect(nextItem);
		},
		[itemWidth, items, lastIndex, onSelect, safeSelectedIndex],
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
				<View
					testID="snap-carousel-value-bubble"
					className="items-center justify-center rounded-full"
					style={{
						borderRadius: valueBadgeSize / 2,
						height: valueBadgeSize,
						width: valueBadgeSize,
					}}
				>
					<Svg
						testID="snap-carousel-progress-ring"
						width={valueBadgeSize}
						height={valueBadgeSize}
						viewBox="0 0 88 88"
						// SVG geometry is not expressible through NativeWind classes.
						style={StyleSheet.absoluteFill}
					>
						<Circle
							testID="snap-carousel-progress-track"
							cx={PROGRESS_RING_CENTER}
							cy={PROGRESS_RING_CENTER}
							r={PROGRESS_RING_RADIUS}
							fill="transparent"
							stroke={colors.primary}
							strokeOpacity={0.2}
							strokeWidth={PROGRESS_RING_STROKE_WIDTH}
						/>
						<Circle
							testID="snap-carousel-progress-arc"
							cx={PROGRESS_RING_CENTER}
							cy={PROGRESS_RING_CENTER}
							r={PROGRESS_RING_RADIUS}
							fill="transparent"
							stroke={colors.primary}
							strokeWidth={PROGRESS_RING_STROKE_WIDTH}
							strokeLinecap="round"
							strokeDasharray={`${Math.max(MINIMUM_PROGRESS, safePreviewProgress) * CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
							transform={`rotate(-90 ${PROGRESS_RING_CENTER} ${PROGRESS_RING_CENTER})`}
						/>
					</Svg>
					<View
						testID="snap-carousel-value-label"
						className="items-center justify-center"
						style={[
							StyleSheet.absoluteFill,
							{
								transform: [
									{ translateY: valueContentLayout.verticalOffset },
								],
							},
						]}
					>
						<Text className="text-center font-poppins font-semibold text-heading-2 text-text">
							{previewPrimaryLabel}
						</Text>
						<Text
							className="text-center font-poppins font-semibold text-body-5 text-text"
							style={{ marginTop: valueContentLayout.unitMarginTop }}
						>
							{valueBubbleConfig.secondaryLabel}
						</Text>
					</View>
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
					showValueBubble
						? shouldStackInlineContent
							? "mt-8 min-h-[112px]"
							: "mt-12 h-[92px]"
						: hasTickLabels
							? shouldStackInlineContent
								? "min-h-[168px]"
								: "h-[132px]"
							: "h-[92px]",
				)}
				// The carousel width follows the current window width.
				style={{ width: carouselWidth }}
			>
				<Animated.FlatList
					testID="snap-carousel-list"
					ref={listRef}
					data={items}
					keyExtractor={getItemKey}
					horizontal
					bounces={false}
					decelerationRate="fast"
					snapToInterval={itemWidth}
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
						length: itemWidth,
						offset: itemWidth * index,
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
							itemWidth={itemWidth}
							scrollX={scrollX}
							activeColor={colors.primary}
							inactiveColor={colors.border}
							inactiveLabelColor={colors.secondaryText}
							label={renderItemLabel?.(
								item,
								index,
								index === safeSelectedIndex,
							)}
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
				label ? "min-h-[118px]" : "h-[78px]",
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
