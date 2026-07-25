function toMaterialDatePickerIso(date: Date) {
	return new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	).toISOString();
}

function fromMaterialDatePickerDate(selectedDate: Date, timeSource: Date) {
	const localDate = new Date(timeSource);
	localDate.setFullYear(
		selectedDate.getUTCFullYear(),
		selectedDate.getUTCMonth(),
		selectedDate.getUTCDate(),
	);
	return localDate;
}

export { fromMaterialDatePickerDate, toMaterialDatePickerIso };
