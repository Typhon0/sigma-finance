import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EnhancedPortfolioForm } from "@/components/portfolio/enhanced-portfolio-form";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";

export const Route = createLazyFileRoute("/_app/portfolios/$portfolioId/edit")({
	component: () => {
		const { portfolioId } = useParams({ from: "/_app/portfolios/$portfolioId/edit" });
		return (
			<ProtectedRoute>
				<div className="flex flex-col h-full">
					<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear">
						<div className="flex items-center gap-2 px-4">
							<PortfolioBreadcrumb
								items={portfolioBreadcrumbs.portfolioEdit(undefined, portfolioId)}
							/>
						</div>
					</header>
					<main className="flex-1 p-6">
						<EnhancedPortfolioForm
							portfolio={{ id: portfolioId, name: "" }}
							mode="edit"
							onSubmit={async () => {}}
							onCancel={() => {}}
						/>
					</main>
				</div>
			</ProtectedRoute>
		);
	},
});
