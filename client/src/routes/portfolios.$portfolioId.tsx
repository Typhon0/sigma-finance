import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/portfolios/$portfolioId")({
	beforeLoad: ({ params }) => {
		// Redirect to dashboard with portfolio ID as a search param
		// The dashboard can then automatically open the portfolio detail view
		throw redirect({
			to: "/dashboard",
			search: { portfolioId: params.portfolioId },
		});
	},
});
