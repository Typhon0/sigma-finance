import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Dashboard } from "@/components/Dashboard";
import { useAuth } from "@/lib/auth-context";

function DashboardPage() {
	const { user, logout } = useAuth();

	return <Dashboard user={user} onLogout={logout} />;
}

export const Route = createFileRoute("/_app/dashboard")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			portfolioId: search.portfolioId as string | undefined,
			view: search.view as string | undefined,
		};
	},
	component: () => (
		<ProtectedRoute>
			<DashboardPage />
		</ProtectedRoute>
	),
});
