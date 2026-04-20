import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      
      {/* Visual Placeholder (Top) */}
      <View className="flex-1 justify-center items-center">
        <View className="w-64 h-64 bg-primary/10 rounded-full items-center justify-center border border-primary/20">
             <Text className="text-white/20 font-dmsans font-bold text-24">Visual 17:628</Text>
        </View>
      </View>

      {/* Bottom Content Card (17:627) */}
      <View className="bg-[#16181B] px-10 pt-12 pb-16 rounded-t-card border-t border-white/10">
        <Text className="text-white font-dmsans font-semibold text-24 text-center leading-tight">
          Entdecke neue Lernwege
        </Text>
        <Text className="text-white/60 font-dmsans text-16 mt-4 text-center leading-6">
          Lernen ist für alle da! Melde dich an und erhalte Zugriff auf unsere besten Lernmethoden und Kurse.
        </Text>

        {/* Pagination Dots (17:631) */}
        <View className="flex-row justify-center mt-8 space-x-2">
          <View className="w-4 h-2 bg-white rounded-full" />
          <View className="w-2 h-2 bg-white/30 rounded-full" />
          <View className="w-2 h-2 bg-white/30 rounded-full" />
        </View>

        {/* Action Buttons */}
        <TouchableOpacity 
          onPress={() => router.push("/login")}
          activeOpacity={0.8}
          className="bg-primary h-14 rounded-button items-center justify-center mt-10 shadow-lg shadow-primary/30"
        >
          <Text className="text-white font-dmsans font-semibold text-20">Weiter</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push("/login")}
          activeOpacity={0.7}
          className="h-14 border-2 border-primary/50 rounded-button items-center justify-center mt-4"
        >
          <Text className="text-white font-dmsans font-semibold text-20">Überspringen</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
