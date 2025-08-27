import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		// Check if user is authenticated
		const token = localStorage.getItem('auth_token');
		
		if (token) {
			// Redirect authenticated users to dashboard
			throw redirect({
				to: "/dashboard",
			});
		} else {
			// Redirect unauthenticated users to login
			throw redirect({
				to: "/auth/login",
			});
		}
	},
});
