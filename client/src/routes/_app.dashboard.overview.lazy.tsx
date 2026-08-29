import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DensityDashboard } from "@/components/dashboard/DensityGrid";

export const Route = createLazyFileRoute("/_app/dashboard/overview")({
	component: () => (
		<ProtectedRoute>
			<DensityDashboard />
		</ProtectedRoute>
	),
});
