import { describe, expect, jest, test } from "@jest/globals";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import {
	type SearchTopics,
	TopicSearch,
	type TopicSearchResult,
} from "./topic-search";

jest.mock("~/components/ui/icon", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	return {
		Search: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
		Plus: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
		Check: (props: Record<string, unknown>) =>
			React.createElement("Icon", props),
		X: (props: Record<string, unknown>) => React.createElement("Icon", props),
	};
});
jest.mock("~/lib/theme", () => ({
	useDayovaTheme: () => ({
		colors: { text: "#111111", primary: "#00A0E6", secondaryText: "#697586" },
	}),
}));
function Harness({
	searchTopics,
	initial = "",
}: {
	searchTopics: SearchTopics;
	initial?: string;
}) {
	const [topics, setTopics] = useState(initial);
	return (
		<TopicSearch
			topics={topics}
			subject="Deutsch"
			onChangeTopics={setTopics}
			searchTopics={searchTopics}
			disabled={false}
		/>
	);
}
const result = {
	topics: [{ id: "poetry", title: "Gedichtanalyse" }],
	truncated: false,
};
describe("topic search", () => {
	test("debounces typing, adds and removes a result, and retains legacy text", async () => {
		const search = jest.fn<SearchTopics>().mockResolvedValue(result);
		const screen = await render(
			<Harness
				searchTopics={search}
				initial="Meine alten Themen, unverändert"
			/>,
		);
		await fireEvent.changeText(screen.getByLabelText("Thema suchen"), "Ge");
		expect(search).not.toHaveBeenCalled();
		await fireEvent.changeText(screen.getByLabelText("Thema suchen"), "Gedi");
		await fireEvent.changeText(
			screen.getByLabelText("Thema suchen"),
			"Gedicht",
		);
		await fireEvent.press(
			await screen.findByRole("button", { name: "Gedichtanalyse hinzufügen" }),
		);
		expect(search).toHaveBeenCalledTimes(1);
		expect(search).toHaveBeenCalledWith({
			query: "Gedicht",
			subject: "Deutsch",
		});
		expect(
			screen.getByRole("button", {
				name: "Meine alten Themen, unverändert entfernen",
			}),
		).toBeOnTheScreen();
		expect(
			screen.getByRole("button", { name: "Gedichtanalyse entfernen" }),
		).toBeOnTheScreen();
		expect(screen.getByLabelText("Thema suchen")).toHaveDisplayValue("");
		await fireEvent.press(
			screen.getByRole("button", { name: "Gedichtanalyse entfernen" }),
		);
		expect(
			screen.queryByRole("button", { name: "Gedichtanalyse entfernen" }),
		).toBeNull();
	});
	test("ignores an older response after the search has changed", async () => {
		let resolveOld: (result: TopicSearchResult) => void = () => {};
		const search = jest
			.fn<SearchTopics>()
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveOld = resolve;
					}),
			)
			.mockResolvedValue({
				topics: [{ id: "grammar", title: "Grammatik" }],
				truncated: false,
			});
		const screen = await render(<Harness searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Thema suchen"),
			"Gedicht",
		);
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		await fireEvent.changeText(
			screen.getByLabelText("Thema suchen"),
			"Grammatik",
		);
		expect(
			await screen.findByRole("button", { name: "Grammatik hinzufügen" }),
		).toBeOnTheScreen();
		await act(async () => resolveOld(result));
		expect(
			screen.queryByRole("button", { name: "Gedichtanalyse hinzufügen" }),
		).toBeNull();
	});
	test("allows custom topics when the provider fails and retries", async () => {
		const search = jest
			.fn<SearchTopics>()
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValue(result);
		const screen = await render(<Harness searchTopics={search} />);
		await fireEvent.changeText(
			screen.getByLabelText("Thema suchen"),
			"Gedicht",
		);
		await fireEvent.press(
			await screen.findByRole("button", { name: "Erneut versuchen" }),
		);
		expect(
			await screen.findByRole("button", { name: "Gedichtanalyse hinzufügen" }),
		).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Thema suchen"), "Lyrik");
		await fireEvent.press(
			screen.getByRole("button", { name: "Eigenes Thema hinzufügen: Lyrik" }),
		);
		expect(
			screen.getByRole("button", { name: "Lyrik entfernen" }),
		).toBeOnTheScreen();
	});
});
