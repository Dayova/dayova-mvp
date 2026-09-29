import { type ReactNode, useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/** Native paging tracks the finger; a shared selected key synchronizes both strips. */
export function CalendarPager({
	keys,
	selectedKey,
	onSelect,
	renderPage,
	minimumHeight,
	testID,
}: {
	keys: string[];
	selectedKey: string;
	onSelect: (key: string) => void;
	renderPage: (key: string) => ReactNode;
	minimumHeight: number;
	testID: string;
}) {
	const reducedMotion = useReducedMotion();
	const list = useRef<FlatList<string>>(null);
	const [width, setWidth] = useState(0);
	const [heights, setHeights] = useState<Record<string, number>>({});
	const index = Math.max(0, keys.indexOf(selectedKey));
	const visibleIndex = useRef(index);
	const dragging = useRef(false);
	const targetIndex = useRef(index);
	targetIndex.current = index;
	const height = Math.max(
		minimumHeight,
		...keys
			.slice(Math.max(0, index - 1), index + 2)
			.map((key) => heights[key] ?? 0),
	);
	useEffect(() => {
		if (!width || visibleIndex.current === index) return;
		dragging.current = false;
		visibleIndex.current = index;
		list.current?.scrollToOffset({
			offset: index * width,
			animated: !reducedMotion,
		});
	}, [index, width, reducedMotion]);
	return (
		<View
			onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
			testID={`${testID}-viewport`}
		>
			{width > 0 ? (
				<FlatList
					key={width}
					ref={list}
					testID={testID}
					data={keys}
					extraData={{ selectedKey, renderPage }}
					horizontal
					pagingEnabled
					directionalLockEnabled
					nestedScrollEnabled
					decelerationRate="fast"
					disableIntervalMomentum
					showsHorizontalScrollIndicator={false}
					initialScrollIndex={index}
					initialNumToRender={3}
					maxToRenderPerBatch={3}
					windowSize={3}
					keyExtractor={(key) => key}
					getItemLayout={(_, i) => ({
						index: i,
						length: width,
						offset: width * i,
					})}
					// Measured viewport/page height, not a fixed content-size cap.
					style={{ height }}
					onScrollBeginDrag={() => {
						dragging.current = true;
					}}
					onMomentumScrollEnd={(event) => {
						const next = Math.max(
							0,
							Math.min(
								keys.length - 1,
								Math.round(event.nativeEvent.contentOffset.x / width),
							),
						);
						if (!dragging.current) return;
						dragging.current = false;
						visibleIndex.current = next;
						if (next !== targetIndex.current && keys[next])
							onSelect(keys[next]);
					}}
					renderItem={({ item: key }) => (
						<View
							style={{
								width,
								minHeight: minimumHeight,
								alignSelf: "flex-start",
							}}
							accessibilityElementsHidden={key !== selectedKey}
							importantForAccessibility={
								key === selectedKey ? "auto" : "no-hide-descendants"
							}
							onLayout={(event) => {
								const nextHeight = event.nativeEvent.layout.height;
								setHeights((current) =>
									current[key] === nextHeight
										? current
										: { ...current, [key]: nextHeight },
								);
							}}
						>
							{renderPage(key)}
						</View>
					)}
				/>
			) : null}
		</View>
	);
}
