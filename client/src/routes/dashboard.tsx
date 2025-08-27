import { createFileRoute } from "@tanstack/react-router";
import DashboardHomePage from "@/pages/dashboard-home";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/dashboard")({
	component: () => (
		<ProtectedRoute>
			<DashboardHomePage />
		</ProtectedRoute>
	),
});
