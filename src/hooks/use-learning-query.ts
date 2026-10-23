import { type OptionalRestArgsOrSkip, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useAccess } from "~/context/AccessContext";
/** Do not subscribe to protected learning data before this process verifies access.
 * The backend independently enforces eligibility; this prevents hidden routes from throwing during routing.
 */
export function useLearningQuery<Query extends FunctionReference<"query">>(
	query: Query,
	...args: OptionalRestArgsOrSkip<Query>
) {
	const { access } = useAccess();
	// Convex's documented skip form is the same single tuple for every query signature.
	const gated = access?.canUseApp
		? args
		: (["skip"] as OptionalRestArgsOrSkip<Query>);
	return useQuery(query, ...gated);
}
