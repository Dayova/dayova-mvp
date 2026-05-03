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
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { useConvexAuth, useQuery } from "convex/react";
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
import { api } from "#convex/_generated/api";
import { useAuth } from "~/context/AuthContext";
import {
  DayCarousel,
  type DayCarouselItem,
  type DayCarouselRange,
  getDayItem,
  getDayItemFromKey,
  getDayKey,
  parseDayKey,
  startOfLocalDay,
} from "~/components/day-carousel";
import { Text as UiText } from "~/components/ui/text";
import type { DayEntry } from "~/types/dayEntries";

const ALL_DAY_TIME_LABEL = "Ganztägig";

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

const isExamEntry = (entry: DayEntry) =>
  /leistungskontrolle|test|klausur|quiz|mündlich|muendlich/i.test(
    `${entry.kind ?? ""} ${entry.title}`,
  );

const getSubjectFromEntry = (entry: DayEntry) => {
  const fromTitle = entry.title
    .replace(
      /\s*(Hausaufgabe|Leistungskontrolle|Kurzkontrolle|Test\/Klausur|Test|Klausur Deutsch\/Kunst\/Fremdsprache|Klausur|Quiz|Mündliche Prüfung|Muendliche Pruefung|Praktische Prüfung|Praktische Pruefung|Komplexe Leistung|Abschlussprüfung HSA\/Quali\/RSA|Abschlusspruefung HSA\/Quali\/RSA|Vorabi Grundkurs|Vorabi Leistungskurs|Abitur Grundkurs schriftlich|Abitur Leistungskurs schriftlich|Lernen|Lernslot)\s*$/i,
      "",
    )
    .trim();
  if (fromTitle.length > 0) return fromTitle;
  if (!entry.kind) return "Allgemein";
  return entry.kind.replace(/\/Klausur/i, "").trim();
};

const getEntryLabel = (entry: DayEntry) => {
  const subject = getSubjectFromEntry(entry);
  if (isLearningSlotEntry(entry)) return `Lernen ${subject}`;
  return `${isExamEntry(entry) ? "LK" : "HA"} ${subject}`;
};

