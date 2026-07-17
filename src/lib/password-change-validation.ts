export type PasswordField =
	| "currentPassword"
	| "newPassword"
	| "confirmPassword";

export type PasswordErrors = Partial<Record<PasswordField, string>>;

type PasswordValues = Record<PasswordField, string>;

export const validatePasswordChange = ({
	currentPassword,
	newPassword,
	confirmPassword,
}: PasswordValues): PasswordErrors => {
	const errors: PasswordErrors = {};
	if (currentPassword.length === 0) {
		errors.currentPassword = "Bitte gib dein aktuelles Passwort ein.";
	}
	if (newPassword.length < 8 || newPassword.trim().length === 0) {
		errors.newPassword = "Das neue Passwort muss mindestens 8 Zeichen haben.";
	} else if (newPassword === currentPassword) {
		errors.newPassword =
			"Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.";
	}
	if (newPassword !== confirmPassword) {
		errors.confirmPassword = "Die neuen Passwörter stimmen nicht überein.";
	}
	return errors;
};

const errorDependencies: Record<PasswordField, PasswordField[]> = {
	currentPassword: ["currentPassword", "newPassword"],
	newPassword: ["newPassword", "confirmPassword"],
	confirmPassword: ["confirmPassword"],
};

export const clearPasswordChangeErrors = (
	errors: PasswordErrors,
	changedField: PasswordField,
) => {
	const next = { ...errors };
	for (const field of errorDependencies[changedField]) delete next[field];
	return next;
};
