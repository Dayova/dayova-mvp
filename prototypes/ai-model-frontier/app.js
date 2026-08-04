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

const effortLabels = {
	low: "Low",
	medium: "Medium",
	high: "High",
	xhigh: "Extra High",
	max: "Max",
};

const modeLabels = {
	economy: { answer: "Cheaper alternative", chip: "CHEAPER ALTERNATIVE" },
	recommended: { answer: "Recommended default", chip: "RECOMMENDED DEFAULT" },
	ceiling: { answer: "Capability ceiling", chip: "CAPABILITY CEILING" },
};

const effortModels = {
	opus: {
		choices: {
			economy: {
				effort: "low",
				title: "The economical flagship run.",
				copy: "Use Low for scoped, well-tested work when you still want Opus-level judgment but do not need its full search budget.",
			},
			recommended: {
				effort: "medium",
				title: "The strongest cross-benchmark trade-off.",
				copy: "Medium is the evidence-led default: it posts Opus 5’s best FrontierCode score and remains within 5.7 points of its CursorBench ceiling.",
			},
			ceiling: {
				effort: "max",
				title: "Cursor ceiling, not a universal win.",
				copy: "Max reaches Opus 5’s highest CursorBench score. FrontierCode is non-monotonic, so more effort did not outperform Medium there.",
			},
		},
		note: "Opus 5 has complete ladders, but FrontierCode peaks at Medium and then regresses. Treat Max as a Cursor-heavy choice, not an automatic upgrade.",
		efforts: {
			low: { cursor: { score: 62.8, cost: 2.55 }, frontier: { score: 41.9, cost: 2.7 } },
			medium: { cursor: { score: 64.3, cost: 3.29 }, frontier: { score: 53.4, cost: 4.3 } },
			high: { cursor: { score: 66.7, cost: 3.91 }, frontier: { score: 48.0, cost: 7.2 } },
			xhigh: { cursor: { score: 69.3, cost: 7.35 }, frontier: { score: 43.6, cost: 9.1 } },
			max: { cursor: { score: 70.0, cost: 8.23 }, frontier: { score: 48.0, cost: 11.4 } },
		},
	},
	fable: {
		choices: {
			economy: {
				effort: "medium",
				title: "Spend less without leaving the frontier.",
				copy: "Medium keeps Fable above 65 on CursorBench while cutting the published run cost sharply versus its highest settings.",
			},
			recommended: {
				effort: "high",
				title: "The balanced Fable run.",
				copy: "High is the practical default: it is close to Fable’s best result on both ladders without paying Extra High or Max pricing.",
			},
			ceiling: {
				effort: "max",
				title: "The Cursor ceiling carries a warning.",
				copy: "Max wins CursorBench, but FrontierCode peaks at Extra High and slips at Max. Use it when real-session capability matters most.",
			},
		},
		note: "Fable 5 has complete ladders. CursorBench rises steadily to Max; FrontierCode peaks at Extra High, so the final setting is not universally best.",
		efforts: {
			low: { cursor: { score: 62.1, cost: 4.46 }, frontier: { score: 48.0, cost: 4.9232 } },
			medium: { cursor: { score: 65.2, cost: 6.8 }, frontier: { score: 49.8, cost: 7.1539 } },
			high: { cursor: { score: 66.5, cost: 8.77 }, frontier: { score: 52.7, cost: 9.4805 } },
			xhigh: { cursor: { score: 68.4, cost: 11.73 }, frontier: { score: 53.5, cost: 13.0938 } },
			max: { cursor: { score: 70.5, cost: 17.32 }, frontier: { score: 51.6, cost: 19.0696 } },
		},
	},
	sol: {
		choices: {
			economy: {
				effort: "high",
				title: "A strong flagship run on a leash.",
				copy: "High is the cheaper serious-work setting: it clears 63 on CursorBench and stays within 2.4 points of Sol’s FrontierCode maximum.",
			},
			recommended: {
				effort: "xhigh",
				title: "Near the ceiling, below Max cost.",
				copy: "Extra High is the best everyday balance for ambiguous repository work, landing close to Max on both published ladders.",
			},
			ceiling: {
				effort: "max",
				title: "Pay for Sol’s last few points.",
				copy: "Max is justified for high-blast-radius changes, unfamiliar systems, and final passes where a missed edge case costs more than the run.",
			},
		},
		note: "Sol has complete, monotonic effort ladders on both benchmarks. The main question is how much the final few points are worth to your task.",
		efforts: {
			low: { cursor: { score: 52.6, cost: 1.01 }, frontier: { score: 35.4, cost: 2.1 } },
			medium: { cursor: { score: 60.0, cost: 1.95 }, frontier: { score: 39.9, cost: 3.1 } },
			high: { cursor: { score: 63.5, cost: 2.79 }, frontier: { score: 45.1, cost: 4.1 } },
			xhigh: { cursor: { score: 64.5, cost: 3.88 }, frontier: { score: 46.8, cost: 5.0 } },
			max: { cursor: { score: 67.2, cost: 5.69 }, frontier: { score: 47.5, cost: 6.3 } },
		},
	},
	terra: {
		choices: {
			economy: {
				effort: "high",
				title: "Move quickly, keep review close.",
				copy: "High fits scoped fixes, familiar code, and fast iteration when tests provide a strong safety net.",
			},
			recommended: {
				effort: "xhigh",
				title: "Most of Max, for much less.",
				copy: "Extra High is the practical sweet spot for substantial feature work and investigations: most of Max’s score without Max’s full premium.",
			},
			ceiling: {
				effort: "max",
				title: "Pay for Terra’s last few points.",
				copy: "Reserve Max for ambiguous, high-blast-radius changes and final passes where a missed edge case costs more than extra inference.",
			},
		},
		note: "Terra has complete CursorBench and FrontierCode effort ladders; both improve steadily as effort rises.",
		efforts: {
			low: { cursor: { score: 46.9, cost: 0.42 }, frontier: { score: 24.1, cost: 0.413 } },
			medium: { cursor: { score: 50.3, cost: 0.49 }, frontier: { score: 33.9, cost: 0.728 } },
			high: { cursor: { score: 54.2, cost: 0.71 }, frontier: { score: 36.9, cost: 1.099 } },
			xhigh: { cursor: { score: 59.2, cost: 1.15 }, frontier: { score: 38.7, cost: 1.296 } },
			max: { cursor: { score: 64.9, cost: 2.31 }, frontier: { score: 41.3, cost: 1.806 } },
		},
	},
	luna: {
		choices: {
			economy: {
				effort: "high",
				title: "Serious work at throughput pricing.",
				copy: "High makes the large jump from Medium on both ladders while keeping average benchmark costs below a quarter per task.",
			},
			recommended: {
				effort: "xhigh",
				title: "Luna’s efficiency sweet spot.",
				copy: "Extra High lands within 3.4 points of Max on CursorBench and within 0.9 on FrontierCode, while remaining exceptionally inexpensive.",
			},
			ceiling: {
				effort: "max",
				title: "The cheapest published ceiling here.",
				copy: "Max is reasonable when you need every point: even Luna’s highest effort remains far below the field’s flagship benchmark costs.",
			},
		},
		note: "Luna has complete, monotonic ladders. Extra High nearly reaches its FrontierCode ceiling; Max adds more on CursorBench than on FrontierCode.",
		efforts: {
			low: { cursor: { score: 37.6, cost: 0.03 }, frontier: { score: 15.4, cost: 0.044 } },
			medium: { cursor: { score: 47.7, cost: 0.08 }, frontier: { score: 25.7, cost: 0.11 } },
			high: { cursor: { score: 56.8, cost: 0.16 }, frontier: { score: 35.9, cost: 0.215 } },
			xhigh: { cursor: { score: 57.7, cost: 0.23 }, frontier: { score: 38.9, cost: 0.299 } },
			max: { cursor: { score: 61.1, cost: 0.39 }, frontier: { score: 39.8, cost: 0.361 } },
		},
	},
	kimi: {
		choices: {
			economy: {
				effort: "low",
				title: "The low-cost Kimi pass.",
				copy: "Low suits triage and tightly bounded edits. CursorBench shows a meaningful capability jump when you move to High.",
			},
			recommended: {
				effort: "high",
				title: "The clear Kimi balance point.",
				copy: "High gains 9.2 CursorBench points over Low; Max adds only another 1.1 points for a further $0.81 per benchmark task.",
			},
			ceiling: {
				effort: "max",
				title: "A small final lift.",
				copy: "Use Max when the last CursorBench point matters. FrontierCode only reports a default Kimi run, so it cannot confirm an effort-level gain.",
			},
		},
		note: "Kimi K3 has a three-step CursorBench ladder. FrontierCode reports one default-only run—44.2% at $3.82—so it is not mapped to Low, High, or Max.",
		efforts: {
			low: { cursor: { score: 50.5, cost: 0.99 }, frontier: null },
			high: { cursor: { score: 59.7, cost: 1.89 }, frontier: null },
			max: { cursor: { score: 60.8, cost: 2.7 }, frontier: null },
		},
	},
	gemini: {
		choices: {
			economy: {
				effort: "medium",
				title: "A small saving, a modest score trade.",
				copy: "Medium saves little versus High, but it is the lower-cost option when the task is routine and tightly constrained.",
			},
			recommended: {
				effort: "high",
				title: "Use the highest tested setting.",
				copy: "High is both the recommended default and the published ceiling: it adds 2.3 CursorBench points over Medium for only $0.08 more per task.",
			},
			ceiling: {
				effort: "high",
				title: "High is the current ceiling.",
				copy: "No higher Gemini 3.6 Flash setting is published in CursorBench, and FrontierCode has not reported this model yet.",
			},
		},
		note: "Gemini 3.6 Flash has a three-step CursorBench ladder and no FrontierCode result. The recommendation therefore rests on one benchmark family.",
		efforts: {
			low: { cursor: { score: 47.4, cost: 1.13 }, frontier: null },
			medium: { cursor: { score: 51.2, cost: 1.48 }, frontier: null },
			high: { cursor: { score: 53.5, cost: 1.56 }, frontier: null },
		},
	},
};

