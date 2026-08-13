import { NativeModule, requireNativeModule } from "expo";

import type {
	DayovaSystemAppearanceModuleEvents,
	SystemColorScheme,
} from "./DayovaSystemAppearance.types";

declare class DayovaSystemAppearanceModule extends NativeModule<DayovaSystemAppearanceModuleEvents> {
	getColorScheme(): SystemColorScheme;
	releaseSnapshotShield(generation: number): void;
}

export default requireNativeModule<DayovaSystemAppearanceModule>(
	"DayovaSystemAppearance",
);
