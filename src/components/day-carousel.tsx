import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

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
const DAY_WINDOW_RADIUS = 15;
const DAY_WINDOW_SIZE = DAY_WINDOW_RADIUS * 2 + 1;
const MAX_DAY_COUNT = DAY_WINDOW_SIZE * 3;
const MAX_CACHED_DAY_COUNT = DAY_WINDOW_SIZE * 7;
const DAY_ITEM_WIDTH = 59;
const DAY_ITEM_HEIGHT = 89;
const DAY_ITEM_GAP = 12;
const DAY_ITEM_STEP = DAY_ITEM_WIDTH + DAY_ITEM_GAP;

export type DayCarouselItem = {
  key: string;
  label: string;
  fullLabel: string;
  dayOfMonth: string;
  isToday: boolean;
};

export type DayCarouselRange = {
  startDayKey: string;
  endDayKey: string;
};

type DayCarouselProps = {
  centerDayKey?: string | null;
  centerRequestId: number;
  initialDayKey: string;
  onRangeChange: (range: DayCarouselRange) => void;
  onSelectedDayChange: (day: DayCarouselItem) => void;
  selectedDayKey: string;
};

export const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const getDayKey = (date: Date) => startOfLocalDay(date).toISOString();

export const parseDayKey = (dayKey?: string) => {
  if (!dayKey) return null;
  const parsed = new Date(dayKey);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
};

export const getDayItem = (date: Date, today: Date): DayCarouselItem => {
  const localDate = startOfLocalDay(date);
  const labelIndex = (localDate.getDay() + 6) % 7;

  return {
    key: getDayKey(localDate),
    label: WEEKDAY_LABELS[labelIndex],
    fullLabel: WEEKDAY_FULL_LABELS[labelIndex],
    dayOfMonth: `${localDate.getDate()}`,
    isToday: localDate.getTime() === today.getTime(),
  };
};

export const getDayItemFromKey = (dayKey: string, today: Date) =>
  getDayItem(parseDayKey(dayKey) ?? today, today);

const getDayRange = (startDate: Date, dayCount: number, today: Date) =>
  Array.from({ length: dayCount }, (_, index) =>
    getDayItem(addDays(startDate, index), today),
  );

