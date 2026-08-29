import { createFileRoute } from "@tanstack/react-router";

export interface VerifyEmailSearch {
	token?: string;
}

export const Route = createFileRoute("/auth/verify-email")({
	validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => {
		return {
			token: typeof search.token === "string" ? search.token : undefined,
		};
	},
});
