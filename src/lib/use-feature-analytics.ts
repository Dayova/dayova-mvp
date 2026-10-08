import { createContext, useContext } from "react";
import type {
	FeatureInteraction,
	InteractionOutcome,
	InteractionValue,
} from "./feature-analytics";
export type TrackFeatureInteraction = (
	interaction: FeatureInteraction,
	outcome?: InteractionOutcome,
	entityId?: string,
	value?: InteractionValue,
) => void;
export const FeatureAnalyticsContext = createContext<TrackFeatureInteraction>(
	() => undefined,
);
export const useFeatureAnalytics = () => useContext(FeatureAnalyticsContext);
