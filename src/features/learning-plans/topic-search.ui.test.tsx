import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	test,
} from "@jest/globals";
import { act, fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";
import { isMeaningfulTopicDescription } from "#convex/topicDescriptionValidation";
import { Textarea } from "~/components/ui/textarea";
import { RequiredTopicsStep } from "./learning-plan-setup-steps";
import {
	type SearchTopics,
	TopicSearch,
	type TopicSearchResult,
} from "./topic-search";

jest.mock("react-native-reanimated", () =>
	jest.requireActual("../../../tests/mocks/selection-reanimated.cjs"),
);
jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Icon = (props: Record<string, unknown>) =>
		React.createElement("Icon", props);
	return new Proxy({}, { get: () => Icon });
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { text: "#111111", secondaryText: "#697586" },
	}),
}));

const reply = (...titles: string[]): TopicSearchResult => ({
	topics: titles.map((title) => ({ id: title, title })),
	truncated: false,
});
const longScope =
	"Analytische Geometrie ohne Hilfsmittel\n• Vektoren und ihre Beträge\n• Spiegeln an Ebenen und Achsen\n• Skalarprodukt und Winkel\n";

function Setup({
	searchTopics,
	initial = longScope,
	onContinue = jest.fn(),
	busy = false,
	subject = "Mathematik",
}: {
	searchTopics: SearchTopics;
	initial?: string;
	onContinue?: () => void;
	busy?: boolean;
	subject?: string;
}) {
	const [topics, setTopics] = useState(initial);
	const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
	return (
		<>
			<RequiredTopicsStep
				subject={subject}
				searchTopics={searchTopics}
				selectedTopics={selectedTopics}
				onChangeSelectedTopics={setSelectedTopics}
				onContinue={onContinue}
				isBusy={busy}
				canContinue={
					!busy &&
					isMeaningfulTopicDescription([...selectedTopics, topics].join("\n"))
				}
				errorMessage={null}
			/>
			{/* Independent state probe: route tests assert that the real pages are separate. */}
			<Textarea
				accessibilityLabel="Hinweise zur Prüfung (optional)"
				value={topics}
				onChangeText={setTopics}
				editable={!busy}
			/>
		</>
	);
}

async function debounce() {
	await act(async () => {
		jest.advanceTimersByTime(350);
	});
}
beforeEach(() => {
	jest.useFakeTimers();
});
afterEach(() => {
	jest.useRealTimers();
});

