import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type ParentPullRequest = {
	number: number;
	state: string;
	head: { ref: string; repo: { full_name: string } | null };
	base: { ref: string; repo: { full_name: string } | null };
};

/** Follow open PR bases, rather than guessing a stack's destination from Git ancestry. */
export async function reachesMainThroughOpenPrs(
	baseRef: string,
	repository: string,
	request: typeof fetch = fetch,
): Promise<boolean> {
	if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !baseRef) {
		throw new Error("A repository and PR base ref are required.");
	}
	if (baseRef === "main") return true;

	// Fetch the open PR list once, then follow the stack locally. A per-parent
	// lookup can exhaust GitHub's unauthenticated API limit for deep stacks.
	const candidates: ParentPullRequest[] = [];
	for (let page = 1; page <= 20; page++) {
		const url = new URL(`https://api.github.com/repos/${repository}/pulls`);
		url.searchParams.set("state", "open");
		url.searchParams.set("per_page", "100");
		url.searchParams.set("page", String(page));
		const response = await request(url, {
			headers: {
				Accept: "application/vnd.github+json",
				"User-Agent": "dayova-ota-stack-root",
			},
		});
		if (!response.ok) {
			throw new Error(`GitHub PR lookup failed with HTTP ${response.status}.`);
		}
		const pageCandidates = (await response.json()) as ParentPullRequest[];
		if (!Array.isArray(pageCandidates)) return false;
		candidates.push(...pageCandidates);
		if (pageCandidates.length < 100) break;
		if (page === 20) return false;
	}

	const seen = new Set<string>();

	for (let depth = 0; depth < 20; depth++) {
		if (baseRef === "main") return true;
		if (seen.has(baseRef)) return false;
		seen.add(baseRef);

		const parents = candidates.filter(
			(pr) =>
				pr.state === "open" &&
				pr.head?.ref === baseRef &&
				pr.head.repo?.full_name.toLowerCase() === repository.toLowerCase() &&
				pr.base.repo?.full_name.toLowerCase() === repository.toLowerCase(),
		);
		if (parents.length !== 1) return false;
		baseRef = parents[0].base.ref;
	}
	return false;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
	try {
		const reachesMain = await reachesMainThroughOpenPrs(
			process.env.PR_BASE_REF ?? "",
			process.env.PR_REPOSITORY ?? "",
		);
		process.stdout.write(`${reachesMain}\n`);
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}
