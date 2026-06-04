import { expect, test, vi } from "vitest";
import { USER_FACING_ERROR_KIND } from "./errors";
import { createManagedReadUrl } from "./fileStorage";

test("managed read URL failures are logged and converted to user-facing backend errors", async () => {
	const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	const runMutation = vi
		.fn()
		.mockResolvedValueOnce({ downloadToken: "download-token" })
		.mockResolvedValueOnce({ status: "not_found", downloadUrl: null });
	const userFacingMessage =
		'Die Datei "Material.pdf" konnte nicht gelesen werden. Lade sie bitte erneut hoch.';

	try {
		await expect(
			createManagedReadUrl(
				{ runMutation } as unknown as Parameters<typeof createManagedReadUrl>[0],
				{ storageId: "storage-123", storageProvider: "convex" },
				"access-key",
				{
					fileName: "Material.pdf",
					userFacingMessage,
				},
			),
		).rejects.toMatchObject({
			data: {
				kind: USER_FACING_ERROR_KIND,
				message: userFacingMessage,
			},
		});

		expect(consoleError).toHaveBeenCalledWith(
			"[Dayova:fileStorage.createManagedReadUrl]",
			expect.objectContaining({
				metadata: expect.objectContaining({
					fileName: "Material.pdf",
					hasDownloadUrl: false,
					status: "not_found",
					storageId: "storage-123",
					storageProvider: "convex",
				}),
			}),
		);
	} finally {
		consoleError.mockRestore();
	}
});
