const models = [
	{
		id: "opus",
		name: "Opus 5",
		fullName: "Claude Opus 5",
		maker: "Anthropic",
		monogram: "O5",
		color: "#d8ff3e",
		copy: "The current long-horizon leader, with Fable-level results at a markedly lower run cost.",
		scores: {
			deepswe: { score: 74, display: "74%", cost: 11.84, effort: "Max", margin: "±4%" },
			frontier: { score: 53.4, display: "53.4%", cost: 4.3, effort: "Medium" },
			cursor: { score: 70, display: "70.0%", cost: 8.23, effort: "Max" },
		},
	},
	{
		id: "fable",
		name: "Fable 5",
		fullName: "Claude Fable 5",
		maker: "Anthropic",
		monogram: "F5",
		color: "#ff9d79",
		copy: "The raw-ceiling choice: first on mergeability and Cursor’s real-session benchmark, at the highest run cost.",
		scores: {
			deepswe: { score: 70, display: "70%", cost: 21.63, effort: "Max", margin: "±4%" },
			frontier: { score: 53.5, display: "53.5%", cost: 13.09, effort: "Extra high" },
			cursor: { score: 70.5, display: "70.5%", cost: 17.32, effort: "Max" },
		},
	},
	{
		id: "sol",
		name: "GPT‑5.6 Sol",
		fullName: "GPT‑5.6 Sol",
		maker: "OpenAI",
		monogram: "SO",
		color: "#8dc9ff",
		copy: "One point from the DeepSWE lead and consistently near the top, with a stronger cost profile than the leading Claudes.",
		scores: {
			deepswe: { score: 73, display: "73%", cost: 8.39, effort: "Max", margin: "±3%" },
			frontier: { score: 47.5, display: "47.5%", cost: 6.3, effort: "Max" },
			cursor: { score: 67.2, display: "67.2%", cost: 5.69, effort: "Max" },
		},
	},
	{
		id: "terra",
		name: "GPT‑5.6 Terra",
		fullName: "GPT‑5.6 Terra",
		maker: "OpenAI",
		monogram: "TR",
		color: "#b9a6ff",
		copy: "The balance point: tied with Fable on DeepSWE for a fraction of the run cost, while staying competitive elsewhere.",
		scores: {
			deepswe: { score: 70, display: "70%", cost: 3.96, effort: "Max", margin: "±3%" },
			frontier: { score: 41.3, display: "41.3%", cost: 1.81, effort: "Max" },
			cursor: { score: 64.9, display: "64.9%", cost: 2.31, effort: "Max" },
		},
	},
	{
		id: "kimi",
		name: "Kimi K3",
		fullName: "Kimi K3",
		maker: "Moonshot AI",
		monogram: "K3",
		color: "#ffcf66",
		copy: "A top-tier DeepSWE contender with a solid FrontierCode result; its CursorBench showing is more modest.",
		scores: {
			deepswe: { score: 69, display: "69%", cost: 4.65, effort: "Max", margin: "±5%" },
			frontier: { score: 44.2, display: "44.2%", cost: 3.82, effort: "Default" },
			cursor: { score: 60.8, display: "60.8%", cost: 2.7, effort: "Max" },
		},
	},
	{
		id: "luna",
		name: "GPT‑5.6 Luna",
		fullName: "GPT‑5.6 Luna",
		maker: "OpenAI",
		monogram: "LU",
		color: "#7de3c1",
		copy: "The throughput choice: materially lower run cost with enough capability to remain in the frontier pack.",
		scores: {
			deepswe: { score: 67, display: "67%", cost: 0.61, effort: "Max", margin: "±4%" },
			frontier: { score: 39.8, display: "39.8%", cost: 0.36, effort: "Max" },
			cursor: { score: 61.1, display: "61.1%", cost: 0.39, effort: "Max" },
		},
	},
	{
		id: "gemini",
		name: "Gemini 3.6 Flash",
		fullName: "Gemini 3.6 Flash",
		maker: "Google",
		monogram: "GF",
		color: "#d7d9d4",
		copy: "The fast-model baseline in this field. It trails on two published runs, while FrontierCode coverage is still missing.",
		scores: {
			deepswe: { score: 49, display: "49%", cost: 3.53, effort: "High", margin: "±5%" },
			frontier: null,
			cursor: { score: 53.5, display: "53.5%", cost: 1.56, effort: "High" },
		},
	},
];

const benchmarks = {
	deepswe: {
		version: "DEEPSWE V1.1",
		title: "Original, long-horizon engineering",
		description: "113 tasks · mini-swe-agent · higher is better",
	},
	frontier: {
		version: "FRONTIERCODE 1.1 / MAIN",
		title: "Would a maintainer merge the PR?",
		description: "100 tasks · model-native harnesses · higher is better",
	},
	cursor: {
		version: "CURSORBENCH 3.2",
		title: "Ambiguous, multi-file session work",
		description: "real Cursor sessions · agent runs · higher is better",
	},
};

