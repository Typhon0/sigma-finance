import { createFileRoute } from "@tanstack/react-router";

export interface ResetPasswordConfirmSearch {
	token?: string;
}

export const Route = createFileRoute("/auth/reset-password/confirm")({
	validateSearch: (search: Record<string, unknown>): ResetPasswordConfirmSearch => {
		return {
			token: typeof search.token === "string" ? search.token : undefined,
		};
	},
});
