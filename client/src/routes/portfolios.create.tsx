import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import PortfolioCreatePage from "@/pages/portfolio-create";

export const Route = createFileRoute("/portfolios/create")({
	component: () => (
		<ProtectedRoute>
			<PortfolioCreatePage />
		</ProtectedRoute>
	),
});