const terraEfforts = {
	high: {
		label: "High",
		copy: "Best for scoped fixes, familiar code, and fast iteration when tests give you a strong safety net.",
		title: "Move quickly, keep review close.",
		status: "HIGH / SELECTED",
		cursorScore: "54.2%",
		cursorCost: "$0.71 / task",
		frontierScore: "36.9%",
		frontierCost: "$1.10 / task",
		retained: "84–89%",
		retainedNote: "of Max scores",
	},
	xhigh: {
		label: "Extra High",
		copy: "The practical sweet spot for substantial feature work, refactors, and bug investigations. You keep most of Max’s score without paying Max’s full premium.",
		title: "Most of Max, for much less.",
		status: "XHIGH / SELECTED",
		cursorScore: "59.2%",
		cursorCost: "$1.15 / task",
		frontierScore: "38.7%",
		frontierCost: "$1.30 / task",
		retained: "91–94%",
		retainedNote: "across both benchmarks",
	},
	max: {
		label: "Max",
		copy: "Reserve Max for ambiguous, high-blast-radius changes, unfamiliar systems, and final passes where a missed edge case costs more than extra inference.",
		title: "Pay for the last few points.",
		status: "MAX / SELECTED",
		cursorScore: "64.9%",
		cursorCost: "$2.31 / task",
		frontierScore: "41.3%",
		frontierCost: "$1.81 / task",
		retained: "100%",
		retainedNote: "Terra’s published ceiling",
	},
};

let activeBenchmark = "deepswe";
let selectedModelId = "opus";

const ranking = document.getElementById("ranking");
const panel = document.getElementById("benchmark-panel");
const tabs = [...document.querySelectorAll(".benchmark-tab")];
const version = document.getElementById("benchmark-version");
const title = document.getElementById("benchmark-title");
const description = document.getElementById("benchmark-description");
const matrixBody = document.getElementById("matrix-body");
const effortControls = [...document.querySelectorAll(".effort-control")];
const effortRows = [...document.querySelectorAll(".effort-ladder-row")];

const effortGuide = {
	answer: document.getElementById("effort-answer"),
	copy: document.getElementById("effort-answer-copy"),
	title: document.getElementById("effort-evidence-title"),
	status: document.getElementById("effort-evidence-status"),
	cursorScore: document.getElementById("effort-cursor-score"),
	cursorCost: document.getElementById("effort-cursor-cost"),
	frontierScore: document.getElementById("effort-frontier-score"),
	frontierCost: document.getElementById("effort-frontier-cost"),
	retained: document.getElementById("effort-retained"),
	retainedNote: document.getElementById("effort-retained-note"),
};

const spotlight = {
	monogram: document.getElementById("spotlight-monogram"),
	rank: document.getElementById("spotlight-rank"),
	maker: document.getElementById("spotlight-maker"),
	name: document.getElementById("spotlight-name"),
	copy: document.getElementById("spotlight-copy"),
	score: document.getElementById("spotlight-score"),
	cost: document.getElementById("spotlight-cost"),
	effort: document.getElementById("spotlight-effort"),
	miniScores: document.getElementById("mini-scores"),
};

function sortedModels(benchmark) {
	return [...models].sort((a, b) => {
		const aScore = a.scores[benchmark]?.score ?? -1;
		const bScore = b.scores[benchmark]?.score ?? -1;
		return bScore - aScore;
	});
}

function formatCost(cost) {
	return `$${cost.toFixed(cost < 1 ? 2 : 2)}`;
}

function renderRanking() {
	const ranked = sortedModels(activeBenchmark);
	const benchmark = benchmarks[activeBenchmark];

	version.textContent = benchmark.version;
	title.textContent = benchmark.title;
	description.textContent = benchmark.description;
	panel.setAttribute("aria-labelledby", `tab-${activeBenchmark}`);
	ranking.replaceChildren();

	ranked.forEach((model, index) => {
		const result = model.scores[activeBenchmark];
		const row = document.createElement("button");
		row.type = "button";
		row.className = "rank-row";
		row.dataset.modelId = model.id;

		if (!result) {
			row.classList.add("is-missing");
			row.disabled = true;
			row.setAttribute("aria-label", `${model.fullName}: no result reported`);
		} else {
			row.setAttribute(
				"aria-label",
				`${model.fullName}, rank ${index + 1}, ${result.display}, average run cost ${formatCost(result.cost)}`,
			);
		}

		if (model.id === selectedModelId && result) row.classList.add("is-selected");

		const rankNumber = document.createElement("span");
		rankNumber.className = "rank-number";
		rankNumber.textContent = result ? String(index + 1).padStart(2, "0") : "—";

		const name = document.createElement("span");
		name.className = "rank-name";
		name.textContent = model.name;

		const barTrack = document.createElement("span");
		barTrack.className = "bar-track";
		if (result) {
			const barFill = document.createElement("span");
			barFill.className = "bar-fill";
			barFill.style.setProperty("--bar-width", `${(result.score / 80) * 100}%`);
			barFill.style.setProperty("--bar-color", model.color);
			barFill.style.animationDelay = `${index * 45}ms`;
			barTrack.append(barFill);
		}

		const score = document.createElement("span");
		score.className = "rank-score";
		score.textContent = result ? `${result.display}${result.margin ? ` ${result.margin}` : ""}` : "N/R";

		row.append(rankNumber, name, barTrack, score);
		if (result) {
			row.addEventListener("click", () => {
				selectedModelId = model.id;
				renderRanking();
				renderSpotlight();
			});
		}

		ranking.append(row);
	});
}

