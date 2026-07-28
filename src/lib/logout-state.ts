async function signOutAndResetState(
	signOut: () => Promise<void>,
	resetLocalState: () => void,
) {
	await signOut();
	resetLocalState();
}

export { signOutAndResetState };
