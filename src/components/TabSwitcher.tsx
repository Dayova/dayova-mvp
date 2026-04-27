import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

interface TabSwitcherProps {
  activeTab: 'login' | 'register';
}

export default function TabSwitcher({ activeTab }: TabSwitcherProps) {
  const router = useRouter();

  return (
    <View className="bg-primary flex-row p-1.5 rounded-tab w-full max-w-[326px] self-center overflow-hidden">
      {/* Background Gradient Simulator - in real project we would use expo-linear-gradient */}
      <View className="absolute inset-0 bg-[#3A7BFF]" /> 
      
      <TouchableOpacity 
        onPress={() => router.push("/register")}
        className={`flex-1 h-11 items-center justify-center rounded-tab ${activeTab === 'register' ? 'bg-white' : ''}`}
      >
        <Text className={`font-poppins font-semibold text-12 ${activeTab === 'register' ? 'text-primary' : 'text-white'}`}>
          Registrieren
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => router.push("/login")}
        className={`flex-1 h-11 items-center justify-center rounded-tab ${activeTab === 'login' ? 'bg-white' : ''}`}
      >
        <Text className={`font-poppins font-semibold text-12 ${activeTab === 'login' ? 'text-primary' : 'text-white'}`}>
          Anmelden
        </Text>
      </TouchableOpacity>
    </View>
  );
}
