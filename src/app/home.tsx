import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock3,
  ClipboardList,
  GraduationCap,
  Plus,
  UserRound,
  X,
} from "lucide-react-native";
import { useAuth } from "~/context/AuthContext";
import { Text as UiText } from "~/components/ui/text";
import { getDayEntriesMap, type DayEntry } from "../store/dayEntriesStore";

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
const ALL_DAY_TIME_LABEL = "Ganztägig";

type WeekDayItem = {
  key: string;
  label: string;
  fullLabel: string;
  dayOfMonth: string;
  isToday: boolean;
};

/**
 * Builds the current calendar week (Monday-Sunday) for the compact week view.
 */
const getCurrentWeek = (referenceDate: Date): WeekDayItem[] => {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const mondayOffset = (ref.getDay() + 6) % 7;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    date.setHours(0, 0, 0, 0);

    const isToday = date.getTime() === ref.getTime();

    return {
      key: date.toISOString(),
      label: WEEKDAY_LABELS[index],
      fullLabel: WEEKDAY_FULL_LABELS[index],
      dayOfMonth: `${date.getDate()}`,
      isToday,
    };
  });
};

/**
 * Converts a HH:mm time label into minutes to enable chronological sorting.
 */
const timeToMinutes = (timeLabel: string) => {
  if (timeLabel.trim().toLowerCase() === ALL_DAY_TIME_LABEL.toLowerCase()) {
    return 8 * 60;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
  if (!match) return Number.MAX_SAFE_INTEGER;

  return Number(match[1]) * 60 + Number(match[2]);
};

/**
 * Returns the hour portion of a HH:mm label.
 */
const getHourFromTimeLabel = (timeLabel: string) => {
  if (timeLabel.trim().toLowerCase() === "ganztägig") return 8;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
};

const isLearningSlotEntry = (entry: DayEntry) =>
  /lern/i.test(`${entry.kind ?? ""} ${entry.title}`);

const getSubjectFromEntry = (entry: DayEntry) => {
  const fromTitle = entry.title
    .replace(/\s*(Hausaufgabe|Test\/Klausur|Test|Klausur|Lernen|Lernslot)\s*$/i, "")
    .trim();
  if (fromTitle.length > 0) return fromTitle;
  if (!entry.kind) return "Allgemein";
  return entry.kind.replace(/\/Klausur/i, "").trim();
};

const getEntryLabel = (entry: DayEntry) => {
  const subject = getSubjectFromEntry(entry);
  if (isLearningSlotEntry(entry)) return `Lernen ${subject}`;
  const isTest = /test|klausur/i.test(`${entry.kind ?? ""} ${entry.title}`);
  return `${isTest ? "Test" : "HA"} ${subject}`;
};

const getEntryTimeLabel = (entry: DayEntry) => entry.time ?? ALL_DAY_TIME_LABEL;

const getLearningRangeLabel = (entry: DayEntry) => {
  const timeLabel = getEntryTimeLabel(entry);
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeLabel.trim());
  if (!match) return timeLabel;

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = startMinutes + (entry.durationMinutes ?? 45);
  const endHour = Math.floor((endMinutes % (24 * 60)) / 60);
  const endMinute = endMinutes % 60;
  return `${timeLabel} - ${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string; dayKey?: string }>();
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState<"calendar" | "profile">(
    "calendar",
  );
  const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
  const [navBarWidth, setNavBarWidth] = useState(0);
  const navIndicatorProgress = useRef(new Animated.Value(0)).current;
  const dayScrollX = useRef(new Animated.Value(0)).current;
  const dayScrollRef = useRef<ScrollView | null>(null);
  const hasAlignedInitialDay = useRef(false);
  const pendingProgrammaticDayIndex = useRef<number | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const weekDays = useMemo(() => getCurrentWeek(new Date()), []);
  const [selectedDayKey, setSelectedDayKey] = useState(
    () => weekDays.find((day) => day.isToday)?.key ?? weekDays[0]?.key ?? "",
  );
  const selectedDayIndex = useMemo(() => {
    const index = weekDays.findIndex((day) => day.key === selectedDayKey);
    return index < 0 ? 0 : index;
  }, [selectedDayKey, weekDays]);
  const entriesByDay = useMemo(() => getDayEntriesMap(), [params.refresh]);
  const selectedDay =
    weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[0];
  const selectedEntries = selectedDay
    ? (entriesByDay[selectedDay.key] ?? [])
    : [];
  const sortedSelectedEntries = useMemo(
    () =>
      [...selectedEntries].sort(
        (a, b) =>
          timeToMinutes(getEntryTimeLabel(a)) - timeToMinutes(getEntryTimeLabel(b)),
      ),
    [selectedEntries],
  );
  const selectedDateLabel = useMemo(() => {
    if (!selectedDay?.key) return "";

    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    })
      .format(new Date(selectedDay.key))
      .replace(/[.,]/g, "");
  }, [selectedDay?.key]);
  const entriesByHour = useMemo(() => {
    const grouped: Record<number, DayEntry[]> = {};
    sortedSelectedEntries.forEach((entry) => {
      const hour = getHourFromTimeLabel(getEntryTimeLabel(entry));
      if (hour === null) return;
      grouped[hour] = [...(grouped[hour] ?? []), entry];
    });
    return grouped;
  }, [sortedSelectedEntries]);
  const timelineHours = useMemo(() => {
    const entryHours = sortedSelectedEntries
      .map((entry) => getHourFromTimeLabel(getEntryTimeLabel(entry)))
      .filter((hour): hour is number => hour !== null);
    const startHour = Math.min(6, ...(entryHours.length ? entryHours : [6]));
    const endHour = Math.max(22, ...(entryHours.length ? entryHours : [22]));
    return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  }, [sortedSelectedEntries]);
  const DAY_ITEM_WIDTH = 59;
  const DAY_ITEM_HEIGHT = 89;
  const DAY_ITEM_GAP = 12;
  const DAY_ITEM_STEP = DAY_ITEM_WIDTH + DAY_ITEM_GAP;
  const daySidePadding = Math.max((screenWidth - DAY_ITEM_STEP) / 2, 0);
  const scrollToDayIndex = (index: number, animated: boolean) => {
    dayScrollRef.current?.scrollTo({ x: index * DAY_ITEM_STEP, animated });
  };
  const selectDayAtIndex = (index: number) => {
    const boundedIndex = Math.min(Math.max(index, 0), weekDays.length - 1);
    const nextDay = weekDays[boundedIndex];
    if (!nextDay) return;

    if (nextDay.key !== selectedDayKey) {
      setSelectedDayKey(nextDay.key);
    }
    pendingProgrammaticDayIndex.current = boundedIndex;
    scrollToDayIndex(boundedIndex, true);
  };
  const getEntryUrl = (entry: DayEntry) => {
    const dayLabel = selectedDay
      ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}`
      : "";
    const details: Array<[string, string]> = [
      ["title", entry.title],
      ["day", dayLabel],
    ];
    if (entry.kind) details.push(["kind", entry.kind]);
    if (entry.notes) details.push(["notes", entry.notes]);
    if (entry.examTypeLabel) details.push(["examType", entry.examTypeLabel]);
    if (entry.dueDateLabel) details.push(["dueDate", entry.dueDateLabel]);
    if (entry.plannedDateLabel) {
      details.push(["plannedDate", entry.plannedDateLabel]);
    }
    if (entry.durationMinutes) {
      details.push(["duration", `${entry.durationMinutes}`]);
    }
    if (entry.time) details.push(["time", entry.time]);
    const query = details
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    return `/entry/${encodeURIComponent(entry.id)}?${query}`;
  };
  const firstName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim().split(/\s+/)[0]
      : "du";

  const getCreateEntryUrl = (type: "homework" | "exam") =>
    `/entry/new?type=${type}&dayKey=${encodeURIComponent(selectedDay?.key ?? "")}&dayLabel=${encodeURIComponent(
      selectedDay ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}` : "",
    )}`;

  const selectCreateType = (type: "homework" | "exam") => {
    setShowCreateTypePicker(false);
    router.push(getCreateEntryUrl(type));
  };

  useEffect(() => {
    if (typeof params.dayKey === "string" && params.dayKey) {
      const nextIndex = weekDays.findIndex((day) => day.key === params.dayKey);
      setSelectedDayKey(params.dayKey);
      if (nextIndex >= 0) {
        requestAnimationFrame(() => {
          scrollToDayIndex(nextIndex, false);
        });
      }
    }
  }, [params.dayKey, weekDays]);

  useEffect(() => {
    Animated.spring(navIndicatorProgress, {
      toValue: activeNav === "calendar" ? 0 : 1,
      stiffness: 220,
      damping: 24,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [activeNav, navIndicatorProgress]);

  useEffect(() => {
    if (!hasAlignedInitialDay.current) return;

    requestAnimationFrame(() => {
      scrollToDayIndex(selectedDayIndex, false);
    });
  }, [screenWidth]);

  const settleCarouselAtOffset = (offsetX: number) => {
    const nextIndex = Math.round(offsetX / DAY_ITEM_STEP);
    const boundedIndex = Math.min(Math.max(nextIndex, 0), weekDays.length - 1);
    const nextDay = weekDays[boundedIndex];
    if (!nextDay) return;

    if (pendingProgrammaticDayIndex.current === boundedIndex) {
      pendingProgrammaticDayIndex.current = null;
    }

    if (nextDay.key !== selectedDayKey) {
      setSelectedDayKey(nextDay.key);
    }
  };

  return (
    <View
      className="flex-1 pt-16"
      style={{ backgroundColor: "#F5F3F6" }}
    >
      <StatusBar style="dark" />

      <View className="px-8">
        <View className="mt-[65px] mb-1 flex-row ml-9 items-center justify-between">
          <View>
            <Text className="text-text font-poppins font-medium text-22">
              Hi, {firstName} 👋
            </Text>
            <Text className="mt-1 text-text font-poppins font-bold text-16">
              {sortedSelectedEntries.length === 0
                ? "Keine Aufgaben"
                : `${sortedSelectedEntries.length} ${sortedSelectedEntries.length === 1 ? "Aufgabe" : "Aufgaben"}`}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="Benachrichtigungen öffnen"
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{
              marginLeft: -4,
            }}
          >
            <View
              className="h-[55px] w-[55px] mr-20 pl-0.5 items-center justify-center rounded-full"
              style={{
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.08)",
                shadowColor: "#000000",
                shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <Bell
                size={22}
                color="#1A1A1A"
                strokeWidth={2.3}
                style={{ marginLeft: -2 }}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-10">
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
            <Animated.ScrollView
              ref={dayScrollRef}
              horizontal
              bounces={false}
              removeClippedSubviews={false}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              snapToInterval={DAY_ITEM_STEP}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingHorizontal: daySidePadding,
                alignItems: "center",
              }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: dayScrollX } } }],
                {
                  useNativeDriver: true,
                },
              )}
              scrollEventThrottle={16}
              onLayout={() => {
                if (!hasAlignedInitialDay.current) {
                  scrollToDayIndex(selectedDayIndex, false);
                  hasAlignedInitialDay.current = true;
                }
              }}
              onMomentumScrollEnd={(event) => {
                settleCarouselAtOffset(event.nativeEvent.contentOffset.x);
              }}
            >
              {weekDays.map((day, index) => {
                const isSelected = index === selectedDayIndex;
                const inputRange = [
                  (index - 2) * DAY_ITEM_STEP,
                  (index - 1) * DAY_ITEM_STEP,
                  index * DAY_ITEM_STEP,
                  (index + 1) * DAY_ITEM_STEP,
                  (index + 2) * DAY_ITEM_STEP,
                ];
                const scale = dayScrollX.interpolate({
                  inputRange,
                  outputRange: [0.74, 0.88, 1.12, 0.88, 0.74],
                  extrapolate: "clamp",
                });
                const translateY = dayScrollX.interpolate({
                  inputRange,
                  outputRange: [14, 7, 0, 7, 14],
                  extrapolate: "clamp",
                });
                return (
                  <Animated.View
                    key={day.key}
                    style={{
                      width: DAY_ITEM_WIDTH,
                      height: DAY_ITEM_HEIGHT,
                      marginHorizontal: DAY_ITEM_GAP / 2,
                      alignItems: "center",
                      justifyContent: "flex-start",
                      transform: [{ scale }, { translateY }],
                    }}
                  >
                    <TouchableOpacity
                      className="h-full w-full items-center justify-start"
                      activeOpacity={0.85}
                      onPress={() => selectDayAtIndex(index)}
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
                        className={`mt-2 font-poppins ${isSelected ? "text-11 text-text/80" : "text-10 text-text/45"}`}
                        style={{ marginBottom: 6 }}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </Animated.ScrollView>
          </View>
        </View>
      </View>

      <View
        className="mt-14 flex-1 rounded-t-[36px] bg-white px-6 pt-6 pb-8"
        style={{
          shadowColor: "#000000",
          shadowOpacity: Platform.OS === "ios" ? 0.07 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -2 },
          elevation: 2,
        }}
      >
        <Text className="text-text font-poppins text-28 font-bold capitalize">
          {selectedDateLabel}
        </Text>

        <ScrollView
          className="mt-5 flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {timelineHours.map((hour, hourIndex) => {
            const hourEntries = entriesByHour[hour] ?? [];
            return (
              <View
                key={`hour-${hour}`}
                className={`${hourIndex === 0 ? "" : "mt-2"} flex-row`}
              >
                <View className="w-20 pt-1.5 pr-2">
                  <Text
                    className="font-poppins text-14 font-medium text-text/78"
                    style={{ marginLeft: 10 }}
                  >
                    {`${hour.toString().padStart(2, "0")}:00`}
                  </Text>
                </View>
                <View className="flex-1 pb-3">
                  <View
                    className="mb-2 mt-2 h-[2px] w-full rounded-full"
                    style={{
                      backgroundColor:
                        hourEntries.length > 0 ? "#3A7BFF" : "rgba(58,123,255,0.20)",
                    }}
                  />
                  {hourEntries.length > 0 ? (
                    hourEntries.map((entry, entryIndex) => (
                      (() => {
                        const isLearning = isLearningSlotEntry(entry);
                        return (
                          <View
                            key={entry.id}
                            className={`${entryIndex === 0 ? "" : "mt-2"} ml-4 rounded-[30px] px-4 py-3`}
                            style={{
                              backgroundColor: isLearning ? "rgba(246,178,122,0.2)" : "rgba(95,201,176,0.2)",
                            }}
                          >
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1 pr-3">
                                <Text
                                  className="font-poppins text-15 font-semibold text-[#1A1A1A]"
                                  style={{ marginLeft: 24 }}
                                >
                                  {getEntryLabel(entry)}
                                </Text>
                                <View className="mt-1 flex-row items-center">
                                  <Clock3
                                    size={12}
                                    color="#1A1A1A"
                                    strokeWidth={2.2}
                                    style={{ marginLeft: 24 }}
                                  />
                                  <Text className="ml-1.5 font-poppins text-12 text-[#1A1A1A]/85">
                                    {isLearning ? getLearningRangeLabel(entry) : getEntryTimeLabel(entry)}
                                  </Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                activeOpacity={0.86}
                                onPress={() => router.push(getEntryUrl(entry))}
                                accessibilityRole="button"
                                accessibilityLabel={`${entry.title} öffnen`}
                                className="mr-2 h-10 w-10 items-center justify-center rounded-full"
                                style={{ backgroundColor: "#5FC9B0" }}
                              >
                                <ArrowUpRight size={20} color="#FFFFFF" strokeWidth={2.4} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })()
                    ))
                  ) : <View className="h-6" />}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View
        className="absolute bottom-6 left-0 right-0 flex-row items-center justify-center"
        style={{
          shadowColor: "#6D6D6D",
          shadowOpacity: 0.23,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 6 },
          elevation: 1,
        }}
      >
        <View
          className="w-3/5 h-20 rounded-full overflow-hidden flex-row items-center justify-evenly"
          onLayout={(event) => setNavBarWidth(event.nativeEvent.layout.width)}
          style={{
            backgroundColor: "rgba(255,255,255)",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.1)",
            shadowColor: "#6D6D6D",
            shadowOpacity: 0.07,
            shadowRadius: 1,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <ExpoLinearGradient
            colors={["rgba(255,255,255,0.72)", "rgba(255,255,255,0.72)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: "50%",
              marginTop: -28,
              left: Math.max((navBarWidth - 160) / 3, 0),
              width: 80,
              height: 56,
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.58)",
              backgroundColor: "rgba(255,255,255,0.24)",
              transform: [
                {
                  translateX: navIndicatorProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max((navBarWidth - 160) / 3 + 80, 0)],
                  }),
                },
              ],
            }}
          >
            <ExpoLinearGradient
              colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0.14)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          </Animated.View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveNav("calendar")}
            className="w-20 h-[68px] rounded-full items-center justify-center pt-1"
          >
            <CalendarDays
              size={22}
              color="#1A1A1A"
              strokeWidth={2.3}
              style={{
                marginBottom: 3,
                shadowColor: "#979797",
                shadowOpacity: 0.35,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              }}
            />
            <Text
              className={`mt-0.5 font-poppins text-[11px] ${activeNav === "calendar" ? "font-bold" : "font-medium"}`}
              style={{
                color:
                  activeNav === "calendar" ? "#1A1A1A" : "rgba(26,26,26,0.82)",
              }}
            >
              Kalender
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveNav("profile")}
            className="w-20 h-[68px] rounded-full items-center justify-center pt-1"
          >
            <UserRound
              size={22}
              color="#1A1A1A"
              strokeWidth={2.2}
              style={{
                marginBottom: 3,
                shadowColor: "#979797",
                shadowOpacity: 0.35,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              }}
            />
            <Text
              className={`mt-0.5 font-poppins text-[11px] ${activeNav === "profile" ? "font-bold" : "font-medium"}`}
              style={{
                color:
                  activeNav === "profile" ? "#1A1A1A" : "rgba(26,26,26,0.82)",
              }}
            >
              Profil
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowCreateTypePicker(true)}
          className="ml-3 rounded-full items-center justify-center overflow-hidden"
          style={{
            width: 65,
            height: 65,
            backgroundColor: "rgba(58,123,255,0.48)",
            borderWidth: 2,
            borderColor: "rgba(255,255,255,0.72)",
            shadowColor: "#3A7BFF",
            shadowOpacity: 0.24,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <ExpoLinearGradient
            colors={["rgba(58,123,255,0.4)", "rgba(58,123,255,0.40)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.0)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.2)",
            }}
          />
          <Plus size={30} color="#FFFFFF" strokeWidth={2.6} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCreateTypePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateTypePicker(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/25"
            onPress={() => setShowCreateTypePicker(false)}
          />
          <View
            className="mx-5 mb-7 rounded-[32px] bg-white px-5 pt-5 pb-6"
            style={{
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              shadowColor: "#000000",
              shadowOpacity: 0.16,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <View className="mb-4 flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <UiText className="font-poppins text-24 font-bold text-text">
                  Was möchtest du planen?
                </UiText>
                <UiText className="mt-2 font-poppins text-14 text-text/65">
                  Wähle zuerst die Art aus.
                </UiText>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setShowCreateTypePicker(false)}
                className="h-10 w-10 items-center justify-center rounded-full bg-black/5"
              >
                <X size={18} color="#1A1A1A" strokeWidth={2.3} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              className="mb-3 min-h-[88px] flex-row items-center rounded-[24px] bg-primary px-5 py-4"
              onPress={() => selectCreateType("homework")}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20">
                <ClipboardList size={22} color="#FFFFFF" strokeWidth={2.2} />
              </View>
              <View className="ml-3 flex-1">
                <UiText className="font-poppins text-16 font-bold text-white">
                  Neue Hausaufgabe
                </UiText>
                <UiText className="mt-1 font-poppins text-12 text-white/78">
                  Fälligkeit, Fach und Lernzeit planen.
                </UiText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              className="min-h-[88px] flex-row items-center rounded-[24px] border border-black/10 bg-white px-5 py-4"
              onPress={() => selectCreateType("exam")}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/12">
                <GraduationCap size={23} color="#3A7BFF" strokeWidth={2.2} />
              </View>
              <View className="ml-3 flex-1">
                <UiText className="font-poppins text-16 font-bold text-text">
                  Neue Leistungskontrolle
                </UiText>
                <UiText className="mt-1 font-poppins text-12 text-text/58">
                  Datum, Fach und Prüfungsart eintragen.
                </UiText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
