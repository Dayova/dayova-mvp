import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useDayovaTheme } from "~/lib/theme";

export default function AppLayout() {
	const { colors } = useDayovaTheme();

	return (
		<NativeTabs
			backBehavior="history"
			iconColor={{
				default: colors.secondaryText,
				selected: colors.primaryStrong,
			}}
			indicatorColor={colors.systemSubtle}
			labelStyle={{
				default: {
					color: colors.secondaryText,
					fontFamily: "Poppins",
					fontSize: 11,
					fontWeight: "400",
				},
				selected: {
					color: colors.primaryStrong,
					fontFamily: "Poppins",
					fontSize: 11,
					fontWeight: "600",
				},
			}}
			labelVisibilityMode="labeled"
			minimizeBehavior="onScrollDown"
			rippleColor={colors.systemSubtle}
			tintColor={colors.primaryStrong}
		>
			<NativeTabs.Trigger
				name="home"
				accessibilityLabel="Heute"
				disableAutomaticContentInsets
			>
				<NativeTabs.Trigger.Icon
					md={{ default: "home", selected: "home" }}
					sf={{ default: "house", selected: "house.fill" }}
				/>
				<NativeTabs.Trigger.Label>Heute</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger
				name="learning-plans"
				accessibilityLabel="Pläne"
				disableAutomaticContentInsets
			>
				<NativeTabs.Trigger.Icon
					md={{ default: "library_books", selected: "library_books" }}
					sf={{
						default: "books.vertical",
						selected: "books.vertical.fill",
					}}
				/>
				<NativeTabs.Trigger.Label>Pläne</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger
				name="settings"
				accessibilityLabel="Einstellungen"
				disableAutomaticContentInsets
			>
				<NativeTabs.Trigger.Icon
					md={{ default: "settings", selected: "settings" }}
					sf={{
						default: "gearshape",
						selected: "gearshape.fill",
					}}
				/>
				<NativeTabs.Trigger.Label>Einstellungen</NativeTabs.Trigger.Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
