import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, BookOpen, CalendarDays, Plus, UserRound } from "lucide-react-native";
import { useAuth } from "../src/context/AuthContext";
import { getDayEntriesMap, type DayEntry } from "../src/store/dayEntriesStore";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_FULL_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

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
  const [activeNav, setActiveNav] = useState<"calendar" | "profile">("calendar");
  const [navBarWidth, setNavBarWidth] = useState(0);
  const navIndicatorProgress = useRef(new Animated.Value(0)).current;
  const dayScrollX = useRef(new Animated.Value(0)).current;
  const dayScrollRef = useRef<ScrollView | null>(null);
  const hasAlignedInitialDay = useRef(false);
  const { width: screenWidth } = useWindowDimensions();
  const weekDays = useMemo(() => getCurrentWeek(new Date()), []);
  const [selectedDayKey, setSelectedDayKey] = useState(() => weekDays.find((day) => day.isToday)?.key ?? weekDays[0]?.key ?? "");
  const selectedDayIndex = useMemo(() => {
    const index = weekDays.findIndex((day) => day.key === selectedDayKey);
    return index < 0 ? 0 : index;
  }, [selectedDayKey, weekDays]);
  const entriesByDay = useMemo(() => getDayEntriesMap(), [params.refresh]);
  const selectedDay = weekDays.find((day) => day.key === selectedDayKey) ?? weekDays[0];
  const selectedEntries = selectedDay ? entriesByDay[selectedDay.key] ?? [] : [];
  const DAY_ITEM_SIZE = 64;
  const DAY_ITEM_STEP = 76;
  const daySidePadding = Math.max((screenWidth - DAY_ITEM_SIZE) / 2, 0);
  const scrollToDayIndex = (index: number, animated: boolean) => {
    dayScrollRef.current?.scrollTo({ x: index * DAY_ITEM_STEP, animated });
  };
  const selectDayAtIndex = (index: number) => {
    const boundedIndex = Math.min(Math.max(index, 0), weekDays.length - 1);
    const nextDay = weekDays[boundedIndex];
    if (!nextDay) return;

    scrollToDayIndex(boundedIndex, true);
    if (nextDay.key !== selectedDayKey) {
      setSelectedDayKey(nextDay.key);
    }
  };
  const getEntryUrl = (entry: DayEntry) => {
    const dayLabel = selectedDay ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}` : "";
    return `/entry/${encodeURIComponent(entry.id)}?title=${encodeURIComponent(entry.title)}&time=${encodeURIComponent(entry.time)}&day=${encodeURIComponent(dayLabel)}`;
  };
  const firstName =
    typeof user?.name === "string" && user.name.trim().length > 0 ? user.name.trim().split(/\s+/)[0] : "du";

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  useEffect(() => {
    if (typeof params.dayKey === "string" && params.dayKey) {
      setSelectedDayKey(params.dayKey);
    }
  }, [params.dayKey]);

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
    if (hasAlignedInitialDay.current) {
      scrollToDayIndex(selectedDayIndex, true);
    }
  }, [selectedDayIndex]);

  return (
    <View className="flex-1 bg-background px-8 pt-24 pb-28">
      <StatusBar style="dark" />

      <View className="mt-20 mb-6">
        <Text className="text-text font-dmsans font-bold text-24 text-center">Hallo, {firstName} 👋</Text>
      </View>

      <View className="mt-12">
        <View className="mt-6 h-[96px] -mx-8 overflow-hidden">
          <Animated.ScrollView
            ref={dayScrollRef}
            horizontal
            bounces={false}
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            snapToInterval={DAY_ITEM_STEP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: daySidePadding }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: dayScrollX } } }], {
              useNativeDriver: true,
            })}
            scrollEventThrottle={16}
            onLayout={() => {
              if (!hasAlignedInitialDay.current) {
                scrollToDayIndex(selectedDayIndex, false);
                hasAlignedInitialDay.current = true;
              }
            }}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / DAY_ITEM_STEP);
              const boundedIndex = Math.min(Math.max(nextIndex, 0), weekDays.length - 1);
              const nextDay = weekDays[boundedIndex];
              if (nextDay && nextDay.key !== selectedDayKey) {
                setSelectedDayKey(nextDay.key);
              }
            }}
          >
            {weekDays.map((day, index) => {
              const isSelected = index === selectedDayIndex;
              const scale = dayScrollX.interpolate({
                inputRange: [(index - 2) * DAY_ITEM_STEP, (index - 1) * DAY_ITEM_STEP, index * DAY_ITEM_STEP, (index + 1) * DAY_ITEM_STEP, (index + 2) * DAY_ITEM_STEP],
                outputRange: [0.74, 0.88, 1, 0.88, 0.74],
                extrapolate: "clamp",
              });
              const opacity = dayScrollX.interpolate({
                inputRange: [(index - 2) * DAY_ITEM_STEP, (index - 1) * DAY_ITEM_STEP, index * DAY_ITEM_STEP, (index + 1) * DAY_ITEM_STEP, (index + 2) * DAY_ITEM_STEP],
                outputRange: [0.24, 0.58, 1, 0.58, 0.24],
                extrapolate: "clamp",
              });
              const translateY = dayScrollX.interpolate({
                inputRange: [(index - 2) * DAY_ITEM_STEP, (index - 1) * DAY_ITEM_STEP, index * DAY_ITEM_STEP, (index + 1) * DAY_ITEM_STEP, (index + 2) * DAY_ITEM_STEP],
                outputRange: [12, 6, 0, 6, 12],
                extrapolate: "clamp",
              });
            return (
              <Animated.View
                key={day.key}
                style={{
                  width: DAY_ITEM_SIZE,
                  height: DAY_ITEM_SIZE,
                  marginHorizontal: (DAY_ITEM_STEP - DAY_ITEM_SIZE) / 2,
                  zIndex: 100 - Math.abs(index - selectedDayIndex),
                  opacity,
                  transform: [{ scale }, { translateY }],
                }}
              >
                <TouchableOpacity
                  className="w-full h-full items-center justify-center rounded-2xl"
                  activeOpacity={0.85}
                  onPress={() => selectDayAtIndex(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{
                    backgroundColor: isSelected ? "rgba(58,123,255,0.16)" : "rgba(255,255,255,0.90)",
                    borderWidth: isSelected ? 1.8 : 1,
                    borderColor: isSelected ? "rgba(26,26,26,0.02)" : "rgba(0,0,0,0.08)",
                    shadowColor: "#000000",
                    shadowOpacity: isSelected ? 0.16 : 0.08,
                    shadowRadius: isSelected ? 10 : 5,
                    shadowOffset: { width: 0, height: isSelected ? 6 : 3 },
                    elevation: isSelected ? 8 : 4,
                  }}
                >
                  <Text className={`font-poppins ${isSelected ? "text-11 text-text/75" : "text-10 text-text/65"}`}>{day.label}</Text>
                  <Text className={`mt-1 font-dmsans font-bold ${isSelected ? "text-19 text-text" : "text-16 text-text/80"}`}>
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
          {selectedDay ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}` : ""}
        </Text>
        {selectedEntries.length === 0 ? (
          <Text className="text-text/70 font-poppins text-13 mt-6">Keine Einträge für diesen Tag.</Text>
        ) : (
          selectedEntries.map((entry, index) => (
            <View
              key={entry.id}
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
                <Text className="text-text font-poppins font-bold text-14">{entry.title}</Text>
                <View className="mt-2 flex-row items-center">
                  <BookOpen size={12} color="#4A4A4A" strokeWidth={2.2} />
                  <Text className="ml-1.5 text-text/80 font-poppins font-bold text-11 tracking-wide">
                    {entry.kind ?? "Allgemein"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push(getEntryUrl(entry))}
                className="w-10 h-10 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: "rgba(255,255,255,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" }}
              >
                <ArrowUpRight size={18} color="#1A1A1A" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        activeOpacity={0.8}
        className="mt-10 h-14 rounded-2xl items-center justify-center bg-black"
      >
        <Text className="text-white font-poppins font-bold text-16 uppercase tracking-widest">
          Ausloggen
        </Text>
      </TouchableOpacity>

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
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
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
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            />
          </Animated.View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveNav("calendar")}
            className="w-20 h-[68px] rounded-full items-center justify-center pt-1"
          >
            <CalendarDays
              size={22}
              color={activeNav === "calendar" ? "#1A1A1A" : "rgba(26,26,26,0.72)"}
              strokeWidth={2.3}
            />
            <Text
              className="mt-0.5 font-poppins text-[11px]"
              style={{ color: activeNav === "calendar" ? "#1A1A1A" : "rgba(26,26,26,0.82)", fontWeight: activeNav === "calendar" ? "700" : "500" }}
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
              color={activeNav === "profile" ? "#1A1A1A" : "rgba(26,26,26,0.72)"}
              strokeWidth={2.2}
            />
            <Text
              className="mt-0.5 font-poppins text-[11px]"
              style={{ color: activeNav === "profile" ? "#1A1A1A" : "rgba(26,26,26,0.82)", fontWeight: activeNav === "profile" ? "700" : "500" }}
            >
              Profil
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            router.push(
              `/entry/new?dayKey=${encodeURIComponent(selectedDay?.key ?? "")}&dayLabel=${encodeURIComponent(
                selectedDay ? `${selectedDay.fullLabel} ${selectedDay.dayOfMonth}` : ""
              )}`
            )
          }
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
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
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

    </View>
  );
}
