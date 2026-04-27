import { useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useConvexAuth, useMutation } from "convex/react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  GraduationCap,
  Sparkles,
} from "lucide-react-native";
import { api } from "#convex/_generated/api";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldAccessory,
  FieldControl,
  FieldLabel,
  FieldTrigger,
} from "~/components/ui/field";
import { Textarea } from "~/components/ui/textarea";
import { Text } from "~/components/ui/text";
import { TextField } from "~/components/ui/text-field";
import { Toggle } from "~/components/ui/toggle";
import { useAuth } from "~/context/AuthContext";

type EntryType = "homework" | "exam";
type EntryStep = "basics" | "planning" | "examDecision" | "success";
type PickerTarget = "dueDate" | "plannedDate" | "plannedTime";

const SUBJECTS = ["Mathe", "Deutsch", "Englisch", "Bio", "Geschichte"];
const DURATION_PRESETS = [15, 30, 45, 90, 180, 240];
const HOMEWORK_DURATIONS = [15, 30, 45, 60];
const COMMON_EXAM_TYPE_PRESETS = [
  { label: "Kurzkontrolle", durationMinutes: 15 },
  { label: "Test", durationMinutes: 30 },
  { label: "Leistungskontrolle", durationMinutes: 45 },
  { label: "Klassenarbeit", durationMinutes: 45 },
  { label: "Klausur", durationMinutes: 90 },
  { label: "Prüfung", durationMinutes: 90 },
];

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const getDateKey = (date: Date) => startOfDay(date).toISOString();

