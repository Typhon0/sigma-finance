import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		code: typeof search.code === "string" ? search.code : undefined,
		state: typeof search.state === "string" ? search.state : undefined,
	}),
	beforeLoad: ({ search }) => {
		// If returning from Enable Banking or OAuth callback at root URL, preserve credentials and route to callback
		if (search?.code && search?.state) {
			throw redirect({
				to: "/sync/callback",
				search: {
					code: search.code,
					state: search.state,
					error: undefined,
					error_description: undefined,
				},
			});
		}

		// Check if user is authenticated
		const token = localStorage.getItem("auth_token");

		if (token) {
			// Redirect authenticated users to dashboard
			throw redirect({
				to: "/dashboard",
				search: { portfolioId: undefined, view: undefined },
			});
		} else {
			// Redirect unauthenticated users to login
			throw redirect({
				to: "/auth/login",
			});
		}
	},
});
