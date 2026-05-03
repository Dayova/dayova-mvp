import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  addDays,
  getDayKey,
  parseDayKey,
  startOfLocalDay,
  useCurrentLocalDay,
} from "~/lib/day-key";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_FULL_LABELS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
const DAY_RANGE_RADIUS = 365;
const DAY_ITEM_WIDTH = 59;
const DAY_ITEM_HEIGHT = 89;
const DAY_ITEM_GAP = 12;
const DAY_ITEM_STEP = DAY_ITEM_WIDTH + DAY_ITEM_GAP;

export type DayCarouselItem = {
  key: string;
  accessibilityLabel: string;
  label: string;
  fullLabel: string;
  dayOfMonth: string;
};

export type DayCarouselHandle = {
  scrollToDay: (dayKey: string, animated?: boolean) => boolean;
};

type DayCarouselProps = {
  initialDayKey: string;
  onSelectedDayChange: (day: DayCarouselItem) => void;
  selectedDayKey: string;
};

type DayCellProps = {
  day: DayCarouselItem;
  index: number;
  isSelected: boolean;
  onSelect: (day: DayCarouselItem, index: number) => void;
};

export const getDayItem = (date: Date): DayCarouselItem => {
  const localDate = startOfLocalDay(date);
  const labelIndex = (localDate.getDay() + 6) % 7;

  return {
    key: getDayKey(localDate),
    accessibilityLabel: new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(localDate),
    label: WEEKDAY_LABELS[labelIndex],
    fullLabel: WEEKDAY_FULL_LABELS[labelIndex],
    dayOfMonth: `${localDate.getDate()}`,
  };
};

export const getDayItemFromKey = (dayKey: string, fallbackDate: Date) =>
  getDayItem(parseDayKey(dayKey) ?? fallbackDate);

const getDayRange = (startDate: Date, dayCount: number) =>
  Array.from({ length: dayCount }, (_, index) =>
    getDayItem(addDays(startDate, index)),
  );

const getCenteredOffset = (index: number) => index * DAY_ITEM_STEP;

const DayCell = memo(function DayCell({
  day,
  index,
  isSelected,
  onSelect,
}: DayCellProps) {
  const pressStartX = useRef<number | null>(null);

  return (
    <View
      style={{
        width: DAY_ITEM_STEP,
        height: DAY_ITEM_HEIGHT,
        alignItems: "center",
        justifyContent: "flex-start",
        transform: [
          { scale: isSelected ? 1.12 : 0.88 },
          { translateY: isSelected ? 0 : 7 },
        ],
      }}
    >
      <Pressable
        className="items-center justify-start"
        accessibilityRole="button"
        accessibilityLabel={day.accessibilityLabel}
        accessibilityState={{ selected: isSelected }}
        onPressIn={(event) => {
          pressStartX.current = event.nativeEvent.pageX;
        }}
        onPress={(event) => {
          const startX = pressStartX.current;
          pressStartX.current = null;
          if (
            typeof startX === "number" &&
            Math.abs(event.nativeEvent.pageX - startX) > 8
          ) {
            return;
          }

          onSelect(day, index);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 30,
          paddingTop: 2,
          paddingBottom: 22,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
          shadowColor: "#000000",
          shadowOpacity: Platform.OS === "ios" ? 0.05 : 0,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 0,
          height: DAY_ITEM_HEIGHT,
          width: DAY_ITEM_WIDTH,
        }}
      >
        <Text
          className={`font-poppins font-bold ${isSelected ? "text-20 text-white" : "text-16 text-text/70"}`}
          style={{
            marginTop: 5,
            width: isSelected ? 44 : 38,
            height: isSelected ? 44 : 38,
            borderRadius: 999,
            textAlign: "center",
            textAlignVertical: "center",
            lineHeight: isSelected ? 46 : 38,
            backgroundColor: isSelected
              ? "hsl(316.1 100% 64.9%)"
              : "transparent",
            overflow: "hidden",
          }}
        >
          {day.dayOfMonth}
        </Text>
        <Text
          className={`mt-2 font-poppins text-12 ${isSelected ? "text-text/80" : "text-text/45"}`}
          style={{ marginBottom: 6 }}
        >
          {day.label}
        </Text>
      </Pressable>
    </View>
  );
});