const parseDateKey = (value?: string) => {
  if (!value) return startOfDay(new Date());
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return startOfDay(new Date());
  return startOfDay(parsed);
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const getChipMinWidth = (label: string) =>
  Math.min(Math.max(label.length * 10 + 42, 92), 300);

function DateButton({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldTrigger onPress={onPress} activeOpacity={0.82}>
        <Text className="font-poppins text-16 text-text/68">{value}</Text>
        <FieldAccessory>{icon}</FieldAccessory>
      </FieldTrigger>
    </Field>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  minWidth,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  minWidth: number;
}) {
  return (
    <Toggle
      pressed={selected}
      onPressedChange={onPress}
      className={`h-13 items-center justify-center rounded-full px-5 ${
        selected ? "bg-primary" : "bg-white"
      }`}
      style={{
        minWidth,
        maxWidth: "100%",
        height: 52,
        flexGrow: 0,
        flexShrink: 0,
        borderWidth: 1,
        borderColor: selected ? "#3A7BFF" : "rgba(0,0,0,0.10)",
        overflow: "hidden",
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className={`font-poppins text-14 font-bold ${
          selected ? "text-white" : "text-text/72"
        }`}
        style={{ lineHeight: 20, includeFontPadding: false }}
      >
        {label}
      </Text>
    </Toggle>
  );
}

function SubjectPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <>
      <TextField
        className="mb-3"
        label="Schulfach"
        value={value}
        onChangeText={onChange}
        placeholder="Wähle das Fach aus"
      />
      <View
        className="mb-6 flex-row flex-wrap items-start"
        style={{ columnGap: 8, rowGap: 8 }}
      >
        {SUBJECTS.map((subject) => {
          const isSelected = value === subject;
          return (
            <ChoiceChip
              key={subject}
              label={subject}
              selected={isSelected}
              onPress={() => onChange(subject)}
              minWidth={getChipMinWidth(subject)}
            />
          );
        })}
      </View>
    </>
  );
}

function ExamTypePicker({
  value,
  onChange,
  onSelectPreset,
}: {
  value: string;
  onChange: (next: string) => void;
  onSelectPreset: (label: string, durationMinutes: number) => void;
}) {
  return (
    <>
      <TextField
        className="mb-3"
        label="Prüfungsart"
        value={value}
        onChangeText={onChange}
        placeholder="Wähle die Prüfungsart aus"
      />
      <View
        className="mb-6 flex-row flex-wrap items-start"
        style={{ columnGap: 8, rowGap: 8 }}
      >
        {COMMON_EXAM_TYPE_PRESETS.map((preset) => {
          const isSelected = value === preset.label;
          return (
            <ChoiceChip
              key={preset.label}
              label={preset.label}
              selected={isSelected}
              onPress={() =>
                onSelectPreset(preset.label, preset.durationMinutes)
              }
              minWidth={getChipMinWidth(preset.label)}
            />
          );
        })}
      </View>
    </>
  );
}

function DurationPicker({
  value,
  onChange,
  presets = DURATION_PRESETS,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  presets?: number[];
}) {
  const customValue = value === null ? "" : `${value}`;
  const handleCustomDurationChange = (next: string) => {
    const digitsOnly = next.replace(/\D/g, "");
    if (!digitsOnly) {
      onChange(null);
      return;
    }

    onChange(Math.min(Number(digitsOnly), 600));
  };

  return (
    <>
      <TextField
        className="mb-3"
        label="Bearbeitungszeit"
        value={customValue}
        onChangeText={handleCustomDurationChange}
        keyboardType="number-pad"
        placeholder="Eigene Dauer"
        accessory={
          <Text className="font-poppins text-14 font-bold text-text/44">
            Min.
          </Text>
        }
      />
      <View
        className="mb-8 flex-row flex-wrap items-start"
        style={{ columnGap: 10, rowGap: 10 }}
      >
        {presets.map((duration) => {
          const isSelected = value === duration;
          return (
            <ChoiceChip
              key={duration}
              label={`${duration} Min.`}
              selected={isSelected}
              onPress={() => onChange(duration)}
              minWidth={150}
            />
          );
        })}
      </View>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-poppins text-13 uppercase text-text/48">
        {label}
      </Text>
      <Text className="ml-4 flex-1 text-right font-poppins text-14 font-bold text-text">
        {value}
      </Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onPress,
  disabled = false,
  primary = false,
  badge,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
  badge?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.9}
      disabled={disabled}
      onPress={onPress}
      className={`rounded-[28px] px-5 py-5 ${primary ? "bg-primary" : "bg-white"}`}
      style={{
        borderWidth: 1.2,
        borderColor: primary ? "#3A7BFF" : "rgba(0,0,0,0.10)",
        shadowColor: primary ? "#3A7BFF" : "#000000",
        shadowOpacity: primary ? 0.22 : 0.08,
        shadowRadius: primary ? 16 : 10,
        shadowOffset: { width: 0, height: primary ? 9 : 4 },
        elevation: primary ? 8 : 3,
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View
          className={`h-12 w-12 items-center justify-center rounded-full ${
            primary ? "bg-white/16" : "bg-primary/12"
          }`}
        >
          {icon}
        </View>
        {badge ? (
          <View
            className={`rounded-full px-3 py-1 ${
              primary ? "bg-white/16" : "bg-black/5"
            }`}
          >
            <Text
              className={`font-poppins text-11 font-bold uppercase ${
                primary ? "text-white" : "text-text/62"
              }`}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        className={`mt-4 font-poppins text-24 font-bold ${
          primary ? "text-white" : "text-text"
        }`}
      >
        {title}
      </Text>
      <Text
        className={`mt-2 font-poppins text-14 ${
          primary ? "text-white/80" : "text-text/62"
        }`}
      >
        {description}
      </Text>
    </TouchableOpacity>
  );
}

export default function NewEntryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const createDayEntry = useMutation(api.dayEntries.create);
  const params = useLocalSearchParams<{
    type?: string;
    dayKey?: string;
    dayLabel?: string;
  }>();
  const entryType: EntryType = params.type === "exam" ? "exam" : "homework";
  const isHomework = entryType === "homework";
  const initialDate = useMemo(
    () => parseDateKey(params.dayKey),
    [params.dayKey],
  );

  const [step, setStep] = useState<EntryStep>("basics");
  const [subject, setSubject] = useState("");
  const [examTypeLabel, setExamTypeLabel] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(initialDate);
  const [plannedDate, setPlannedDate] = useState(initialDate);
  const [plannedTime, setPlannedTime] = useState(() => {
    const next = new Date();
    next.setHours(16, 0, 0, 0);
    return next;
  });
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    isHomework ? 30 : null,
  );
  const [createdDayKey, setCreatedDayKey] = useState(getDateKey(initialDate));
  const [isCreating, setIsCreating] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const trimmedSubject = subject.trim();
  const trimmedExamType = examTypeLabel.trim();
  const secondStepActive = step === "planning" || step === "examDecision";
  const canContinueFromBasics = isHomework
    ? trimmedSubject.length > 0
    : trimmedSubject.length > 0 &&
      trimmedExamType.length > 0 &&
      durationMinutes !== null &&
      durationMinutes > 0;
  const canCreateHomework =
    trimmedSubject.length > 0 && durationMinutes !== null && durationMinutes > 0;
  const canCreateExam =
    trimmedSubject.length > 0 &&
    trimmedExamType.length > 0 &&
    durationMinutes !== null &&
    durationMinutes > 0;
  const canWriteEntries = Boolean(user?.workosId && isConvexAuthenticated);

  const title = isHomework
    ? "Hausaufgabe eintragen"
    : "Leistungskontrolle eintragen";
  const subtitle = isHomework
    ? step === "basics"
      ? "Trage zuerst Fälligkeit, Fach und Notiz ein."
      : "Plane jetzt, wann du daran arbeitest."
    : step === "basics"
      ? "Trage Datum, Uhrzeit, Fach, Prüfungsart und Bearbeitungszeit ein."
      : "Du kannst die LK jetzt direkt eintragen oder später einen Lernplan ergänzen.";

  const closePicker = () => setPickerTarget(null);
  const selectExamTypePreset = (label: string, nextDurationMinutes: number) => {
    setExamTypeLabel(label);
    setDurationMinutes(nextDurationMinutes);
  };

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") closePicker();
    if (event.type === "dismissed" || !selectedDate || !pickerTarget) return;

    if (pickerTarget === "dueDate") setDueDate(startOfDay(selectedDate));
    if (pickerTarget === "plannedDate")
      setPlannedDate(startOfDay(selectedDate));
    if (pickerTarget === "plannedTime") {
      const next = new Date(plannedTime);
      next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setPlannedTime(next);
    }
  };

  const createEntry = async () => {
    if (isHomework && !canCreateHomework) return;
    if (!isHomework && !canCreateExam) return;
    if (durationMinutes === null) return;
    if (!canWriteEntries || isCreating) return;

    const nextDayKey = getDateKey(plannedDate);
    const trimmedNote = note.trim();

    try {
      setIsCreating(true);
      await createDayEntry({
        dayKey: nextDayKey,
        title: isHomework
          ? `${trimmedSubject} Hausaufgabe`
          : `${trimmedSubject} ${trimmedExamType}`,
        time: formatTime(plannedTime),
        kind: isHomework ? "Hausaufgabe" : "Leistungskontrolle",
        ...(trimmedNote ? { notes: trimmedNote } : {}),
        ...(isHomework
          ? {
              dueDateKey: getDateKey(dueDate),
              dueDateLabel: formatDate(dueDate),
            }
          : {}),
        plannedDateLabel: formatDate(plannedDate),
        durationMinutes,
        ...(!isHomework ? { examTypeLabel: trimmedExamType } : {}),
      });
    } finally {
      setIsCreating(false);
    }

    setCreatedDayKey(nextDayKey);
    if (isHomework) {
      setStep("success");
      return;
    }

    router.replace(`/home?dayKey=${encodeURIComponent(nextDayKey)}`);
  };

  const finish = () => {
    router.replace(`/home?dayKey=${encodeURIComponent(createdDayKey)}`);
  };

  const handleBack = () => {
    if (step === "planning" || step === "examDecision") {
      setStep("basics");
      return;
    }

    router.back();
  };

  const renderPicker = () => {
    if (!pickerTarget) return null;

    const mode = pickerTarget === "plannedTime" ? "time" : "date";
    const value =
      pickerTarget === "dueDate"
        ? dueDate
        : pickerTarget === "plannedTime"
          ? plannedTime
          : plannedDate;

    if (Platform.OS === "ios") {
      return (
        <View className="absolute inset-0 z-50 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/28"
            onPress={closePicker}
          />
          <View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
            <View className="mb-1 flex-row justify-end">
              <TouchableOpacity onPress={closePicker} className="px-3 py-2">
                <Text className="font-poppins text-16 font-bold text-primary">
                  Fertig
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={value}
              mode={mode}
              display="spinner"
              onChange={handlePickerChange}
            />
          </View>
        </View>
      );
    }

    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="default"
        onChange={handlePickerChange}
      />
    );
  };

  if (step === "success") {
    return (
      <View className="flex-1 bg-background px-8 pt-24 pb-10">
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center">
          <View
            className="mb-[36px] h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/12"
            style={{
              borderWidth: 1,
              borderColor: "rgba(58,123,255,0.18)",
            }}
          >
            <CheckCircle2 size={34} color="#3A7BFF" strokeWidth={2.2} />
          </View>
          <Text className="text-center font-poppins text-20 font-bold text-text">
            Hausaufgabe eingetragen
          </Text>
          <Text className="mt-[10px] text-center font-poppins text-14 text-text/66">
            Deine Hausaufgabe wurde erfolgreich geplant.
          </Text>
        </View>
        <Button onPress={finish}>
          <Text>Fertig</Text>
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 32,
          paddingTop: 76,
          paddingBottom: 80,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-9 flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleBack}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/5"
          >
            <ArrowLeft size={20} color="#1A1A1A" strokeWidth={2.3} />
          </TouchableOpacity>
          <View className="flex-row gap-2">
            <View className="h-2 w-8 rounded-full bg-primary" />
            <View
              className={`h-2 w-8 rounded-full ${
                secondStepActive ? "bg-primary" : "bg-black/10"
              }`}
            />
          </View>
        </View>

        <View className="mb-9">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary/12">
            {isHomework ? (
              <ClipboardList size={27} color="#3A7BFF" strokeWidth={2.2} />
            ) : (
              <GraduationCap size={29} color="#3A7BFF" strokeWidth={2.2} />
            )}
          </View>
          <Text className="font-poppins text-32 font-bold text-text">
            {title}
          </Text>
          <Text className="mt-3 font-poppins text-14 text-text/62">
            {subtitle}
          </Text>
        </View>

        {step === "basics" ? (
          <>
            <DateButton
              label={isHomework ? "Fälligkeitsdatum" : "Prüfungsdatum"}
              value={formatDate(isHomework ? dueDate : plannedDate)}
              icon={
                <CalendarDays size={18} color="#3A7BFF" strokeWidth={2.2} />
              }
              onPress={() =>
                setPickerTarget(isHomework ? "dueDate" : "plannedDate")
              }
            />
            {isHomework ? null : (
              <DateButton
                label="Uhrzeit"
                value={formatTime(plannedTime)}
                icon={<Clock3 size={18} color="#A3A3A3" strokeWidth={2.1} />}
                onPress={() => setPickerTarget("plannedTime")}
              />
            )}
            <SubjectPicker value={subject} onChange={setSubject} />
            {isHomework ? null : (
              <>
                <ExamTypePicker
                  value={examTypeLabel}
                  onChange={setExamTypeLabel}
                  onSelectPreset={selectExamTypePreset}
                />
                <DurationPicker
                  value={durationMinutes}
                  onChange={setDurationMinutes}
                />
              </>
            )}
            {isHomework ? (
              <Field className="mb-8">
                <FieldLabel>Notizen</FieldLabel>
                <FieldControl className="min-h-[154px] items-start px-[18px] pt-[14px] pb-4">
                  <Textarea
                    value={note}
                    onChangeText={setNote}
                    placeholder="Kurze Notiz hinzufügen"
                  />
                </FieldControl>
              </Field>
            ) : null}
            <Button
              disabled={!canContinueFromBasics}
              onPress={() => setStep(isHomework ? "planning" : "examDecision")}
            >
              <Text>Weiter</Text>
            </Button>
          </>
        ) : null}

        {step === "planning" ? (
          <>
            <DateButton
              label="Datum"
              value={formatDate(plannedDate)}
              icon={
                <CalendarDays size={18} color="#3A7BFF" strokeWidth={2.2} />
              }
              onPress={() => setPickerTarget("plannedDate")}
            />
            <DateButton
              label="Uhrzeit"
              value={formatTime(plannedTime)}
              icon={<Clock3 size={18} color="#A3A3A3" strokeWidth={2.1} />}
              onPress={() => setPickerTarget("plannedTime")}
            />
            <DurationPicker
              value={durationMinutes}
              onChange={setDurationMinutes}
              presets={HOMEWORK_DURATIONS}
            />
            <Button
              disabled={!canCreateHomework || isCreating || !canWriteEntries}
              onPress={createEntry}
            >
              <Text>HA eintragen</Text>
            </Button>
          </>
        ) : null}

        {step === "examDecision" ? (
          <>
            <View
              className="mb-6 rounded-[28px] bg-white px-5 py-5"
              style={{
                borderWidth: 1.2,
                borderColor: "rgba(0,0,0,0.10)",
                shadowColor: "#000000",
                shadowOpacity: 0.06,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 3,
              }}
            >
              <Text className="font-poppins text-22 font-bold text-text">
                Deine LK auf einen Blick
              </Text>
              <View className="mt-4" style={{ rowGap: 14 }}>
                <SummaryRow label="Datum" value={formatDate(plannedDate)} />
                <SummaryRow label="Uhrzeit" value={formatTime(plannedTime)} />
                <SummaryRow label="Fach" value={trimmedSubject} />
                <SummaryRow label="Prüfungsart" value={trimmedExamType} />
                <SummaryRow
                  label="Bearbeitungszeit"
                  value={`${durationMinutes} Min.`}
                />
              </View>
              <Text className="mt-4 font-poppins text-13 text-text/56">
                Einen Lernplan kannst du später jederzeit ergänzen.
              </Text>
            </View>

            <View style={{ rowGap: 14 }}>
              <ActionCard
                icon={
                  <CheckCircle2 size={24} color="#FFFFFF" strokeWidth={2.2} />
                }
                title="LK eintragen"
                description="Die Leistungskontrolle wird direkt im Kalender gespeichert."
                onPress={createEntry}
                disabled={isCreating || !canWriteEntries}
                primary
              />
              <ActionCard
                icon={<Sparkles size={24} color="#3A7BFF" strokeWidth={2.2} />}
                title="Lernplan erstellen"
                description="Diese Auswahl folgt als Nächstes. Für jetzt bleibt sie sichtbar, ist aber noch nicht aktiv."
                disabled
                badge="Später"
              />
            </View>
          </>
        ) : null}
      </ScrollView>
      {renderPicker()}
    </KeyboardAvoidingView>
  );
}