function renderSpotlight() {
	const ranked = sortedModels(activeBenchmark);
	let model = models.find((candidate) => candidate.id === selectedModelId);

	if (!model?.scores[activeBenchmark]) {
		model = ranked.find((candidate) => candidate.scores[activeBenchmark]);
		selectedModelId = model.id;
	}

	const result = model.scores[activeBenchmark];
	const rank = ranked.filter((candidate) => candidate.scores[activeBenchmark]).indexOf(model) + 1;

	spotlight.monogram.textContent = model.monogram;
	spotlight.rank.textContent = `RANK ${String(rank).padStart(2, "0")}`;
	spotlight.maker.textContent = model.maker;
	spotlight.name.textContent = model.fullName;
	spotlight.copy.textContent = model.copy;
	spotlight.score.textContent = `${result.display}${result.margin ? ` ${result.margin}` : ""}`;
	spotlight.cost.textContent = formatCost(result.cost);
	spotlight.effort.textContent = result.effort;
	spotlight.miniScores.replaceChildren();

	for (const [key, label] of [
		["deepswe", "Deep"],
		["frontier", "Frontier"],
		["cursor", "Cursor"],
	]) {
		const score = model.scores[key];
		const item = document.createElement("div");
		item.className = "mini-score";

		const value = document.createElement("b");
		value.textContent = score ? score.score.toFixed(score.score % 1 ? 1 : 0) : "N/R";

		const caption = document.createElement("span");
		caption.textContent = label;

		item.append(value, caption);
		spotlight.miniScores.append(item);
	}
}

function renderMatrix() {
	const winners = {
		deepswe: Math.max(...models.map((model) => model.scores.deepswe?.score ?? -1)),
		frontier: Math.max(...models.map((model) => model.scores.frontier?.score ?? -1)),
		cursor: Math.max(...models.map((model) => model.scores.cursor?.score ?? -1)),
	};

	matrixBody.replaceChildren();

	for (const model of models) {
		const row = document.createElement("tr");
		const modelCell = document.createElement("th");
		modelCell.scope = "row";
		modelCell.innerHTML = `<span class="table-model"><span class="table-monogram">${model.monogram}</span>${model.fullName}</span>`;
		row.append(modelCell);

		for (const key of ["deepswe", "frontier", "cursor"]) {
			const cell = document.createElement("td");
			const result = model.scores[key];
			const value = document.createElement("span");
			value.className = "table-value";

			if (result) {
				if (result.score === winners[key]) value.classList.add("is-winner");
				const score = document.createElement("strong");
				score.textContent = result.display;
				const cost = document.createElement("small");
				cost.textContent = formatCost(result.cost);
				value.append(score, cost);
			} else {
				const score = document.createElement("strong");
				score.textContent = "N/R";
				const cost = document.createElement("small");
				cost.textContent = "not reported";
				value.append(score, cost);
			}

			cell.append(value);
			row.append(cell);
		}

		matrixBody.append(row);
	}
}

function renderEffortGuide(effort) {
	const recommendation = terraEfforts[effort];

	effortGuide.answer.textContent = recommendation.label;
	effortGuide.copy.textContent = recommendation.copy;
	effortGuide.title.textContent = recommendation.title;
	effortGuide.status.textContent = recommendation.status;
	effortGuide.cursorScore.textContent = recommendation.cursorScore;
	effortGuide.cursorCost.textContent = recommendation.cursorCost;
	effortGuide.frontierScore.textContent = recommendation.frontierScore;
	effortGuide.frontierCost.textContent = recommendation.frontierCost;
	effortGuide.retained.textContent = recommendation.retained;
	effortGuide.retainedNote.textContent = recommendation.retainedNote;

	effortControls.forEach((control) => {
		const isActive = control.dataset.effort === effort;
		control.classList.toggle("is-active", isActive);
		control.setAttribute("aria-pressed", String(isActive));
	});

	effortRows.forEach((row) => {
		row.classList.toggle("is-selected", row.dataset.effortRow === effort);
	});
}

tabs.forEach((tab) => {
	tab.addEventListener("click", () => {
		activeBenchmark = tab.dataset.benchmark;
		selectedModelId = sortedModels(activeBenchmark).find(
			(model) => model.scores[activeBenchmark],
		).id;

		tabs.forEach((candidate) => {
			const isActive = candidate === tab;
			candidate.classList.toggle("is-active", isActive);
			candidate.setAttribute("aria-selected", String(isActive));
		});

		renderRanking();
		renderSpotlight();
	});
});

effortControls.forEach((control) => {
	control.addEventListener("click", () => {
		renderEffortGuide(control.dataset.effort);
	});
});

renderRanking();
renderSpotlight();
renderMatrix();
renderEffortGuide("xhigh");
