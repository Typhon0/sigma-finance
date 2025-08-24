import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	beforeLoad: () => {
		// Redirect to dashboard as the default landing page for authenticated users
		// In a real app, you would check authentication status here
		throw redirect({
			to: "/dashboard",
		});
	},
});
