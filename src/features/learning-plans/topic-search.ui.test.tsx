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
import { RequiredTopicsStep } from "./learning-plan-setup-steps";
import {
	type SearchTopics,
	TopicSearch,
	type TopicSearchResult,
} from "./topic-search";

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
}: {
	searchTopics: SearchTopics;
	initial?: string;
	onContinue?: () => void;
	busy?: boolean;
}) {
	const [topics, setTopics] = useState(initial);
	return (
		<RequiredTopicsStep
			subject="Mathematik"
			searchTopics={searchTopics}
			topics={topics}
			onChangeTopics={setTopics}
			onContinue={onContinue}
			isBusy={busy}
			canContinue={!busy && isMeaningfulTopicDescription(topics)}
			errorMessage={null}
		/>
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
	test("continues with a complete pasted list without searching", async () => {
		const search = jest.fn<SearchTopics>();
		const next = jest.fn();
		const screen = await render(
			<Setup searchTopics={search} initial="" onContinue={next} />,
		);
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			longScope,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Weiter" }));
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			longScope,
		);
		expect(next).toHaveBeenCalledTimes(1);
		expect(search).not.toHaveBeenCalled();
	});

	test("debounces only the search term and appends to the latest edited scope", async () => {
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
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			longScope,
		);
		const revised = `${longScope}Nur Aufgaben ohne Taschenrechner`;
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			revised,
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Geraden zur Themenliste hinzufügen",
			}),
		);
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			`${revised}\nGeraden`,
		);
		expect(screen.getByLabelText("Themen suchen")).toHaveDisplayValue("Gerad");
	});

	test("updates included results when the learner removes or edits text", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(reply("Vektoren"));
		const screen = await render(
			<Setup searchTopics={search} initial="Vektoren" />,
		);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Vekt");
		await debounce();
		expect(
			screen.getByRole("button", {
				name: "Vektoren, bereits in deiner Themenliste",
			}),
		).toBeDisabled();
		await fireEvent.changeText(
			screen.getByLabelText("Prüfungsthemen"),
			"Skalarprodukt",
		);
		await fireEvent.press(
			screen.getByRole("button", {
				name: "Vektoren zur Themenliste hinzufügen",
			}),
		);
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Skalarprodukt\nVektoren",
		);
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
			topics: "",
			onChangeTopics: jest.fn(),
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
			screen.getByLabelText("Prüfungsthemen"),
			"Evolution",
		);
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
		await fireEvent.press(
			screen.getByRole("button", { name: "Erneut versuchen" }),
		);
		await debounce();
		expect(
			screen.getByText(
				"Keine passenden Vorschläge. Trage deine Themen unten direkt ein.",
			),
		).toBeOnTheScreen();
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveDisplayValue(
			"Evolution",
		);
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
				"Suche nach einem kürzeren Begriff. Deine vollständige Themenliste kannst du unten einfügen.",
			),
		).toBeOnTheScreen();
		expect(search).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Weiter" })).toBeEnabled();
	});

	test("shows a bounded result list with a refinement hint", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockResolvedValue(
				reply(...Array.from({ length: 8 }, (_, i) => `Thema ${i}`)),
			);
		const screen = await render(<Setup searchTopics={search} />);
		await fireEvent.changeText(screen.getByLabelText("Themen suchen"), "Thema");
		await debounce();
		expect(
			screen.getAllByRole("button", { name: /zur Themenliste hinzufügen/ }),
		).toHaveLength(5);
		expect(screen.queryByText("Thema 5")).toBeNull();
		expect(
			screen.getByText(
				"Grenze deinen Suchbegriff weiter ein, um weitere passende Themen zu finden.",
			),
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
		expect(screen.getByLabelText("Prüfungsthemen")).toHaveProp(
			"editable",
			false,
		);
		expect(
			screen.getByRole("button", { name: "Weiter, wird geladen" }),
		).toBeDisabled();
	});
});
