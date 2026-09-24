const getEntryCompletionAction = (isCompleted: boolean) =>
	isCompleted
		? {
				buttonLabel: "Als offen markieren",
				nextCompleted: false,
				successMessage: "Als offen markiert.",
			}
		: {
				buttonLabel: "Als erledigt markieren",
				nextCompleted: true,
				successMessage: "Als erledigt markiert.",
			};

export { getEntryCompletionAction };
