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
	const programmaticTarget = useRef<number | null>(null);
	const listWidth = useRef(0);
	const height = Math.max(
		minimumHeight,
		...keys
			.slice(Math.max(0, index - 1), index + 2)
			.map((key) => heights[key] ?? 0),
	);
	useEffect(() => {
		if (!width) return;
		if (listWidth.current !== width) {
			// A new list mounts at initialScrollIndex. Ignore its setup offsets.
			listWidth.current = width;
			visibleIndex.current = index;
			programmaticTarget.current = index === 0 ? null : index;
			return;
		}
		if (visibleIndex.current === index) return;
		programmaticTarget.current = index;
		visibleIndex.current = index;
		list.current?.scrollToOffset({
			offset: index * width,
			animated: !reducedMotion,
		});
	}, [index, width, reducedMotion]);
	const selectOffset = (offset: number) => {
		const next = Math.max(
			0,
			Math.min(keys.length - 1, Math.round(offset / width)),
		);
		if (next === visibleIndex.current || !keys[next]) return;
		// Acknowledge before notifying the parent, including batched reversals.
		visibleIndex.current = next;
		onSelect(keys[next]);
	};
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
					scrollEventThrottle={16}
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
						programmaticTarget.current = null;
					}}
					onScroll={(event) => {
						const offset = event.nativeEvent.contentOffset.x;
						const target = programmaticTarget.current;
						if (target !== null) {
							if (Math.abs(offset - target * width) < 1) {
								programmaticTarget.current = null;
							}
							return;
						}
						// Accessibility, keyboard and pointer scrolls need no touch drag.
						selectOffset(offset);
					}}
					onMomentumScrollEnd={(event) => {
						// A native interruption may settle short of the requested target.
						programmaticTarget.current = null;
						selectOffset(event.nativeEvent.contentOffset.x);
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
