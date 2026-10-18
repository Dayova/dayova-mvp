type DashboardSummaryCardLayout = "side-by-side" | "stacked";

type DashboardScreenLayout = {
	headerCalendarGap: number;
	summaryCardLayout: DashboardSummaryCardLayout;
};

function getDashboardScreenLayout({
	fontScale,
	viewportWidth,
}: {
	fontScale: number;
	viewportWidth: number;
}): DashboardScreenLayout {
	const shouldStackSummaryCards = viewportWidth < 700 || fontScale >= 1.3;

	return {
		headerCalendarGap: 24,
		summaryCardLayout: shouldStackSummaryCards ? "stacked" : "side-by-side",
	};
}

const getDashboardSummaryCardLayoutClass = (
	layout: DashboardSummaryCardLayout | undefined,
) => (layout === "stacked" ? "w-full" : "flex-1");

export { getDashboardScreenLayout, getDashboardSummaryCardLayoutClass };
export type { DashboardScreenLayout, DashboardSummaryCardLayout };
