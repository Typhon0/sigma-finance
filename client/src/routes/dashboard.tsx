import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import DashboardHomePage from "@/pages/dashboard-home";

export const Route = createFileRoute("/dashboard")({
	component: () => (
		<ProtectedRoute>
			<DashboardHomePage />
		</ProtectedRoute>
	),
});