let activeBenchmark = "deepswe";
let selectedModelId = "opus";
let selectedEffortModelId = "terra";
let selectedEffortChoice = "recommended";

const ranking = document.getElementById("ranking");
const panel = document.getElementById("benchmark-panel");
const tabs = [...document.querySelectorAll(".benchmark-tab")];
const version = document.getElementById("benchmark-version");
const title = document.getElementById("benchmark-title");
const description = document.getElementById("benchmark-description");
const matrixBody = document.getElementById("matrix-body");
const effortControls = [...document.querySelectorAll(".effort-control")];
const effortModelSelect = document.getElementById("effort-model-select");
const effortLadderBody = document.getElementById("effort-ladder-body");

const effortGuide = {
	advisor: document.getElementById("effort-advisor"),
	modelMonogram: document.getElementById("effort-model-monogram"),
	modeChip: document.getElementById("effort-mode-chip"),
	answerLabel: document.getElementById("effort-answer-label"),
	answer: document.getElementById("effort-answer"),
	copy: document.getElementById("effort-answer-copy"),
	title: document.getElementById("effort-evidence-title"),
	status: document.getElementById("effort-evidence-status"),
	cursorScore: document.getElementById("effort-cursor-score"),
	cursorCost: document.getElementById("effort-cursor-cost"),
	frontierScore: document.getElementById("effort-frontier-score"),
	frontierCost: document.getElementById("effort-frontier-cost"),
	coverage: document.getElementById("effort-coverage"),
	coverageNote: document.getElementById("effort-coverage-note"),
	modelNote: document.getElementById("effort-model-note"),
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

function setEffortMetric(metric, scoreElement, costElement) {
	if (metric) {
		scoreElement.textContent = `${metric.score.toFixed(1)}%`;
		costElement.textContent = `${formatCost(metric.cost)} / task`;
		return;
	}

	scoreElement.textContent = "N/R";
	costElement.textContent = "no matched effort run";
}

function createEffortMetric(metric) {
	const cell = document.createElement("span");
	const cost = document.createElement("small");

	if (metric) {
		cell.append(document.createTextNode(`${metric.score.toFixed(1)}%`));
		cost.textContent = formatCost(metric.cost);
	} else {
		cell.append(document.createTextNode("N/R"));
		cost.textContent = "not reported";
	}

	cell.append(cost);
	return cell;
}

function renderEffortGuide(modelId = selectedEffortModelId, choice = selectedEffortChoice) {
	const model = models.find((candidate) => candidate.id === modelId);
	const guide = effortModels[modelId];
	const recommendation = guide.choices[choice];
	const effort = recommendation.effort;
	const metrics = guide.efforts[effort];
	const mode = modeLabels[choice];
	const coverage = Number(Boolean(metrics.cursor)) + Number(Boolean(metrics.frontier));

	selectedEffortModelId = modelId;
	selectedEffortChoice = choice;
	effortModelSelect.value = modelId;
	effortGuide.advisor.style.setProperty("--advisor-accent", model.color);
	effortGuide.modelMonogram.textContent = model.monogram;
	effortGuide.modeChip.textContent = mode.chip;
	effortGuide.answerLabel.textContent = mode.answer;
	effortGuide.answer.textContent = effortLabels[effort];
	effortGuide.copy.textContent = recommendation.copy;
	effortGuide.title.textContent = recommendation.title;
	effortGuide.status.textContent = `${effortLabels[effort].toUpperCase()} / SELECTED`;
	effortGuide.coverage.textContent = `${coverage} / 2`;
	effortGuide.coverageNote.textContent = coverage === 2 ? "matched effort ladders" : "matched effort ladder";
	effortGuide.modelNote.textContent = guide.note;

	setEffortMetric(metrics.cursor, effortGuide.cursorScore, effortGuide.cursorCost);
	setEffortMetric(metrics.frontier, effortGuide.frontierScore, effortGuide.frontierCost);

	effortControls.forEach((control) => {
		const controlChoice = control.dataset.choice;
		const isActive = controlChoice === choice;
		control.querySelector("small").textContent = effortLabels[guide.choices[controlChoice].effort];
		control.classList.toggle("is-active", isActive);
		control.setAttribute("aria-pressed", String(isActive));
	});

	effortLadderBody.replaceChildren();
	for (const [effortKey, effortMetrics] of Object.entries(guide.efforts)) {
		const row = document.createElement("div");
		row.className = "effort-ladder-row";
		if (effortKey === effort) row.classList.add("is-selected");

		const label = document.createElement("strong");
		label.textContent = effortLabels[effortKey];
		row.append(label, createEffortMetric(effortMetrics.cursor), createEffortMetric(effortMetrics.frontier));
		effortLadderBody.append(row);
	}
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
		renderEffortGuide(selectedEffortModelId, control.dataset.choice);
	});
});

effortModelSelect.addEventListener("change", () => {
	renderEffortGuide(effortModelSelect.value, "recommended");
});

renderRanking();
renderSpotlight();
renderMatrix();
renderEffortGuide();
