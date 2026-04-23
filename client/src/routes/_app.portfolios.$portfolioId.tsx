import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/portfolios/$portfolioId")({
	beforeLoad: ({ params }) => {
		// Redirect to dashboard with portfolio ID as a search param
		// The dashboard can then automatically open the portfolio detail view
		throw redirect({
			to: "/dashboard",
			search: { portfolioId: params.portfolioId, view: undefined },
		});
	},
});
