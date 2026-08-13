type PasswordChangeInput = {
	currentPassword: string;
	newPassword: string;
};

type PasswordChangeUser = {
	updatePassword: (
		params: PasswordChangeInput & {
			signOutOfOtherSessions: boolean;
		},
	) => Promise<unknown>;
};

async function changePassword(
	user: PasswordChangeUser,
	input: PasswordChangeInput,
) {
	await user.updatePassword({
		...input,
		signOutOfOtherSessions: true,
	});
}

export type { PasswordChangeInput, PasswordChangeUser };
export { changePassword };
