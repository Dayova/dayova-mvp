export type InlineDatePickerProps = {
	value: Date;
	minimumDate?: Date;
	maximumDate?: Date;
	onChange: (date: Date) => void;
};
