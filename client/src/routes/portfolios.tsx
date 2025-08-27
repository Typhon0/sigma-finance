import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import PortfoliosPage from "@/pages/portfolios";

export const Route = createFileRoute("/portfolios")({
	component: () => (
		<ProtectedRoute>
			<PortfoliosPage />
		</ProtectedRoute>
	),
});
