import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import PortfolioDetailPage from "@/pages/portfolio-detail";

export const Route = createFileRoute("/portfolios/$portfolioId")({
	component: () => (
		<ProtectedRoute>
			<PortfolioDetailPage />
		</ProtectedRoute>
	),
});
