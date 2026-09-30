import {
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { FlatList, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { getAlignedSnapIndex } from "~/lib/snap-scroll";

const NATIVE_SCROLL_QUIET_MS = 120;

/** Native paging tracks the finger; a shared selected key synchronizes both strips. */
export function CalendarPager({
	keys,
	selectedKey,
	onSelect,
	onSettled,
	renderPage,
	minimumHeight,
	testID,
}: {
	keys: string[];
	selectedKey: string;
	/** Updates the visible selection at midpoint crossings without committing side effects. */
	onSelect: (key: string) => void;
	/** Commits native navigation after settlement; external selections own their commit. */
	onSettled?: (key: string) => void;
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
	const externalSelection = useRef<number | null>(null);
	const phase = useRef<"idle" | "dragging" | "decelerating">("idle");
	const nativeSettlement = useRef<ReturnType<typeof setTimeout> | null>(null);
	const cancelNativeSettlement = useCallback(() => {
		if (nativeSettlement.current !== null)
			clearTimeout(nativeSettlement.current);
		nativeSettlement.current = null;
	}, []);
	useEffect(() => {
		if (width <= 0 || keys.length === 0) cancelNativeSettlement();
		return cancelNativeSettlement;
	}, [cancelNativeSettlement, keys, width]);
	const [moving, setMoving] = useState(false);
	const listWidth = useRef(0);
	const height = Math.max(
		minimumHeight,
		...(moving
			? keys.slice(Math.max(0, index - 1), index + 2)
			: [keys[index]]
		).map((key) => heights[key] ?? 0),
	);
	useEffect(() => {
		if (!width) return;
		if (listWidth.current !== width) {
			cancelNativeSettlement();
			// A new list mounts at initialScrollIndex. Ignore its setup offsets.
			listWidth.current = width;
			visibleIndex.current = index;
			programmaticTarget.current = index === 0 ? null : index;
			externalSelection.current = index;
			phase.current = "idle";
			setHeights({});
			setMoving(false);
			return;
		}
		if (visibleIndex.current === index) return;
		cancelNativeSettlement();
		programmaticTarget.current = index;
		externalSelection.current = index;
		setMoving(!reducedMotion);
		visibleIndex.current = index;
		list.current?.scrollToOffset({
			offset: index * width,
			animated: !reducedMotion,
		});
	}, [index, width, reducedMotion, cancelNativeSettlement]);
	const selectOffset = useCallback(
		(offset: number) => {
			const next = Math.max(
				0,
				Math.min(keys.length - 1, Math.round(offset / width)),
			);
			if (next === visibleIndex.current || !keys[next]) return;
			// Acknowledge before notifying the parent, including batched reversals.
			visibleIndex.current = next;
			onSelect(keys[next]);
		},
		[keys, onSelect, width],
	);
	const settleOffset = useCallback(
		(offset: number) => {
			cancelNativeSettlement();
			const next = Math.max(
				0,
				Math.min(keys.length - 1, Math.round(offset / width)),
			);
			const external = externalSelection.current;
			programmaticTarget.current = null;
			externalSelection.current = external === next ? external : null;
			phase.current = "idle";
			setMoving(false);
			selectOffset(offset);
			if (keys[next] && external !== next) onSettled?.(keys[next]);
		},
		[cancelNativeSettlement, keys, onSettled, selectOffset, width],
	);
	const settleCurrentOffset = useRef(settleOffset);
	useLayoutEffect(() => {
		settleCurrentOffset.current = settleOffset;
	}, [settleOffset]);
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
						cancelNativeSettlement();
						programmaticTarget.current = null;
						externalSelection.current = null;
						phase.current = "dragging";
						setMoving(true);
					}}
					onScrollEndDrag={(event) => {
						phase.current = "decelerating";
						const offset = event.nativeEvent.contentOffset.x;
						if (getAlignedSnapIndex(offset, width, keys.length) === null)
							return;
						if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.01)
							settleOffset(offset);
						else {
							// Aligned releases can report velocity without starting momentum.
							cancelNativeSettlement();
							nativeSettlement.current = setTimeout(
								() => settleCurrentOffset.current(offset),
								NATIVE_SCROLL_QUIET_MS,
							);
						}
					}}
					onMomentumScrollBegin={() => {
						cancelNativeSettlement();
						phase.current = "decelerating";
					}}
					onScroll={(event) => {
						cancelNativeSettlement();
						const offset = event.nativeEvent.contentOffset.x;
						const target = programmaticTarget.current;
						if (target !== null) {
							if (Math.abs(offset - target * width) < 1) {
								programmaticTarget.current = null;
								setMoving(false);
							}
							return;
						}
						const aligned = getAlignedSnapIndex(offset, width, keys.length);
						if (externalSelection.current !== null) {
							if (aligned === externalSelection.current) return;
							// A new non-touch scroll can interrupt a completed command.
							externalSelection.current = null;
						}
						// Accessibility, keyboard and pointer scrolls need no touch drag.
						selectOffset(offset);
						setMoving(true);
						if (phase.current === "idle" && aligned !== null) {
							// Pointer/accessibility scrolling may have no native end event.
							// A crossed boundary alone is not proof that movement stopped.
							nativeSettlement.current = setTimeout(
								() => settleCurrentOffset.current(offset),
								NATIVE_SCROLL_QUIET_MS,
							);
						}
					}}
					onMomentumScrollEnd={(event) => {
						// A native interruption may settle short of the requested target.
						settleOffset(event.nativeEvent.contentOffset.x);
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
