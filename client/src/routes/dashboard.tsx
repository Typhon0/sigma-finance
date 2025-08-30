import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import DashboardHomePage from "@/pages/dashboard-home";

export const Route = createFileRoute("/dashboard")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			portfolioId: search.portfolioId as string | undefined,
		};
	},
	component: () => (
		<ProtectedRoute>
			<DashboardHomePage />
		</ProtectedRoute>
	),
});
