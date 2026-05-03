import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
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
  sidePadding: number;
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

const configureSelectionAnimation = () => {
  LayoutAnimation.configureNext({
    duration: 120,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
    },
  });
};

export function DayCarousel({
  centerDayKey,
  centerRequestId,
  initialDayKey,
  onRangeChange,
  onSelectedDayChange,
  selectedDayKey,
  sidePadding,
}: DayCarouselProps) {
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const listRef = useRef<FlatList<DayCarouselItem> | null>(null);
  const latestSelectedDayKey = useRef(selectedDayKey);
  const lastCenterRequestId = useRef(centerRequestId);
  const isLoadingPreviousDays = useRef(false);
  const isLoadingNextDays = useRef(false);
  const pressStartX = useRef<number | null>(null);
  const [days, setDays] = useState(() => {
    const initialDate = parseDayKey(initialDayKey) ?? today;
    return getDayRange(addDays(initialDate, -DAY_WINDOW_SIZE - DAY_WINDOW_RADIUS), MAX_DAY_COUNT, today);
  });

  const selectedIndex = useMemo(() => {
    const index = days.findIndex((day) => day.key === selectedDayKey);
    return index < 0 ? DAY_WINDOW_SIZE + DAY_WINDOW_RADIUS : index;
  }, [days, selectedDayKey]);
  const scrollToDayIndex = (index: number, animated: boolean) => {
    listRef.current?.scrollToOffset({
      offset: index * DAY_ITEM_STEP,
      animated,
    });
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
    const nextDays = getDayRange(
      addDays(centerDate, -DAY_WINDOW_SIZE - DAY_WINDOW_RADIUS),
      MAX_DAY_COUNT,
      today,
    );
    setDays(nextDays);

    requestAnimationFrame(() => {
      scrollToDayIndex(DAY_WINDOW_SIZE + DAY_WINDOW_RADIUS, true);
    });
  }, [centerDayKey, centerRequestId, today]);

  const selectDay = (day: DayCarouselItem, index: number) => {
    if (day.key !== latestSelectedDayKey.current) {
      configureSelectionAnimation();
      latestSelectedDayKey.current = day.key;
      onSelectedDayChange(day);
    }

    scrollToDayIndex(index, true);
  };

  const prependDays = () => {
    if (isLoadingPreviousDays.current) return;
    isLoadingPreviousDays.current = true;

    setDays((currentDays) => {
      const firstDay = currentDays[0];
      if (!firstDay) return currentDays;

      const firstDate = parseDayKey(firstDay.key) ?? today;
      const nextDays = getDayRange(
        addDays(firstDate, -DAY_WINDOW_SIZE),
        MAX_DAY_COUNT,
        today,
      );

      requestAnimationFrame(() => {
        const nextSelectedIndex = nextDays.findIndex(
          (day) => day.key === latestSelectedDayKey.current,
        );
        if (nextSelectedIndex >= 0) {
          scrollToDayIndex(nextSelectedIndex, false);
        }
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
      if (!lastDay) return currentDays;

      const firstKeptDay = currentDays[DAY_WINDOW_SIZE];
      const firstKeptDate = parseDayKey(firstKeptDay?.key) ?? today;
      const nextDays = getDayRange(firstKeptDate, MAX_DAY_COUNT, today);
      requestAnimationFrame(() => {
        const nextSelectedIndex = nextDays.findIndex(
          (day) => day.key === latestSelectedDayKey.current,
        );
        if (nextSelectedIndex >= 0) {
          scrollToDayIndex(nextSelectedIndex, false);
        }
        isLoadingNextDays.current = false;
      });
      return nextDays;
    });
  };

  const getBoundedDayIndexAtOffset = (offsetX: number) => {
    const nextIndex = Math.round(offsetX / DAY_ITEM_STEP);
    return Math.min(Math.max(nextIndex, 0), days.length - 1);
  };

  const settleAtOffset = (offsetX: number) => {
    const nextIndex = getBoundedDayIndexAtOffset(offsetX);
    const nextDay = days[nextIndex];
    if (!nextDay) return;

    if (nextDay.key !== latestSelectedDayKey.current) {
      configureSelectionAnimation();
      latestSelectedDayKey.current = nextDay.key;
      onSelectedDayChange(nextDay);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const startThreshold = DAY_ITEM_STEP * 4;
    const endThreshold = DAY_ITEM_STEP * 4;

    if (contentOffset.x < startThreshold) {
      prependDays();
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
        ref={listRef}
        data={days}
        horizontal
        keyExtractor={(day) => day.key}
        ListFooterComponent={<View style={{ width: sidePadding }} />}
        ListHeaderComponent={<View style={{ width: sidePadding }} />}
        onLayout={() => {
          requestAnimationFrame(() => {
            scrollToDayIndex(selectedIndex, false);
          });
        }}
        onMomentumScrollEnd={(event) => {
          settleAtOffset(event.nativeEvent.contentOffset.x);
        }}
        onScroll={handleScroll}
        onScrollEndDrag={(event) => {
          const velocityX = Math.abs(event.nativeEvent.velocity?.x ?? 0);
          if (velocityX < 0.05) {
            settleAtOffset(event.nativeEvent.contentOffset.x);
          }
        }}
        scrollEventThrottle={48}
        bounces={false}
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={DAY_ITEM_STEP}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: DAY_ITEM_STEP,
          offset: DAY_ITEM_STEP * index,
          index,
        })}
        extraData={selectedDayKey}
        style={{ height: 116 }}
        contentContainerStyle={{
          alignItems: "center",
          minHeight: 116,
        }}
        renderItem={({ item: day, index }) => {
          const isSelected = day.key === selectedDayKey;
          return (
            <View
              style={{
                width: DAY_ITEM_WIDTH,
                height: DAY_ITEM_HEIGHT,
                marginHorizontal: DAY_ITEM_GAP / 2,
                alignItems: "center",
                justifyContent: "flex-start",
                transform: [
                  { scale: isSelected ? 1.12 : 0.88 },
                  { translateY: isSelected ? 0 : 7 },
                ],
              }}
            >
              <Pressable
                className="h-full w-full items-center justify-start"
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
        }}
      />
    </View>
  );
}
