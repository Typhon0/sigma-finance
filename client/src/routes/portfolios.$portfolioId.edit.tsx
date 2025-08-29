import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import PortfolioEditPage from "@/pages/portfolio-edit";

export const Route = createFileRoute("/portfolios/$portfolioId/edit")({
	component: () => (
		<ProtectedRoute>
			<PortfolioEditPage />
		</ProtectedRoute>
	),
});