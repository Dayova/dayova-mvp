export type ForcedPasswordResetUser = {
	updatePassword: (input: {
		newPassword: string;
		signOutOfOtherSessions: boolean;
	}) => Promise<unknown>;
};

export const completeForcedPasswordReset = async (
	user: ForcedPasswordResetUser,
	newPassword: string,
) => {
	await user.updatePassword({
		newPassword,
		signOutOfOtherSessions: true,
	});
};
