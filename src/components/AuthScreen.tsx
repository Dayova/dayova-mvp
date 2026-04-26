import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useAuth } from "~/context/AuthContext";
import { Button } from "~/components/ui/button";
import { Text as UiText } from "~/components/ui/text";

type Mode = "login" | "register";
type FieldErrors = {
  name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
};

const baseInputStyle = {
  backgroundColor: "rgba(255,255,255,1)",
  borderColor: "rgba(153,163,178,0.45)",
  borderWidth: 1.5,
  borderRadius: 22,
  shadowColor: "#3A7BFF",
  shadowOpacity: 0.22,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 7,
};

const getInputStyle = (hasError = false) => ({
  ...baseInputStyle,
  borderColor: hasError ? "rgba(239,68,68,0.8)" : baseInputStyle.borderColor,
});

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
  const formScrollRef = useRef<ScrollView | null>(null);
  const birthDateFieldY = useRef(0);

  const switchMode = (next: Mode) => {
    Keyboard.dismiss();
    setShowBirthDatePicker(false);
    setSubmitError("");
    setErrors({});
    setMode(next);
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
    if (errors.birthDate)
      setErrors((prev) => ({ ...prev, birthDate: undefined }));
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

    if (trimmedName.length < 2 || !/^[A-Za-zÀ-ÿ' -]+$/.test(trimmedName))
      nextErrors.name = "Bitte einen gültigen Namen eingeben.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      nextErrors.email = "Bitte eine gültige E-Mail eingeben.";
    if (!/^\+?[0-9()\-.\s]{7,20}$/.test(trimmedPhone))
      nextErrors.phone = "Bitte eine gültige Telefonnummer eingeben.";
    if (!isValidBirthDate(trimmedBirthDate))
      nextErrors.birthDate =
        "Bitte ein gültiges Geburtsdatum (TT.MM.JJJJ) eingeben.";

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
    <View className="flex-1 bg-background">
      <StatusBar style="light" />

      <View className="bg-black pt-[90px] pb-10 items-center justify-center">
        <View className="flex-row mb-10 items-center">
          <Text className="text-white font-dmsans font-bold text-40">
            Dayova
          </Text>
          <Image
            source={require("../../assets/dayova-logo.png")}
            style={{ width: 78, height: 78 }}
            resizeMode="contain"
          />
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        enabled={false}
      >
        <View className="flex-1 px-8 pt-8 -mt-10 rounded-[36px] bg-background">
          <View className="mb-2.5 shadow-sm">
            <ExpoLinearGradient
              colors={["#3A7BFF", "#FF4CCF"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                borderRadius: 32,
                marginBottom: 16,
                padding: 12,
                overflow: "hidden",
              }}
            >
              <View className="flex-row">
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => switchMode("login")}
                  className={`flex-1 h-14 rounded-[26px] items-center justify-center ${mode === "login" ? "bg-white" : ""}`}
                >
                  <Text
                    className={`font-poppins font-bold text-16 ${mode === "login" ? "text-secondary" : "text-white"}`}
                  >
                    Anmelden
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => switchMode("register")}
                  className={`flex-1 h-14 rounded-[26px] items-center justify-center ${mode === "register" ? "bg-white" : ""}`}
                >
                  <Text
                    className={`font-poppins font-bold text-16 ${mode === "register" ? "text-secondary" : "text-white"}`}
                  >
                    Registrieren
                  </Text>
                </TouchableOpacity>
              </View>
            </ExpoLinearGradient>
          </View>

          <ScrollView
            ref={formScrollRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 0 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <View className="space-y-6">
              {mode === "register" ? (
                <View className="mb-6">
                  <Text className="text-black/80 font-poppins text-12 mb-2 ml-2 uppercase tracking-widest">
                    Name
                  </Text>
                  <View
                    className="relative h-14 px-6 justify-center overflow-hidden"
                    style={getInputStyle(Boolean(errors.name))}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 1,
                        left: 10,
                        right: 10,
                        height: 1,
                        backgroundColor: "rgba(255,255,255,1)",
                      }}
                    />
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        if (errors.name)
                          setErrors((p) => ({ ...p, name: undefined }));
                      }}
                      onFocus={closeBirthDatePicker}
                      placeholder="Max Mustermann"
                      placeholderTextColor="rgba(26,26,26,0.68)"
                      autoCapitalize="words"
                      className="text-text font-poppins text-16"
                    />
                  </View>
                  {errors.name ? (
                    <Text className="text-red-500 text-12 mt-2 ml-2">
                      {errors.name}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View className="mb-6">
                <Text className="text-black/80 font-poppins text-12 mb-2 ml-2 uppercase tracking-widest">
                  E-Mail
                </Text>
                <View
                  className="relative h-14 px-6 justify-center overflow-hidden"
                  style={getInputStyle(
                    mode === "register" && Boolean(errors.email),
                  )}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 1,
                      left: 10,
                      right: 10,
                      height: 1,
                      backgroundColor: "rgba(255,255,255,1)",
                    }}
                  />
                  <TextInput
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (submitError) setSubmitError("");
                      if (errors.email)
                        setErrors((p) => ({ ...p, email: undefined }));
                    }}
                    onFocus={closeBirthDatePicker}
                    placeholder="name@example.com"
                    placeholderTextColor="rgba(26,26,26,0.68)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="text-text font-poppins text-16"
                  />
                </View>
                {mode === "register" && errors.email ? (
                  <Text className="text-red-500 text-12 mt-2 ml-2">
                    {errors.email}
                  </Text>
                ) : null}
              </View>

              {mode === "register" ? (
                <View className="mb-6">
                  <Text className="text-black/80 font-poppins text-12 mb-2 ml-2 uppercase tracking-widest">
                    Telefon
                  </Text>
                  <View
                    className="relative h-14 px-6 justify-center overflow-hidden"
                    style={getInputStyle(Boolean(errors.phone))}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 1,
                        left: 10,
                        right: 10,
                        height: 1,
                        backgroundColor: "rgba(255,255,255,1)",
                      }}
                    />
                    <TextInput
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(v);
                        if (errors.phone)
                          setErrors((p) => ({ ...p, phone: undefined }));
                      }}
                      onFocus={closeBirthDatePicker}
                      placeholder="+49 123 4567890"
                      placeholderTextColor="rgba(26,26,26,0.68)"
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      className="text-text font-poppins text-16"
                    />
                  </View>
                  {errors.phone ? (
                    <Text className="text-red-500 text-12 mt-2 ml-2">
                      {errors.phone}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {mode === "register" ? (
                <View
                  className="mb-6"
                  onLayout={(event) => {
                    birthDateFieldY.current = event.nativeEvent.layout.y;
                  }}
                >
                  <Text className="text-black/80 font-poppins text-12 mb-2 ml-2 uppercase tracking-widest">
                    Geburtsdatum
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={openBirthDatePicker}
                    className="relative h-14 px-6 justify-center overflow-hidden"
                    style={getInputStyle(Boolean(errors.birthDate))}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        top: 1,
                        left: 10,
                        right: 10,
                        height: 1,
                        backgroundColor: "rgba(255,255,255,1)",
                      }}
                    />
                    <Text
                      className={`font-poppins text-16 ${birthDateValue ? "text-text" : "text-black/50"}`}
                    >
                      {birthDateValue
                        ? formatBirthDate(birthDateValue)
                        : "Geburtsdatum auswählen"}
                    </Text>
                  </TouchableOpacity>
                  {errors.birthDate ? (
                    <Text className="text-red-500 text-12 mt-2 ml-2">
                      {errors.birthDate}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View>
                <Text className="text-black/80 font-poppins text-12 mb-2 ml-2 uppercase tracking-widest">
                  Passwort
                </Text>
                <View
                  className="relative h-14 px-6 justify-center overflow-hidden"
                  style={getInputStyle(false)}
                >
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      top: 1,
                      left: 10,
                      right: 10,
                      height: 1,
                      backgroundColor: "rgba(255,255,255,1)",
                    }}
                  />
                  <TextInput
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (submitError) setSubmitError("");
                    }}
                    onFocus={closeBirthDatePicker}
                    placeholder="••••••••"
                    secureTextEntry
                    placeholderTextColor="rgba(26,26,26,0.68)"
                    className="text-text font-poppins text-16"
                  />
                </View>
                {submitError ? (
                  <Text className="text-red-500 text-12 mt-2 ml-1">
                    {submitError}
                  </Text>
                ) : null}
              </View>
            </View>

            <Button
              onPress={mode === "login" ? handleLogin : handleRegister}
              disabled={isLoading}
              className="mt-10"
            >
              <UiText>
                {isLoading
                  ? "Lädt..."
                  : mode === "login"
                    ? "Anmelden"
                    : "Registrieren"}
              </UiText>
            </Button>
          </ScrollView>

          {showBirthDatePicker &&
          mode === "register" &&
          Platform.OS === "ios" ? (
            <View className="absolute inset-0 z-50 justify-end">
              <TouchableOpacity
                className="absolute inset-0 bg-black/30"
                activeOpacity={1}
                onPress={closeBirthDatePicker}
              />
              <View className="bg-white rounded-t-3xl px-4 pt-3 pb-6">
                <View className="flex-row justify-end mb-2">
                  <TouchableOpacity
                    onPress={closeBirthDatePicker}
                    className="px-3 py-1.5"
                  >
                    <Text className="text-secondary font-poppins font-bold text-16">
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
          {showBirthDatePicker &&
          mode === "register" &&
          Platform.OS === "android" ? (
            <DateTimePicker
              value={birthDateValue ?? new Date(2000, 0, 1)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleBirthDateChange}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