describe("inline topic search with a free-text exam scope", () => {
	test("selects the entered topic immediately without a catalog response or retyping notes", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockRejectedValue(new Error("offline"));
		const screen = await render(
			<Setup searchTopics={search} initial="Ohne Taschenrechner" />,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Kostenstellenrechnung",
		);
		await fireEvent.press(
			screen.getByRole("checkbox", { name: "Kostenstellenrechnung" }),
		);
		expect(search).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: "Kostenstellenrechnung entfernen" }),
		).toBeOnTheScreen();
		await debounce();
		expect(
			screen.getByRole("checkbox", { name: "Kostenstellenrechnung" }),
		).toBeChecked();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Ohne Taschenrechner");
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		expect(
			screen.getByRole("button", { name: "Kostenstellenrechnung entfernen" }),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Kostenstellenrechnung entfernen" }),
		);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Kostenstellenrechnung",
		);
		expect(
			screen.getByRole("checkbox", { name: "Kostenstellenrechnung" }),
		).not.toBeChecked();
	});

	test("does not duplicate or rewrite an own selection when its exact catalog match arrives", async () => {
		let finish: (result: TopicSearchResult) => void = () => {};
		const search = jest.fn<SearchTopics>().mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const screen = await render(<Setup searchTopics={search} initial="" />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"  bilanz  ",
		);
		await fireEvent.press(screen.getByRole("checkbox", { name: "bilanz" }));
		await debounce();
		await act(async () => finish(reply("Bilanz", "Handelsbilanz")));
		expect(screen.getAllByRole("checkbox", { name: "bilanz" })).toHaveLength(1);
		expect(screen.queryByRole("checkbox", { name: "Bilanz" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "bilanz entfernen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "bilanz entfernen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"ＢＩＬＡＮＺ",
		);
		expect(screen.getByRole("checkbox", { name: "bilanz" })).toBeChecked();
		await fireEvent.press(screen.getByRole("checkbox", { name: "bilanz" }));
		expect(
			screen.queryByRole("button", { name: "bilanz entfernen" }),
		).toBeNull();
	});

	test("accepts the full own title beyond the catalog limit without querying or retyping", async () => {
		const search = jest.fn<SearchTopics>();
		const screen = await render(<Setup searchTopics={search} initial="" />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			longScope,
		);
		await fireEvent.press(
			screen.getByRole("checkbox", { name: longScope.trim() }),
		);
		await debounce();
		expect(search).not.toHaveBeenCalled();
		expect(
			screen.getByRole("button", { name: `${longScope.trim()} entfernen` }),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
	});

	test("offers short own titles but no whitespace, and freezes the own option while saving", async () => {
		const search = jest.fn<SearchTopics>();
		const props = {
			selectedTopics: [],
			subject: "Informatik",
			onChangeSelectedTopics: jest.fn(),
			searchTopics: search,
			disabled: false,
		};
		const screen = await render(<TopicSearch {...props} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "   ");
		expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "KI");
		expect(screen.getByRole("checkbox", { name: "KI" })).toBeOnTheScreen();
		await screen.rerender(<TopicSearch {...props} disabled />);
		expect(screen.getByRole("checkbox", { name: "KI" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("checkbox", { name: "KI" }));
		expect(props.onChangeSelectedTopics).not.toHaveBeenCalled();
		expect(search).not.toHaveBeenCalled();
	});
	test("starts an uncached search within 150ms of the last keystroke", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(reply("Bilanz"));
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await act(async () => jest.advanceTimersByTime(150));
		expect(search).toHaveBeenCalledWith({
			query: "Bilanz",
			subject: "Mathematik",
		});
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
	});
	test("restores a normalized cached search immediately without a loading flash", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(reply("Bilanz"));
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			" BILANZ ",
		);
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
		expect(screen.queryByText("Themen werden gesucht …")).toBeNull();
		expect(search).toHaveBeenCalledTimes(1);
	});

	test("reuses an in-flight search when returning to its query and caches it after leaving", async () => {
		let finish: (result: TopicSearchResult) => void = () => {};
		const search = jest.fn<SearchTopics>().mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		expect(search).toHaveBeenCalledTimes(1);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		await act(async () => finish(reply("Bilanz")));
		expect(screen.queryByRole("checkbox", { name: "Bilanz" })).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
	});
	test("shows matching known titles immediately while refining, but refreshes authoritative results", async () => {
		let finish: (value: TopicSearchResult) => void = () => {};
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValueOnce({
				topics: [
					{
						id: "1",
						title: "Bilanz",
						subjects: ["Wirtschaftskunde"],
						isAdditional: true,
					},
					{ id: "2", title: "Bild", subjects: ["Kunst"], isAdditional: true },
				],
				truncated: true,
			})
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
		const screen = await render(
			<Setup searchTopics={search} initial="Ohne Hilfsmittel" />,
		);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Bil");
		await debounce();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
		expect(screen.queryByRole("checkbox", { name: "Bild" })).toBeNull();
		expect(screen.queryByText("Weitere Vorschläge")).toBeNull();
		await debounce();
		await act(async () => finish(reply("Bilanz", "Bilanzgleichung")));
		expect(
			screen.getByRole("checkbox", { name: "Bilanzgleichung" }),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Ohne Hilfsmittel");
	});
	test("keeps known matching titles on backspace even if the broader provider search fails", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValueOnce({
				...reply("Bilanz", "Handelsbilanz"),
				topics: ["Bilanz", "Handelsbilanz"].map((title) => ({
					id: title,
					title,
					subjects: ["Wirtschaftskunde"],
				})),
			})
			.mockRejectedValueOnce(new Error("offline"));
		const screen = await render(
			<Setup
				searchTopics={search}
				subject="Wirtschaftskunde"
				initial="Ohne Hilfsmittel"
			/>,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Bil");
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
		await debounce();
		expect(
			screen.getByRole("checkbox", { name: "Handelsbilanz" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Bilanz" }));
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Ohne Hilfsmittel");
	});

	test("keeps relevant result context, excludes unrelated suggestions, and preserves additional information", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue({
			topics: [
				{
					id: "1",
					title: "Bilanz",
					subjects: ["Wirtschaftskunde"],
					isAdditional: false,
				},
				{
					id: "2",
					title: "Handelsbilanz",
					subjects: ["Wirtschaftskunde"],
					isAdditional: true,
				},
			],
			truncated: false,
		});
		const screen = await render(
			<Setup searchTopics={search} initial="Inventur ohne Hilfsmittel" />,
		);
		expect(screen.getByLabelText("Themen suchen")).toHaveProp(
			"placeholder",
			"Thema suchen oder eingeben",
		);
		expect(screen.queryByRole("radiogroup")).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		expect(screen.queryByText("Weitere Vorschläge")).toBeNull();
		expect(
			screen.queryByRole("checkbox", { name: "Handelsbilanz" }),
		).toBeNull();
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toHaveProp(
			"accessibilityHint",
			"Themenbereich: Wirtschaftskunde",
		);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Bilanz" }));
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Inventur ohne Hilfsmittel");
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
	});

	test("keeps the same query scoped to the current name after renaming a personal subject", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(reply("Bilanz"));
		const props = {
			selectedTopics: [],
			onChangeSelectedTopics: jest.fn(),
			searchTopics: search,
			disabled: false,
		};
		const screen = await render(
			<TopicSearch {...props} subject="Rechnungswesen" />,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		await screen.rerender(
			<TopicSearch {...props} subject="Mein Wirtschaftskurs" />,
		);
		// The entered title stays available as an own topic; old catalog context
		// must not survive the subject change while the new request is pending.
		expect(screen.getByRole("checkbox", { name: "Bilanz" })).toBeOnTheScreen();
		expect(screen.getByText("Eigenes Thema")).toBeOnTheScreen();
		await debounce();
		expect(search).toHaveBeenLastCalledWith({
			query: "Bilanz",
			subject: "Mein Wirtschaftskurs",
		});
	});

	test("continues with a complete pasted list without searching", async () => {
		const search = jest.fn<SearchTopics>();
		const next = jest.fn();
		const screen = await render(
			<Setup searchTopics={search} initial="" onContinue={next} />,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
			longScope,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue(longScope);
		expect(next).toHaveBeenCalledTimes(1);
		expect(search).not.toHaveBeenCalled();
	});

	test("debounces only the search term and preserves the latest edited additional information", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValue(reply("Vektoren", "Geraden"));
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Ger");
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Gerad");
		await debounce();
		expect(search).toHaveBeenCalledTimes(1);
		expect(search).toHaveBeenCalledWith({
			query: "Gerad",
			subject: "Mathematik",
		});
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue(longScope);
		const revised = `${longScope}Nur Aufgaben ohne Taschenrechner`;
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
			revised,
		);
		await fireEvent.press(screen.getByRole("checkbox", { name: "Geraden" }));
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue(revised);
		expect(screen.getByLabelText("Themen suchen")).toHaveDisplayValue("Gerad");
	});

	test("keeps selection separate from matching free text and allows removing via result or chip", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(reply("Vektoren"));
		const screen = await render(
			<Setup searchTopics={search} initial="Vektoren ohne Hilfsmittel" />,
		);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Vekt");
		await debounce();
		expect(
			screen.getByRole("checkbox", { name: "Vektoren" }),
		).not.toBeChecked();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Vektoren" }));
		expect(screen.getByRole("checkbox", { name: "Vektoren" })).toBeChecked();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Vektoren ohne Hilfsmittel");
		await fireEvent.press(screen.getByRole("checkbox", { name: "Vektoren" }));
		expect(
			screen.queryByRole("button", { name: "Vektoren entfernen" }),
		).toBeNull();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Vektoren" }));
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		expect(
			screen.getByRole("button", { name: "Vektoren entfernen" }),
		).toBeOnTheScreen();
		await fireEvent.press(
			screen.getByRole("button", { name: "Vektoren entfernen" }),
		);
		expect(screen.queryByText("Ausgewählte Themen (1)")).toBeNull();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Vektoren ohne Hilfsmittel");
	});
	test("continues with selection alone and keeps selections across different searches", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValueOnce(reply("Bilanz"))
			.mockResolvedValueOnce(reply("Inventur"));
		const screen = await render(<Setup searchTopics={search} initial="" />);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Bilanz",
		);
		await debounce();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Bilanz" }));
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			"Inventur",
		);
		await debounce();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Inventur" }));
		expect(
			screen.getByRole("button", { name: "Bilanz entfernen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Inventur entfernen" }),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("");
	});

	test("ignores stale requests after changing a query or subject and reuses matching cache", async () => {
		let finishOld: (value: TopicSearchResult) => void = () => {};
		const search = jest
			.fn<SearchTopics>()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishOld = resolve;
					}),
			)
			.mockResolvedValue(reply("Geraden"));
		const props = {
			selectedTopics: [],
			onChangeSelectedTopics: jest.fn(),
			searchTopics: search,
			disabled: false,
		};
		const screen = await render(
			<TopicSearch {...props} subject="Mathematik" />,
		);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Vekt");
		await debounce();
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Gerad");
		await debounce();
		await act(async () => {
			finishOld(reply("Vektoren"));
		});
		expect(screen.queryByText("Vektoren")).toBeNull();
		expect(screen.getByText("Geraden")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "");
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Gerad");
		await debounce();
		expect(search).toHaveBeenCalledTimes(2);
		await screen.rerender(<TopicSearch {...props} subject="Informatik" />);
		expect(screen.queryByText("Geraden")).toBeNull();
		await debounce();
		expect(search).toHaveBeenLastCalledWith({
			query: "Gerad",
			subject: "Informatik",
		});
	});

	test("keeps the editor and continue usable through a recoverable search failure", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockRejectedValueOnce(new Error("private provider detail"))
			.mockResolvedValue(reply());
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Vekt");
		await debounce();
		expect(screen.queryByText("private provider detail")).toBeNull();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await fireEvent.changeText(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
			"Evolution",
		);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await debounce();
		expect(
			screen.getByText(
				"Keine passenden Katalogvorschläge. Du kannst deinen Begriff unten übernehmen.",
			),
		).toBeOnTheScreen();
		expect(
			screen.getByLabelText("Hinweise zur Prüfung (optional)"),
		).toHaveDisplayValue("Evolution");
	});

	test("keeps an oversized search visible without querying or truncating it", async () => {
		const search = jest.fn<SearchTopics>();
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Themen suchen"),
			longScope,
		);
		await debounce();
		expect(screen.getByLabelText("Themen suchen")).toHaveDisplayValue(
			longScope,
		);
		expect(
			screen.getByLabelText("Themen suchen").props.maxLength,
		).toBeUndefined();
		expect(
			screen.getByText(
				"Für Katalogvorschläge nutze höchstens 100 Zeichen. Deinen vollständigen Text kannst du unten als eigenes Thema übernehmen.",
			),
		).toBeOnTheScreen();
		expect(search).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
	});

	test("caps ranked suggestions at four and selects more than one without another search", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValue(
				reply(...Array.from({ length: 8 }, (_, i) => `Thema ${i}`)),
			);
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Thema");
		await debounce();
		expect(screen.getAllByRole("checkbox")).toHaveLength(5);
		expect(screen.queryByText("Thema 4")).toBeNull();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Thema 0" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Thema 3" }));
		expect(
			screen.getByRole("checkbox", { name: "Thema 0" }).props
				.accessibilityState,
		).toMatchObject({ checked: true });
		expect(
			screen.getByRole("checkbox", { name: "Thema 3" }).props
				.accessibilityState,
		).toMatchObject({ checked: true });
		expect(search).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByRole("button", { name: "Mehr Vorschläge anzeigen" }),
		).toBeNull();
	});

	test("counts an exact match toward the four catalog suggestions", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValue(
				reply("Thema 1", "Thema 2", "Thema 3", "Thema 4", "Thema"),
			);
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Thema");
		await debounce();
		expect(screen.getAllByRole("checkbox")).toHaveLength(4);
		expect(screen.getByRole("checkbox", { name: "Thema" })).toBeOnTheScreen();
		expect(screen.queryByText("Thema 4")).toBeNull();
		expect(screen.queryByText("Eigenes Thema")).toBeNull();
	});

	test("keeps the custom topic available when all catalog matches are unrelated", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue({
			topics: [
				{
					id: "quality",
					title: "Qualität entwickeln",
					subjects: ["Open Educational Resources"],
					isAdditional: true,
				},
			],
			truncated: false,
		});
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Qua");
		await debounce();
		expect(screen.getAllByRole("checkbox")).toHaveLength(1);
		expect(screen.queryByText("Qualität entwickeln")).toBeNull();
		expect(
			screen.getByText(
				"Keine passenden Katalogvorschläge. Du kannst deinen Begriff unten übernehmen.",
			),
		).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Qua" }));
		expect(
			screen.getByRole("button", { name: "Qua entfernen" }),
		).toBeOnTheScreen();
	});

	test("freezes both inputs while saving without needing a search result", async () => {
		const screen = await render(
			<Setup searchTopics={jest.fn<SearchTopics>()} busy />,
		);
		expect(screen.getByLabelText("Themen suchen")).toHaveProp(
			"editable",
			false,
		);
		expect(screen.getByLabelText("Hinweise zur Prüfung (optional)")).toHaveProp(
			"editable",
			false,
		);
		expect(
			screen.getByRole("button", { name: "Weiter, wird geladen" }),
		).toBeDisabled();
	});
});
