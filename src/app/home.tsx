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
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Plus,
  UserRound,
  X,
} from "lucide-react-native";
import { useAuth } from "~/context/AuthContext";
import { Button } from "~/components/ui/button";
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

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string; dayKey?: string }>();
  const { user, logout } = useAuth();
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
  const DAY_ITEM_SIZE = 62;
  const DAY_ITEM_STEP = 74;
  const daySidePadding = Math.max((screenWidth - DAY_ITEM_SIZE) / 2, 0);
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
    const details = [
      ["title", entry.title],
      ["time", entry.time],
      ["day", dayLabel],
    ];
    if (entry.kind) details.push(["kind", entry.kind]);
    if (entry.notes) details.push(["notes", entry.notes]);
    if (entry.dueDateLabel) details.push(["dueDate", entry.dueDateLabel]);
    if (entry.plannedDateLabel) {
      details.push(["plannedDate", entry.plannedDateLabel]);
    }
    if (entry.durationMinutes) {
      details.push(["duration", `${entry.durationMinutes}`]);
    }
    const query = details
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    return `/entry/${encodeURIComponent(entry.id)}?${query}`;
  };
  const firstName =
    typeof user?.name === "string" && user.name.trim().length > 0
      ? user.name.trim().split(/\s+/)[0]
      : "du";

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };
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
    <View className="flex-1 bg-background px-8 pt-24 pb-28">
      <StatusBar style="dark" />

      <View className="mt-20 mb-2 items-center">
        <Text className="text-center text-text font-dmsans font-bold text-24">
          Hallo, {firstName} 👋
        </Text>
        <Text className="mt-1 text-center text-text font-dmsans font-bold text-18">
          Diese Woche
        </Text>
      </View>

      <View className="mt-5">
        <View className="-mx-8 h-[104px]">
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
                outputRange: [0.82, 0.92, 1, 0.92, 0.82],
                extrapolate: "clamp",
              });
              const translateY = dayScrollX.interpolate({
                inputRange,
                outputRange: [8, 3, 0, 3, 8],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={day.key}
                  style={{
                    width: DAY_ITEM_SIZE,
                    height: DAY_ITEM_SIZE,
                    marginHorizontal: (DAY_ITEM_STEP - DAY_ITEM_SIZE) / 2,
                    transform: [{ scale }, { translateY }],
                  }}
                >
                  <TouchableOpacity
                    className="w-full h-full items-center justify-center rounded-2xl"
                    activeOpacity={0.85}
                    onPress={() => selectDayAtIndex(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      backgroundColor: isSelected
                        ? "#E8F0FF"
                        : "#FFFFFF",
                      borderWidth: 1,
                      borderColor: isSelected
                        ? "#DCE7FF"
                        : "rgba(0,0,0,0.08)",
                      shadowColor: "#000000",
                      shadowOpacity:
                        Platform.OS === "ios" ? (isSelected ? 0.12 : 0.045) : 0,
                      shadowRadius:
                        Platform.OS === "ios" ? (isSelected ? 9 : 4) : 0,
                      shadowOffset: {
                        width: 0,
                        height:
                          Platform.OS === "ios" ? (isSelected ? 5 : 2) : 0,
                      },
                      elevation: 0,
                    }}
                  >
                    <Text
                      className={`font-poppins ${isSelected ? "text-11 text-text/70" : "text-10 text-text/40"}`}
                    >
                      {day.label}
                    </Text>
                    <Text
                      className={`mt-1 font-dmsans font-bold ${isSelected ? "text-18 text-text" : "text-15 text-text/50"}`}
                    >
                      {day.dayOfMonth}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.ScrollView>
        </View>
      </View>

      <View className="mt-12">
        <Text className="text-text font-dmsans font-bold text-20 mb-2 text-center">
          {selectedDay
            ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}`
            : ""}
        </Text>
        {selectedEntries.length === 0 ? (
          <Text className="text-text/70 font-poppins text-13 mt-6">
            Keine Einträge für diesen Tag.
          </Text>
        ) : (
          selectedEntries.map((entry, index) => (
            <TouchableOpacity
              key={entry.id}
              activeOpacity={0.86}
              onPress={() => router.push(getEntryUrl(entry))}
              accessibilityRole="button"
              accessibilityLabel={`${entry.title} öffnen`}
              className={`${index === 0 ? "mt-6" : "mt-3"} flex-row items-center justify-between rounded-xl px-5 py-3`}
              style={{
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1.2,
                borderColor: "rgba(0,0,0,0.12)",
                shadowColor: "#000000",
                shadowOpacity: 0.07,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <View className="flex-1 pr-3 pl-0.5">
                <Text className="text-text font-poppins font-bold text-14">
                  {entry.title}
                </Text>
                <View className="mt-2 flex-row items-center">
                  <BookOpen size={12} color="#4A4A4A" strokeWidth={2.2} />
                  <Text className="ml-1.5 text-text/80 font-poppins font-bold text-11 tracking-wide">
                    {entry.kind ?? "Allgemein"}
                  </Text>
                </View>
              </View>
              <View
                pointerEvents="none"
                className="w-10 h-10 rounded-full items-center justify-center mr-2"
                style={{
                  backgroundColor: "rgba(255,255,255,0.28)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.45)",
                }}
              >
                <ArrowUpRight size={18} color="#1A1A1A" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Button
        onPress={handleLogout}
        className="mt-10"
      >
        <UiText>Ausloggen</UiText>
      </Button>

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
              color={
                activeNav === "calendar" ? "#1A1A1A" : "rgba(26,26,26,0.72)"
              }
              strokeWidth={2.3}
            />
            <Text
              className="mt-0.5 font-poppins text-[11px]"
              style={{
                color:
                  activeNav === "calendar" ? "#1A1A1A" : "rgba(26,26,26,0.82)",
                fontWeight: activeNav === "calendar" ? "700" : "500",
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
              color={
                activeNav === "profile" ? "#1A1A1A" : "rgba(26,26,26,0.72)"
              }
              strokeWidth={2.2}
            />
            <Text
              className="mt-0.5 font-poppins text-[11px]"
              style={{
                color:
                  activeNav === "profile" ? "#1A1A1A" : "rgba(26,26,26,0.82)",
                fontWeight: activeNav === "profile" ? "700" : "500",
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
                <UiText className="font-dmsans text-24 font-bold text-text">
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
                  Neuer Test / neue Klausur
                </UiText>
                <UiText className="mt-1 font-poppins text-12 text-text/58">
                  Datum, Fach und Themen eintragen.
                </UiText>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
