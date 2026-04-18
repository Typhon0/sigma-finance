import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { WatchlistManagement } from "@/components/WatchlistManagement";

export const Route = createFileRoute("/_app/dashboard/watchlist")({
	component: () => (
		<ProtectedRoute>
			<WatchlistManagement />
		</ProtectedRoute>
	),
});