export function DayCarousel({
  centerDayKey,
  centerRequestId,
  initialDayKey,
  onRangeChange,
  onSelectedDayChange,
  selectedDayKey,
}: DayCarouselProps) {
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const latestSelectedDayKey = useRef(selectedDayKey);
  const latestOffsetX = useRef(0);
  const hasHandledInitialLayout = useRef(false);
  const lastCenterRequestId = useRef(centerRequestId);
  const isLoadingPreviousDays = useRef(false);
  const isLoadingNextDays = useRef(false);
  const pressStartX = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [days, setDays] = useState(() => {
    const initialDate = parseDayKey(initialDayKey) ?? today;
    return getDayRange(
      addDays(initialDate, -DAY_WINDOW_SIZE - DAY_WINDOW_RADIUS),
      MAX_DAY_COUNT,
      today,
    );
  });
  const sidePadding = Math.max((viewportWidth - DAY_ITEM_STEP) / 2, 0);

  const selectedIndex = useMemo(() => {
    const index = days.findIndex((day) => day.key === selectedDayKey);
    return index < 0 ? DAY_WINDOW_SIZE + DAY_WINDOW_RADIUS : index;
  }, [days, selectedDayKey]);

  const snapOffsets = useMemo(
    () => days.map((_, index) => index * DAY_ITEM_STEP),
    [days],
  );

  const scrollToDayIndex = (index: number, animated: boolean) => {
    const offsetX = index * DAY_ITEM_STEP;
    latestOffsetX.current = offsetX;
    scrollViewRef.current?.scrollTo({
      x: offsetX,
      animated,
    });
  };

  const scrollToOffset = (offsetX: number, animated: boolean) => {
    const boundedOffsetX = Math.max(offsetX, 0);
    latestOffsetX.current = boundedOffsetX;
    scrollViewRef.current?.scrollTo({
      x: boundedOffsetX,
      animated,
    });
  };

  const notifySelectedDay = (day: DayCarouselItem) => {
    if (day.key === latestSelectedDayKey.current) return;

    latestSelectedDayKey.current = day.key;
    onSelectedDayChange(day);
  };

  useEffect(() => {
    latestSelectedDayKey.current = selectedDayKey;
  }, [selectedDayKey]);

  useEffect(() => {
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    if (!firstDay || !lastDay) return;

    onRangeChange({
      startDayKey: firstDay.key,
      endDayKey: lastDay.key,
    });
  }, [days, onRangeChange]);

  useEffect(() => {
    if (lastCenterRequestId.current === centerRequestId || !centerDayKey) {
      return;
    }

    lastCenterRequestId.current = centerRequestId;
    const centerDate = parseDayKey(centerDayKey) ?? today;
    const existingIndex = days.findIndex(
      (day) => day.key === getDayKey(centerDate),
    );
    if (existingIndex >= 0) {
      scrollToDayIndex(existingIndex, true);
      return;
    }

    const nextDays = getDayRange(
      addDays(centerDate, -DAY_WINDOW_SIZE - DAY_WINDOW_RADIUS),
      MAX_DAY_COUNT,
      today,
    );
    setDays(nextDays);

    requestAnimationFrame(() => {
      scrollToDayIndex(DAY_WINDOW_SIZE + DAY_WINDOW_RADIUS, true);
    });
  }, [centerDayKey, centerRequestId, days, today]);

  const selectDay = (day: DayCarouselItem, index: number) => {
    notifySelectedDay(day);
    scrollToDayIndex(index, true);
  };

  const prependDays = () => {
    if (isLoadingPreviousDays.current) return;
    isLoadingPreviousDays.current = true;

    setDays((currentDays) => {
      const firstDay = currentDays[0];
      if (!firstDay) {
        isLoadingPreviousDays.current = false;
        return currentDays;
      }

      const firstDate = parseDayKey(firstDay.key) ?? today;
      const previousDays = getDayRange(
        addDays(firstDate, -DAY_WINDOW_SIZE),
        DAY_WINDOW_SIZE,
        today,
      );
      const combinedDays = [...previousDays, ...currentDays];
      const daysToTrim = Math.max(
        combinedDays.length - MAX_CACHED_DAY_COUNT,
        0,
      );
      const nextDays =
        daysToTrim > 0
          ? combinedDays.slice(0, combinedDays.length - daysToTrim)
          : combinedDays;
      const nextOffsetX =
        latestOffsetX.current + previousDays.length * DAY_ITEM_STEP;

      requestAnimationFrame(() => {
        scrollToOffset(nextOffsetX, false);
        isLoadingPreviousDays.current = false;
      });

      return nextDays;
    });
  };

  const appendDays = () => {
    if (isLoadingNextDays.current) return;
    isLoadingNextDays.current = true;

    setDays((currentDays) => {
      const lastDay = currentDays[currentDays.length - 1];
      if (!lastDay) {
        isLoadingNextDays.current = false;
        return currentDays;
      }

      const lastDate = parseDayKey(lastDay.key) ?? today;
      const nextAddedDays = getDayRange(
        addDays(lastDate, 1),
        DAY_WINDOW_SIZE,
        today,
      );
      const combinedDays = [...currentDays, ...nextAddedDays];
      const daysToTrim = Math.max(
        combinedDays.length - MAX_CACHED_DAY_COUNT,
        0,
      );
      const nextDays =
        daysToTrim > 0 ? combinedDays.slice(daysToTrim) : combinedDays;
      const nextOffsetX = latestOffsetX.current - daysToTrim * DAY_ITEM_STEP;

      requestAnimationFrame(() => {
        scrollToOffset(nextOffsetX, false);
        isLoadingNextDays.current = false;
      });
      return nextDays;
    });
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
      Math.abs(offsetX - nextIndex * DAY_ITEM_STEP) > 0.5
    ) {
      scrollToDayIndex(nextIndex, true);
    }

    notifySelectedDay(nextDay);
  };

  const updateScrollOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    latestOffsetX.current = offsetX;
  };

  const maintainWindowAfterSettle = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    latestOffsetX.current = contentOffset.x;
    const startThreshold = DAY_ITEM_STEP * 2;
    const endThreshold = DAY_ITEM_STEP * 2;

    if (contentOffset.x < startThreshold) {
      prependDays();
      return;
    }

    if (
      contentSize.width -
        layoutMeasurement.width -
        contentOffset.x <
      endThreshold
    ) {
      appendDays();
    }
  };

  const settleAndMaintainWindow = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    settleAtOffset(event.nativeEvent.contentOffset.x, false);
    maintainWindowAfterSettle(event);
  };

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
      <ScrollView
        ref={scrollViewRef}
        horizontal
        onLayout={(event) => {
          const nextViewportWidth = event.nativeEvent.layout.width;
          setViewportWidth((currentViewportWidth) =>
            Math.abs(currentViewportWidth - nextViewportWidth) < 1
              ? currentViewportWidth
              : nextViewportWidth,
          );

          if (hasHandledInitialLayout.current || nextViewportWidth <= 0) return;
          hasHandledInitialLayout.current = true;
          requestAnimationFrame(() => {
            scrollToDayIndex(selectedIndex, false);
          });
        }}
        onMomentumScrollEnd={settleAndMaintainWindow}
        onScroll={updateScrollOffset}
        onScrollEndDrag={(event) => {
          const velocityX = Math.abs(event.nativeEvent.velocity?.x ?? 0);
          const targetOffsetX = event.nativeEvent.targetContentOffset?.x;
          if (typeof targetOffsetX === "number") {
            settleAtOffset(targetOffsetX, false);
            return;
          }

          if (velocityX < 0.05) {
            settleAtOffset(event.nativeEvent.contentOffset.x, true);
            maintainWindowAfterSettle(event);
          }
        }}
        scrollEventThrottle={16}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        style={{ height: 116 }}
        contentContainerStyle={{
          alignItems: "center",
          minHeight: 116,
        }}
      >
        <View style={{ width: sidePadding }} />
        {days.map((day, index) => {
          const isSelected = day.key === selectedDayKey;
          return (
            <View
              key={day.key}
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

                  selectDay(day, index);
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
        })}
        <View style={{ width: sidePadding }} />
      </ScrollView>
    </View>
  );
}
