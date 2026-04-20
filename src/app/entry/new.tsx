import { useMemo, useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  ImagePlus,
  GraduationCap,
  NotebookPen,
  Timer,
} from "lucide-react-native";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Toggle } from "~/components/ui/toggle";
import { addDayEntry } from "~/store/dayEntriesStore";

type EntryType = "homework" | "exam";
type HomeworkStep = "basics" | "planning" | "success";
type PickerTarget = "dueDate" | "plannedDate" | "plannedTime" | "examDate";

const SUBJECTS = ["Mathe", "Deutsch", "Englisch", "Bio", "Geschichte"];
const DURATIONS = [15, 30, 45, 60];
const SUBJECT_CHIP_WIDTHS: Record<string, number> = {
  Mathe: 96,
  Deutsch: 122,
  Englisch: 128,
  Bio: 86,
  Geschichte: 158,
};

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

const inputFrameStyle = {
  borderWidth: 1.4,
  borderColor: "rgba(0,0,0,0.10)",
  shadowColor: "#3A7BFF",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 5,
};

function FieldLabel({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <View className="mb-2 ml-1 flex-row items-center">
      {icon}
      <Text className="ml-2 font-poppins text-12 font-bold uppercase text-text/62">
        {label}
      </Text>
    </View>
  );
}

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
    <View className="mb-6">
      <FieldLabel icon={icon} label={label} />
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={onPress}
        className="h-14 flex-row items-center justify-between rounded-input bg-white px-5"
        style={inputFrameStyle}
      >
        <Text className="font-poppins text-16 text-text">{value}</Text>
        <ChevronRight size={19} color="rgba(26,26,26,0.48)" strokeWidth={2.3} />
      </TouchableOpacity>
    </View>
  );
}

function ChoiceChip({
  label,
  value,
  selected,
  onPress,
  minWidth,
}: {
  label: string;
  value: string;
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
        ellipsizeMode="clip"
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
    <View className="mb-6">
      <FieldLabel
        icon={<NotebookPen size={15} color="#3A7BFF" strokeWidth={2.3} />}
        label="Fach"
      />
      <View
        className="flex-row flex-wrap items-start"
        style={{ columnGap: 8, rowGap: 8 }}
      >
        {SUBJECTS.map((subject) => {
          const isSelected = value === subject;
          return (
            <ChoiceChip
              key={subject}
              value={subject}
              label={subject}
              selected={isSelected}
              onPress={() => onChange(subject)}
              minWidth={SUBJECT_CHIP_WIDTHS[subject]}
            />
          );
        })}
      </View>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder="Oder eigenes Fach eintragen"
        className="mt-3 bg-white"
        style={inputFrameStyle}
      />
    </View>
  );
}

function MultilineEntryInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
}) {
  return (
    <View
      className="rounded-input bg-white"
      style={[
        inputFrameStyle,
        {
          minHeight: 104,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 14,
        },
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(26,26,26,0.42)"
        multiline
        textAlignVertical="top"
        className="min-h-[72px] font-poppins text-16 text-text"
        style={{
          lineHeight: 24,
          padding: 0,
          margin: 0,
        }}
      />
    </View>
  );
}

export default function NewEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    dayKey?: string;
    dayLabel?: string;
  }>();
  const entryType: EntryType = params.type === "exam" ? "exam" : "homework";
  const initialDate = useMemo(() => parseDateKey(params.dayKey), [params.dayKey]);

  const [step, setStep] = useState<HomeworkStep>(
    entryType === "homework" ? "basics" : "planning",
  );
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(initialDate);
  const [plannedDate, setPlannedDate] = useState(initialDate);
  const [plannedTime, setPlannedTime] = useState(() => {
    const next = new Date();
    next.setHours(16, 0, 0, 0);
    return next;
  });
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [createdDayKey, setCreatedDayKey] = useState(getDateKey(initialDate));
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const title =
    entryType === "homework" ? "Hausaufgabe eintragen" : "Test/Klausur eintragen";
  const canContinue = subject.trim().length > 0;

  const closePicker = () => setPickerTarget(null);

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") closePicker();
    if (event.type === "dismissed" || !selectedDate || !pickerTarget) return;

    if (pickerTarget === "dueDate") setDueDate(startOfDay(selectedDate));
    if (pickerTarget === "plannedDate") setPlannedDate(startOfDay(selectedDate));
    if (pickerTarget === "examDate") setPlannedDate(startOfDay(selectedDate));
    if (pickerTarget === "plannedTime") {
      const next = new Date(plannedTime);
      next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setPlannedTime(next);
    }
  };

  const createEntry = () => {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) return;

    const nextDayKey = getDateKey(plannedDate);
    const isHomework = entryType === "homework";
    addDayEntry({
      dayKey: nextDayKey,
      title: isHomework
        ? `${trimmedSubject} Hausaufgabe`
        : `${trimmedSubject} Test/Klausur`,
      time: isHomework ? formatTime(plannedTime) : "Ganztägig",
      kind: isHomework ? "Hausaufgabe" : "Test/Klausur",
      notes: note.trim() || undefined,
      dueDateKey: isHomework ? getDateKey(dueDate) : nextDayKey,
      dueDateLabel: isHomework ? formatDate(dueDate) : formatDate(plannedDate),
      plannedDateLabel: formatDate(plannedDate),
      durationMinutes: isHomework ? durationMinutes : undefined,
    });

    setCreatedDayKey(nextDayKey);
    if (isHomework) {
      setStep("success");
      return;
    }

    router.replace(
      `/home?refresh=${Date.now()}&dayKey=${encodeURIComponent(nextDayKey)}`,
    );
  };

  const finish = () => {
    router.replace(
      `/home?refresh=${Date.now()}&dayKey=${encodeURIComponent(createdDayKey)}`,
    );
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
          <Pressable className="absolute inset-0 bg-black/28" onPress={closePicker} />
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
          <Text className="text-center font-dmsans text-20 font-bold text-text">
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
            onPress={() => (step === "planning" && entryType === "homework" ? setStep("basics") : router.back())}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/5"
          >
            <ArrowLeft size={20} color="#1A1A1A" strokeWidth={2.3} />
          </TouchableOpacity>
          <View className="flex-row gap-2">
            <View className="h-2 w-8 rounded-full bg-primary" />
            {entryType === "homework" ? (
              <View
                className={`h-2 w-8 rounded-full ${
                  step === "planning" ? "bg-primary" : "bg-black/10"
                }`}
              />
            ) : null}
          </View>
        </View>

        <View className="mb-9">
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary/12">
            {entryType === "homework" ? (
              <ClipboardList size={27} color="#3A7BFF" strokeWidth={2.2} />
            ) : (
              <GraduationCap size={29} color="#3A7BFF" strokeWidth={2.2} />
            )}
          </View>
          <Text className="font-dmsans text-32 font-bold text-text">{title}</Text>
          <Text className="mt-3 font-poppins text-14 text-text/62">
            {entryType === "homework"
              ? step === "basics"
                ? "Trage zuerst Fälligkeit, Fach und Notiz ein."
                : "Plane jetzt, wann du daran arbeitest."
              : "Trage Datum, Fach und eine optionale Notiz ein."}
          </Text>
        </View>

        {step === "basics" ? (
          <>
            <DateButton
              label="Fälligkeitsdatum"
              value={formatDate(dueDate)}
              icon={<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />}
              onPress={() => setPickerTarget("dueDate")}
            />
            <SubjectPicker value={subject} onChange={setSubject} />
            <View className="mb-8">
              <FieldLabel
                icon={<NotebookPen size={15} color="#3A7BFF" strokeWidth={2.3} />}
                label="Notiz"
              />
              <MultilineEntryInput
                value={note}
                onChangeText={setNote}
                placeholder="Kurze Notiz hinzufügen"
              />
            </View>
            <Button disabled={!canContinue} onPress={() => setStep("planning")}>
              <Text>Weiter</Text>
            </Button>
          </>
        ) : (
          <>
            <DateButton
              label={entryType === "homework" ? "Datum" : "Datum"}
              value={formatDate(plannedDate)}
              icon={<CalendarDays size={15} color="#3A7BFF" strokeWidth={2.3} />}
              onPress={() =>
                setPickerTarget(entryType === "homework" ? "plannedDate" : "examDate")
              }
            />
            {entryType === "exam" ? (
              <>
                <SubjectPicker value={subject} onChange={setSubject} />
                <View className="mb-6">
                  <FieldLabel
                    icon={<NotebookPen size={15} color="#3A7BFF" strokeWidth={2.3} />}
                    label="Was kommt dran?"
                  />
                  <MultilineEntryInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Kapitel, Themen, Aufgabenbereiche"
                  />
                </View>
                <View className="mb-10">
                  <FieldLabel
                    icon={<ImagePlus size={15} color="#3A7BFF" strokeWidth={2.3} />}
                    label="Anhänge / Bilder"
                  />
                  <View
                    className="h-14 flex-row items-center justify-between rounded-input bg-white px-5"
                    style={inputFrameStyle}
                  >
                    <Text className="font-poppins text-16 text-text/48">
                      Kommt später
                    </Text>
                    <ImagePlus
                      size={19}
                      color="rgba(26,26,26,0.38)"
                      strokeWidth={2.2}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <DateButton
                  label="Uhrzeit"
                  value={formatTime(plannedTime)}
                  icon={<Clock3 size={15} color="#3A7BFF" strokeWidth={2.3} />}
                  onPress={() => setPickerTarget("plannedTime")}
                />
                <View className="mb-8">
                  <FieldLabel
                    icon={<Timer size={15} color="#3A7BFF" strokeWidth={2.3} />}
                    label="Bearbeitungszeit"
                  />
                  <View
                    className="flex-row flex-wrap items-start"
                    style={{ columnGap: 10, rowGap: 10 }}
                  >
                    {DURATIONS.map((duration) => {
                      const isSelected = durationMinutes === duration;
                      return (
                        <ChoiceChip
                          key={duration}
                          value={`${duration}`}
                          label={`${duration} Min.`}
                          selected={isSelected}
                          onPress={() => setDurationMinutes(duration)}
                          minWidth={150}
                        />
                      );
                    })}
                  </View>
                </View>
              </>
            )}
            <Button disabled={!canContinue} onPress={createEntry}>
              <Text>{entryType === "homework" ? "HA eintragen" : "Eintragen"}</Text>
            </Button>
          </>
        )}
      </ScrollView>
      {renderPicker()}
    </KeyboardAvoidingView>
  );
}
