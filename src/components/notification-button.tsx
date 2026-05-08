import { TouchableOpacity } from "react-native";
import { Bell } from "~/components/ui/icon";

export function NotificationButton() {
	return (
		<TouchableOpacity
			activeOpacity={0.86}
			accessibilityRole="button"
			accessibilityLabel="Benachrichtigungen öffnen"
			className="h-14 w-14 items-center justify-center rounded-full bg-white"
			style={{
				borderWidth: 1,
				borderColor: "rgba(17,24,39,0.06)",
				boxShadow: "0 10px 22px rgba(21, 29, 48, 0.08)",
			}}
		>
			<Bell size={22} color="#1A1A1A" strokeWidth={2.2} />
		</TouchableOpacity>
	);
}
