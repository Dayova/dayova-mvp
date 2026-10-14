/** Returns an index only when the offset is within one layout point of a snap boundary. */
export function getAlignedSnapIndex(
	offset: number,
	itemSize: number,
	itemCount: number,
) {
	if (itemSize <= 0 || itemCount <= 0 || !Number.isFinite(offset)) return null;
	const index = Math.max(
		0,
		Math.min(itemCount - 1, Math.round(offset / itemSize)),
	);
	return Math.abs(offset - index * itemSize) < 1 ? index : null;
}
