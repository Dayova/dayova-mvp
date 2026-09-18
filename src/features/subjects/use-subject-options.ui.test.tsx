import { beforeEach, expect, jest, test } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { useSubjectOptions } from "./use-subject-options";

let mockAuth = { isAuthenticated: true, isLoading: false };
let mockResponse: unknown;
const mockQueries = jest.fn<(queries: unknown) => { subjects?: unknown }>();
const mockCreate = jest.fn<(args: { name: string }) => Promise<unknown>>();

jest.mock("convex/react", () => ({
	useConvexAuth: () => mockAuth,
	useQueries: (queries: unknown) => mockQueries(queries),
	useMutation: () => mockCreate,
}));
jest.mock("~/components/ui/icon", () => ({ BookOpen: () => null }));
jest.mock("~/lib/diagnostics", () => ({ logDiagnosticError: jest.fn() }));

beforeEach(() => {
	mockAuth = { isAuthenticated: true, isLoading: false };
	mockResponse = undefined;
	mockQueries.mockReset();
	mockQueries.mockImplementation(() => ({ subjects: mockResponse }));
	mockCreate.mockReset();
});

test("query failures keep built-in subjects available without a render crash", async () => {
	mockResponse = new Error("[CONVEX Q(personalSubjects:list)] Server Error");
	const { result } = await renderHook(() => useSubjectOptions());
	expect(result.current.isLoading).toBe(false);
	expect(result.current.loadError).toContain("konnten nicht geladen werden");
	expect(result.current.loadError).not.toContain("CONVEX");
	expect(
		result.current.options.some((option) => option.name === "Mathematik"),
	).toBe(true);
	expect(result.current.personalOptions).toEqual([]);
});

test("a recovered subscription restores personal subjects and clears the error", async () => {
	mockResponse = new Error("Server Error");
	const { result, rerender } = await renderHook(() => useSubjectOptions());
	mockResponse = {
		personal: [{ id: "french-id", name: "Französisch" }],
		reusableTimetableSubjects: ["Latein"],
	};
	await rerender(undefined);
	expect(result.current.loadError).toBeNull();
	expect(result.current.personalOptions).toEqual([
		expect.objectContaining({
			name: "Französisch",
			personalSubjectId: "french-id",
		}),
	]);
	expect(result.current.options).toContainEqual(
		expect.objectContaining({ name: "Latein", kind: "timetable" }),
	);
});

test("sign-out removes personal subjects and skips the authenticated query", async () => {
	mockResponse = {
		personal: [{ id: "french-id", name: "Französisch" }],
		reusableTimetableSubjects: [],
	};
	const { result, rerender } = await renderHook(() => useSubjectOptions());
	mockAuth = { isAuthenticated: false, isLoading: false };
	await rerender(undefined);
	expect(mockQueries).toHaveBeenLastCalledWith({});
	expect(result.current.personalOptions).toEqual([]);
	expect(result.current.loadError).toBeNull();
});

test("saving a language returns its persistent reference and failures propagate", async () => {
	mockCreate.mockResolvedValueOnce({
		kind: "personal",
		id: "latin-id",
		name: "Latein",
	});
	const { result } = await renderHook(() => useSubjectOptions());
	await expect(result.current.savePermanent("Latein")).resolves.toEqual({
		name: "Latein",
		personalSubjectId: "latin-id",
	});
	mockCreate.mockRejectedValueOnce(new Error("Server Error"));
	await expect(result.current.savePermanent("Spanisch")).rejects.toThrow(
		"Server Error",
	);
});
