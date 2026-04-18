import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { PortfolioListPage } from "@/components/portfolio/portfolio-list-page";

function PortfoliosPageWithSidebar() {
	return (
		<div className="flex flex-col h-full">
			<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
				<div className="flex items-center gap-2 px-4">
					<PortfolioBreadcrumb items={portfolioBreadcrumbs.portfolioList()} />
				</div>
			</header>
			<main className="flex-1">
				<PortfolioListPage />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/_app/portfolios")({
	component: () => (
		<ProtectedRoute>
			<PortfoliosPageWithSidebar />
		</ProtectedRoute>
	),
});
