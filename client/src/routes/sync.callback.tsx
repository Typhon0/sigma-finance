import { createFileRoute } from "@tanstack/react-router";

export interface SyncCallbackSearch {
	code?: string;
	state?: string;
	error?: string;
	error_description?: string;
}

export const Route = createFileRoute("/sync/callback")({
	validateSearch: (search: Record<string, unknown>): SyncCallbackSearch => ({
		code: typeof search.code === "string" ? search.code : undefined,
		state: typeof search.state === "string" ? search.state : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
		error_description:
			typeof search.error_description === "string" ? search.error_description : undefined,
	}),
});
