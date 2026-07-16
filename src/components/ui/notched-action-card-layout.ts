function resolveNotchedCardFrameHeight({
	measuredContentHeight,
	minimumHeight,
}: {
	measuredContentHeight: number;
	minimumHeight: number;
}) {
	return Math.max(minimumHeight, measuredContentHeight);
}

export { resolveNotchedCardFrameHeight };