export const DayCarousel = forwardRef<DayCarouselHandle, DayCarouselProps>(
  function DayCarousel(
    { initialDayKey, onSelectedDayChange, selectedDayKey },
    ref,
  ) {
    const today = useCurrentLocalDay();
    const flatListRef = useRef<FlatList<DayCarouselItem> | null>(null);
    const latestSelectedDayKey = useRef(selectedDayKey);
    const hasHandledInitialLayout = useRef(false);
    const pendingScrollRequest = useRef<{
      animated: boolean;
      dayKey: string;
    } | null>(null);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [rangeAnchorKey, setRangeAnchorKey] = useState(() =>
      getDayKey(parseDayKey(initialDayKey) ?? today),
    );
    const rangeAnchorDate = useMemo(
      () => parseDayKey(rangeAnchorKey) ?? today,
      [rangeAnchorKey, today],
    );
    const days = useMemo(
      () =>
        getDayRange(
          addDays(rangeAnchorDate, -DAY_RANGE_RADIUS),
          DAY_RANGE_RADIUS * 2 + 1,
        ),
      [rangeAnchorDate],
    );
    const sidePadding = Math.max((viewportWidth - DAY_ITEM_STEP) / 2, 0);

    const selectedIndex = useMemo(() => {
      const index = days.findIndex((day) => day.key === selectedDayKey);
      return index < 0 ? DAY_RANGE_RADIUS : index;
    }, [days, selectedDayKey]);
    const snapOffsets = useMemo(
      () => days.map((_, index) => getCenteredOffset(index)),
      [days],
    );

    const getItemLayout = useMemo(
      () =>
        (
          _: ArrayLike<DayCarouselItem> | null | undefined,
          index: number,
        ) => ({
          index,
          length: DAY_ITEM_STEP,
          offset: sidePadding + DAY_ITEM_STEP * index,
        }),
      [sidePadding],
    );

    const scrollToDayIndex = (index: number, animated: boolean) => {
      flatListRef.current?.scrollToOffset({
        offset: getCenteredOffset(index),
        animated,
      });
    };

    const scrollToDayKey = (dayKey: string, animated = true) => {
      const targetDate = parseDayKey(dayKey);
      if (!targetDate) return false;

      const targetKey = getDayKey(targetDate);
      const index = days.findIndex((day) => day.key === targetKey);
      if (index < 0) {
        pendingScrollRequest.current = { animated, dayKey: targetKey };
        setRangeAnchorKey(targetKey);
        return true;
      }

      scrollToDayIndex(index, animated);
      return true;
    };

    const notifySelectedDay = (day: DayCarouselItem) => {
      if (day.key === latestSelectedDayKey.current) return;

      latestSelectedDayKey.current = day.key;
      onSelectedDayChange(day);
    };

    useImperativeHandle(
      ref,
      () => ({
        scrollToDay: scrollToDayKey,
      }),
      [days],
    );

    useEffect(() => {
      latestSelectedDayKey.current = selectedDayKey;
    }, [selectedDayKey]);

    useEffect(() => {
      const pendingScroll = pendingScrollRequest.current;
      if (!pendingScroll) return;

      const index = days.findIndex((day) => day.key === pendingScroll.dayKey);
      if (index < 0) return;

      pendingScrollRequest.current = null;
      requestAnimationFrame(() => {
        scrollToDayIndex(index, pendingScroll.animated);
      });
    }, [days]);

    const selectDay = (day: DayCarouselItem, index: number) => {
      notifySelectedDay(day);
      scrollToDayIndex(index, true);
    };

    const getBoundedDayIndexAtOffset = (offsetX: number) => {
      const nextIndex = Math.round(offsetX / DAY_ITEM_STEP);
      return Math.min(Math.max(nextIndex, 0), days.length - 1);
    };

    const settleAtOffset = (offsetX: number, shouldSnap: boolean) => {
      const nextIndex = getBoundedDayIndexAtOffset(offsetX);
      const nextDay = days[nextIndex];
      if (!nextDay) return;

      if (
        shouldSnap &&
        Math.abs(offsetX - getCenteredOffset(nextIndex)) > 0.5
      ) {
        scrollToDayIndex(nextIndex, true);
      }

      notifySelectedDay(nextDay);
    };

    const renderDay = ({ item, index }: ListRenderItemInfo<DayCarouselItem>) => (
      <DayCell
        day={item}
        index={index}
        isSelected={item.key === selectedDayKey}
        onSelect={selectDay}
      />
    );

    return (
      <View className="-mx-8 h-[116px]">
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -12,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 2,
          }}
        >
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 6,
              borderRightWidth: 6,
              borderBottomWidth: 8,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: "#979797",
              opacity: 0.55,
              transform: [{ rotate: "180deg" }],
            }}
          />
        </View>
        <FlatList
          ref={flatListRef}
          data={days}
          horizontal
          keyExtractor={(day) => day.key}
          renderItem={renderDay}
          getItemLayout={getItemLayout}
          extraData={selectedDayKey}
          initialNumToRender={15}
          maxToRenderPerBatch={12}
          removeClippedSubviews
          windowSize={5}
          onLayout={(event) => {
            const nextViewportWidth = event.nativeEvent.layout.width;
            setViewportWidth((currentViewportWidth) =>
              Math.abs(currentViewportWidth - nextViewportWidth) < 1
                ? currentViewportWidth
                : nextViewportWidth,
            );

            if (hasHandledInitialLayout.current || nextViewportWidth <= 0) {
              return;
            }

            hasHandledInitialLayout.current = true;
            requestAnimationFrame(() => {
              scrollToDayKey(initialDayKey, false) ||
                scrollToDayIndex(selectedIndex, false);
            });
          }}
          onMomentumScrollEnd={(
            event: NativeSyntheticEvent<NativeScrollEvent>,
          ) => {
            settleAtOffset(event.nativeEvent.contentOffset.x, false);
          }}
          onScrollEndDrag={(event) => {
            const velocityX = Math.abs(event.nativeEvent.velocity?.x ?? 0);
            const targetOffsetX = event.nativeEvent.targetContentOffset?.x;
            if (typeof targetOffsetX === "number") {
              settleAtOffset(targetOffsetX, false);
              return;
            }

            if (velocityX < 0.05) {
              settleAtOffset(event.nativeEvent.contentOffset.x, true);
            }
          }}
          scrollEventThrottle={16}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          snapToOffsets={snapOffsets}
          decelerationRate="fast"
          style={{ height: 116 }}
          ListHeaderComponent={<View style={{ width: sidePadding }} />}
          ListFooterComponent={<View style={{ width: sidePadding }} />}
          contentContainerStyle={{
            alignItems: "center",
            minHeight: 116,
          }}
        />
      </View>
    );
  },
);
