import { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from "react-native-svg";
import { useAuth } from "../src/context/AuthContext";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const ARC_LABEL_TOP = [18, 10, 4, 2, 4, 10, 18];
const ARC_NUMBER_TOP = [38, 29, 23, 21, 23, 29, 38];
const ARC_NUMBER_LEFT = [7, 21.5, 37, 50, 63, 78.5, 94];

type WeekDayItem = {
  key: string;
  label: string;
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
      dayOfMonth: `${date.getDate()}`,
      isToday,
    };
  });
};

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const weekDays = useMemo(() => getCurrentWeek(new Date()), []);
  const centeredWeekDays = useMemo(() => {
    const todayIndex = weekDays.findIndex((day) => day.isToday);
    if (todayIndex < 0) return weekDays;

    const shift = 3 - todayIndex;
    return weekDays.map((_, index) => weekDays[(index - shift + 7) % 7]);
  }, [weekDays]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <View className="flex-1 bg-background px-8 pt-24">
      <StatusBar style="dark" />
      <Text className="text-text font-dmsans font-bold text-32">Home</Text>
      <Text className="text-text/70 font-poppins text-16 mt-4">
        Willkommen{user?.name ? `, ${user.name}` : ""}.
      </Text>

      <View
        className="mt-8 rounded-[28px] p-5 overflow-hidden"
        style={{
          backgroundColor: "transparent",
          borderColor: "rgba(153,163,178,0.35)",
          borderWidth: 1.5,
          shadowColor: "#1D4ED8",
          shadowOpacity: 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <ExpoLinearGradient
          colors={["rgba(58,123,255,0.2)", "rgba(228,16,172,0.3)"]}
          locations={[0, 0.9]}
          start={{ x: 0, y: 0.15 }}
          end={{ x: 1, y: 0.85 }}
          style={{ position: "absolute", top: -2, left: -2, right: -2, bottom: -2 }}
        />

        <Text className="text-text font-dmsans font-bold text-20">Diese Woche</Text>
        <View className="mt-2 h-8 relative -mx-5">
          {centeredWeekDays.map((day, index) => (
            <View
              key={`label-${day.key}`}
              className="absolute items-center"
              style={{
                left: `${ARC_NUMBER_LEFT[index]}%`,
                top: ARC_LABEL_TOP[index],
                width: 36,
                marginLeft: -18,
              }}
            >
              <Text className={`font-poppins text-12 ${day.isToday ? "text-secondary" : "text-text/70"}`}>{day.label}</Text>
            </View>
          ))}
        </View>
        <View className="mt-3 h-[140px] relative -mx-5">
          <Svg
            width="100%"
            height="120%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              top: -48,
              left: 0,
            }}
          >
            <Defs>
              <SvgLinearGradient id="dayovaArcGradient" x1="0%" y1="15%" x2="100%" y2="85%">
                  <Stop offset="0%" stopColor="white"
                        stopOpacity="0.19" />
                  <Stop offset="90%" stopColor="white"
                        stopOpacity="0.16" />
              </SvgLinearGradient>
            </Defs>
            <Path
              d="M0 46 Q50 20 100 46 L100 82 Q50 56 0 82 Z"
              fill="url(#dayovaArcGradient)"
            />
            <Path
              d="M4 46 Q50 20 96 46"
              fill="none"
            />
            <Path
              d="M4 82 Q50 56 96 82"
              fill="none"
            />
          </Svg>

          {centeredWeekDays.map((day, index) => (
            <View
              key={day.key}
              className="absolute items-center justify-center rounded-full"
              style={{
                left: `${ARC_NUMBER_LEFT[index]}%`,
                top: ARC_NUMBER_TOP[index],
                width: 36,
                height: 36,
                marginLeft: -18,
                backgroundColor: day.isToday ? "rgba(255,255,255,0.2)" : "rgba(96,122,219,0.1)",
                borderWidth: 1,
                borderColor: day.isToday ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
              }}
            >
              <Text className={`font-dmsans font-bold text-17 ${day.isToday ? "text-secondary" : "text-text"}`}>{day.dayOfMonth}</Text>
            </View>
          ))}
        </View>
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
    </View>
  );
}
