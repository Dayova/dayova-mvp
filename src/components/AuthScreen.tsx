import { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  Mail,
  Phone,
  UserRound,
} from "lucide-react-native";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldAccessory,
  FieldMessage,
  FieldTrigger,
} from "~/components/ui/field";
import { Text } from "~/components/ui/text";
import { InsetTextField } from "~/components/ui/text-field";
import { useAuth } from "~/context/AuthContext";

type Mode = "login" | "register";

type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
};

const formatBirthDate = (date: Date) => {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = `${date.getFullYear()}`;
  return `${day}.${month}.${year}`;
};

const isValidBirthDate = (date: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const dateObj = new Date(year, month - 1, day);
  const today = new Date();
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day &&
    dateObj <= today
  );
};

const isCredentialError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("falsch") ||
    normalized.includes("ungültig") ||
    normalized.includes("invalid") ||
    normalized.includes("benutzer nicht gefunden") ||
    normalized.includes("user not found") ||
    normalized.includes("password")
  );
};

const isInternalBackendError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("convexerror") ||
    normalized.includes("server error") ||
    normalized.includes("request id") ||
    normalized.includes("uncaught error")
  );
};

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className={`min-h-[54px] flex-1 items-center justify-center rounded-full px-4 ${
        active ? "bg-white" : "bg-transparent"
      }`}
      style={
        active
          ? {
              shadowColor: "#111827",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }
          : undefined
      }
    >
      <Text
        className={`w-full text-center font-poppins text-[15px] font-bold ${
          active ? "text-primary" : "text-text/56"
        }`}
        style={{ lineHeight: 20, includeFontPadding: false }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AuthScreen({ initialMode }: { initialMode: Mode }) {
  const { login, register: registerUser, isLoading } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDateValue, setBirthDateValue] = useState<Date | null>(null);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const formScrollRef = useRef<ScrollView | null>(null);
  const birthDateFieldY = useRef(0);

  const isRegisterMode = mode === "register";

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    Keyboard.dismiss();
    setShowBirthDatePicker(false);
    setSubmitError("");
    setErrors({});
    setMode(next);
    router.replace(next === "login" ? "/login" : "/register");
  };

  const closeBirthDatePicker = () => setShowBirthDatePicker(false);

  const openBirthDatePicker = () => {
    Keyboard.dismiss();
    setTimeout(() => {
      formScrollRef.current?.scrollTo({
        y: Math.max(birthDateFieldY.current - 24, 0),
        animated: true,
      });
      setShowBirthDatePicker(true);
    }, 80);
  };

  const handleBirthDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") setShowBirthDatePicker(false);
    if (event.type === "dismissed" || !selectedDate) return;
    setBirthDateValue(selectedDate);
    if (errors.birthDate) {
      setErrors((prev) => ({ ...prev, birthDate: undefined }));
    }
  };

  const handleLogin = async () => {
    try {
      setSubmitError("");
      await login({ email: email.trim(), password });
      router.replace("/home");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
      if (isCredentialError(message)) {
        setSubmitError("E-Mail oder Passwort ist falsch.");
        return;
      }
      setSubmitError(
        isInternalBackendError(message)
          ? "Anmeldung fehlgeschlagen. Bitte versuche es erneut."
          : message,
      );
    }
  };

  const handleRegister = async () => {
    const nextErrors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    const trimmedBirthDate = birthDateValue
      ? formatBirthDate(birthDateValue)
      : "";

    if (trimmedName.length < 2 || !/^[A-Za-zÀ-ÿ' -]+$/.test(trimmedName)) {
      nextErrors.name = "Bitte einen gültigen Namen eingeben.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Bitte eine gültige E-Mail eingeben.";
    }
    if (!/^\+?[0-9()\-.\s]{7,20}$/.test(trimmedPhone)) {
      nextErrors.phone = "Bitte eine gültige Telefonnummer eingeben.";
    }
    if (!isValidBirthDate(trimmedBirthDate)) {
      nextErrors.birthDate =
        "Bitte ein gültiges Geburtsdatum (TT.MM.JJJJ) eingeben.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("");
      return;
    }

    try {
      setSubmitError("");
      await registerUser({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        birthDate: trimmedBirthDate,
        password,
      });
      router.replace("/home");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Registrierung fehlgeschlagen.";
      setSubmitError(
        isInternalBackendError(message)
          ? "Registrierung fehlgeschlagen. Bitte versuche es erneut."
          : message,
      );
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />

      <View className="bg-black px-8 pb-16 pt-[88px]">
        <View className="items-center justify-center">
          <View className="flex-row items-center">
            <Image
              source={require("../../assets/dayova-logo.png")}
              style={{ width: 108, height: 108 }}
              resizeMode="contain"
            />
            <Text
              className="-ml-3 font-dmsans font-bold text-white"
              style={{
                fontSize: 56,
                lineHeight: 68,
              }}
            >
              Dayova
            </Text>
          </View>
        </View>
      </View>

      <View className="-mt-8 flex-1 rounded-t-[34px] bg-background px-8 pt-6">
        <View
          className="mb-6 rounded-full bg-[#EEF2F7] p-1.5"
          style={{
            minHeight: 60,
            borderWidth: 1,
            borderColor: "rgba(17,24,39,0.06)",
            shadowColor: "#111827",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 2,
          }}
        >
          <View className="flex-row">
            <ModeButton
              active={!isRegisterMode}
              label="Anmelden"
              onPress={() => switchMode("login")}
            />
            <ModeButton
              active={isRegisterMode}
              label="Registrieren"
              onPress={() => switchMode("register")}
            />
          </View>
        </View>

        <ScrollView
          ref={formScrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
          {isRegisterMode ? (
            <InsetTextField
              label="Name"
              invalid={Boolean(errors.name)}
              message={errors.name}
              accessory={<UserRound size={18} color="rgba(26,26,26,0.34)" />}
              value={name}
              onChangeText={(value) => {
                setName(value);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              onFocus={closeBirthDatePicker}
              placeholder="Max Mustermann"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />
          ) : null}

          <InsetTextField
            label="E-Mail"
            invalid={isRegisterMode && Boolean(errors.email)}
            message={isRegisterMode ? errors.email : undefined}
            accessory={<Mail size={18} color="rgba(26,26,26,0.34)" />}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (submitError) setSubmitError("");
              if (errors.email) {
                setErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            onFocus={closeBirthDatePicker}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          {isRegisterMode ? (
            <InsetTextField
              label="Telefon"
              invalid={Boolean(errors.phone)}
              message={errors.phone}
              accessory={<Phone size={18} color="rgba(26,26,26,0.34)" />}
              value={phone}
              onChangeText={(value) => {
                setPhone(value);
                if (errors.phone) {
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }
              }}
              onFocus={closeBirthDatePicker}
              placeholder="+49 123 4567890"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />
          ) : null}

          {isRegisterMode ? (
            <Field
              onLayout={(event) => {
                birthDateFieldY.current = event.nativeEvent.layout.y;
              }}
            >
              <FieldTrigger
                activeOpacity={0.82}
                onPress={openBirthDatePicker}
                invalid={Boolean(errors.birthDate)}
                className="min-h-[74px] items-start rounded-[22px] px-5 pt-3 pb-3"
              >
                <View className="flex-1">
                  <Text className="font-poppins text-[11px] text-text/42">
                    Geburtsdatum
                  </Text>
                  <Text
                    className={`mt-1 font-poppins text-16 ${
                      birthDateValue ? "text-text" : "text-text/36"
                    }`}
                  >
                    {birthDateValue
                      ? formatBirthDate(birthDateValue)
                      : "Geburtsdatum auswählen"}
                  </Text>
                </View>
                <FieldAccessory className="ml-3 self-center">
                  <ChevronDown
                    size={18}
                    color="rgba(26,26,26,0.42)"
                    strokeWidth={2.2}
                  />
                </FieldAccessory>
              </FieldTrigger>
              {errors.birthDate ? (
                <FieldMessage>{errors.birthDate}</FieldMessage>
              ) : null}
            </Field>
          ) : null}

          <InsetTextField
            label="Passwort"
            message={submitError || undefined}
            accessory={
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setPasswordVisible((current) => !current)}
              >
                {passwordVisible ? (
                  <Eye size={18} color="rgba(26,26,26,0.34)" />
                ) : (
                  <EyeOff size={18} color="rgba(26,26,26,0.34)" />
                )}
              </TouchableOpacity>
            }
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (submitError) setSubmitError("");
            }}
            onFocus={closeBirthDatePicker}
            placeholder="••••••••"
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoComplete={isRegisterMode ? "new-password" : "current-password"}
            textContentType={isRegisterMode ? "newPassword" : "password"}
          />

          <View
            className="mb-6 mt-2 rounded-[20px] bg-[#F7F8FA] px-[18px] py-4"
            style={{
              borderWidth: 1,
              borderColor: "rgba(17,24,39,0.05)",
            }}
          >
            <View className="flex-row items-center">
              <View className="h-6 w-6 items-center justify-center">
                <CircleAlert size={16} color="#3A7BFF" strokeWidth={2.1} />
              </View>
              <Text
                className="ml-2.5 flex-1 font-poppins text-[13px] text-text/62"
                style={{ lineHeight: 19, includeFontPadding: false }}
              >
                {isRegisterMode
                  ? "Mit der Registrierung erstellst du dein persönliches Lernprofil."
                  : "Falls etwas nicht klappt, prüfe zuerst E-Mail-Adresse und Passwort."}
              </Text>
            </View>
          </View>

          <Button
            onPress={isRegisterMode ? handleRegister : handleLogin}
            disabled={isLoading}
            className="mt-1"
          >
            <Text>
              {isLoading ? "Lädt..." : isRegisterMode ? "Weiter" : "Anmelden"}
            </Text>
          </Button>

          <View className="pb-2 pt-5">
            <Text className="text-center font-poppins text-12 text-text/46">
              {isRegisterMode
                ? "Schon ein Konto? Oben kannst du direkt zum Login wechseln."
                : "Noch kein Konto? Wechsle oben zur Registrierung."}
            </Text>
          </View>
        </ScrollView>
      </View>

      {showBirthDatePicker && isRegisterMode && Platform.OS === "ios" ? (
        <View className="absolute inset-0 z-50 justify-end">
          <TouchableOpacity
            className="absolute inset-0 bg-black/28"
            activeOpacity={1}
            onPress={closeBirthDatePicker}
          />
          <View className="rounded-t-[32px] bg-white px-4 pt-3 pb-7">
            <View className="mb-1 flex-row justify-end">
              <TouchableOpacity
                onPress={closeBirthDatePicker}
                className="px-3 py-2"
              >
                <Text className="font-poppins text-16 font-bold text-primary">
                  Fertig
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={birthDateValue ?? new Date(2000, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleBirthDateChange}
            />
          </View>
        </View>
      ) : null}

      {showBirthDatePicker && isRegisterMode && Platform.OS === "android" ? (
        <DateTimePicker
          value={birthDateValue ?? new Date(2000, 0, 1)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleBirthDateChange}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