const getEntryTimeLabel = (entry: DayEntry) => entry.time ?? ALL_DAY_TIME_LABEL;
const getEntryDisplayTimeLabel = (entry: DayEntry) =>
  entry.time ??
  (entry.durationMinutes
    ? `${entry.durationMinutes} Min.`
    : ALL_DAY_TIME_LABEL);

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
  const params = useLocalSearchParams<{ dayKey?: string }>();
  const { user } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const [activeNav, setActiveNav] = useState<"calendar" | "profile">(
    "calendar",
  );
  const [showCreateTypePicker, setShowCreateTypePicker] = useState(false);
  const [isReturningToToday, setIsReturningToToday] = useState(false);
  const [navBarWidth, setNavBarWidth] = useState(0);
  const navIndicatorProgress = useRef(new Animated.Value(0)).current;
  const previousEntriesByDay = useRef<Record<string, DayEntry[]> | null>(null);
  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const todayKey = useMemo(() => getDayKey(today), [today]);
  const [centerRequestId, setCenterRequestId] = useState(0);
  const [centerDayKey, setCenterDayKey] = useState<string | null>(null);
  const initialDayKey = useMemo(() => {
    const initialDate =
      typeof params.dayKey === "string" ? parseDayKey(params.dayKey) : null;
    return getDayKey(initialDate ?? today);
  }, [params.dayKey, today]);
  const [selectedDayKey, setSelectedDayKey] = useState(initialDayKey);
  const [selectedDay, setSelectedDay] = useState<DayCarouselItem>(() =>
    getDayItemFromKey(initialDayKey, today),
  );
  const [dayRange, setDayRange] = useState<DayCarouselRange | null>(null);
  const entriesByDayResult = useQuery(
    api.dayEntries.listByDayRange,
    user && isConvexAuthenticated && dayRange ? dayRange : "skip",
  );
  useEffect(() => {
    if (!user) {
      previousEntriesByDay.current = null;
      return;
    }

    if (entriesByDayResult !== undefined) {
      previousEntriesByDay.current = entriesByDayResult;
    }
  }, [entriesByDayResult, user]);
  const entriesByDay = entriesByDayResult ?? previousEntriesByDay.current ?? {};
  const areEntriesLoading =
    Boolean(user) &&
    (!isConvexAuthenticated || entriesByDayResult === undefined);
  const isSelectedToday = selectedDayKey === todayKey;
  const selectedEntries = selectedDay
    ? (entriesByDay[selectedDay.key] ?? [])
    : [];
  const sortedSelectedEntries = useMemo(
    () =>
      [...selectedEntries].sort(
        (a, b) =>
          timeToMinutes(getEntryTimeLabel(a)) -
          timeToMinutes(getEntryTimeLabel(b)),
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
    return Array.from(
      { length: endHour - startHour + 1 },
      (_, index) => startHour + index,
    );
  }, [sortedSelectedEntries]);
  const selectDay = (day: DayCarouselItem) => {
    setSelectedDayKey(day.key);
    setSelectedDay(day);
  };
  const centerOnDay = (dayKey: string) => {
    setCenterDayKey(dayKey);
    setCenterRequestId((requestId) => requestId + 1);
  };
  const returnToToday = () => {
    if (isReturningToToday) return;

    setIsReturningToToday(true);
    selectDay(getDayItem(today, today));
    centerOnDay(todayKey);
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
  const taskSummary = areEntriesLoading
    ? "Aufgaben werden geladen"
    : sortedSelectedEntries.length === 0
      ? "Keine Aufgaben"
      : `${sortedSelectedEntries.length} ${
          sortedSelectedEntries.length === 1 ? "Aufgabe" : "Aufgaben"
        }`;

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
      const nextDate = parseDayKey(params.dayKey);
      if (!nextDate) return;

      const nextDayKey = getDayKey(nextDate);
      selectDay(getDayItem(nextDate, today));
      centerOnDay(nextDayKey);
    }
  }, [params.dayKey, today]);

  useEffect(() => {
    if (!isReturningToToday || selectedDayKey !== todayKey) return;

    const timeoutId = setTimeout(() => {
      setIsReturningToToday(false);
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [isReturningToToday, selectedDayKey, todayKey]);

  useEffect(() => {
    Animated.spring(navIndicatorProgress, {
      toValue: activeNav === "calendar" ? 0 : 1,
      stiffness: 220,
      damping: 24,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [activeNav, navIndicatorProgress]);

  return (
    <View className="flex-1 pt-16" style={{ backgroundColor: "#F5F3F6" }}>
      <StatusBar style="dark" />

      <View className="px-8">
        <View className="mt-[65px] mb-1 flex-row ml-9 items-center justify-between">
          <View>
            <Text className="text-text font-poppins text-20 font-medium">
              Hi, {firstName} 👋
            </Text>
            <Text className="mt-1 text-text font-poppins font-bold text-16">
              {taskSummary}
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
          <DayCarousel
            centerDayKey={centerDayKey}
            centerRequestId={centerRequestId}
            initialDayKey={initialDayKey}
            onRangeChange={setDayRange}
            onSelectedDayChange={selectDay}
            selectedDayKey={selectedDayKey}
          />
          {!isSelectedToday && !isReturningToToday ? (
            <View className="mt-1 items-center">
              <TouchableOpacity
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Zum heutigen Tag im Datumskarussell springen"
                onPressIn={returnToToday}
                className="flex-row items-center rounded-full bg-white px-5 py-3"
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(58,123,255,0.18)",
                  shadowColor: "#3A7BFF",
                  shadowOpacity: Platform.OS === "ios" ? 0.12 : 0,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                }}
              >
                <View
                  className="mr-2 h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(58,123,255,0.12)" }}
                >
                  <CalendarDays size={13} color="#3A7BFF" strokeWidth={2.5} />
                </View>
                <Text className="font-poppins text-13 font-bold text-[#2F68E8]">
                  Zurück zu heute
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <View
        className={`${isSelectedToday ? "mt-12" : "mt-7"} flex-1 rounded-t-[36px] bg-white px-6 pt-6 pb-8`}
        style={{
          shadowColor: "#000000",
          shadowOpacity: Platform.OS === "ios" ? 0.07 : 0,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -2 },
          elevation: 2,
        }}
      >
        <View>
          <Text className="text-text font-poppins text-28 font-bold capitalize">
            {selectedDateLabel}
          </Text>
        </View>

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
                        hourEntries.length > 0
                          ? "#3A7BFF"
                          : "rgba(58,123,255,0.20)",
                    }}
                  />
                  {hourEntries.length > 0 ? (
                    hourEntries.map((entry, entryIndex) =>
                      (() => {
                        const isLearning = isLearningSlotEntry(entry);
                        return (
                          <View
                            key={entry.id}
                            className={`${entryIndex === 0 ? "" : "mt-2"} ml-4 rounded-[30px] px-4 py-3`}
                            style={{
                              backgroundColor: isLearning
                                ? "rgba(246,178,122,0.2)"
                                : "rgba(95,201,176,0.2)",
                            }}
                          >
                            <View className="flex-row items-center justify-between">
                              <View className="flex-1 pr-3">
                                <Text
                                  className="font-poppins text-14 font-semibold text-[#1A1A1A]"
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
                                    {isLearning
                                      ? getLearningRangeLabel(entry)
                                      : getEntryDisplayTimeLabel(entry)}
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
                                <ArrowUpRight
                                  size={20}
                                  color="#FFFFFF"
                                  strokeWidth={2.4}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })(),
                    )
                  ) : (
                    <View className="h-6" />
                  )}
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
              className={`mt-0.5 font-poppins text-12 ${activeNav === "calendar" ? "font-bold" : "font-medium"}`}
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
              className={`mt-0.5 font-poppins text-12 ${activeNav === "profile" ? "font-bold" : "font-medium"}`}
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
