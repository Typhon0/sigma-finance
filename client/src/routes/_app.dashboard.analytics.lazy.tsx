import { createLazyFileRoute } from "@tanstack/react-router";
import { Analytics } from "@/components/Analytics";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/dashboard/analytics")({
	component: () => (
		<ProtectedRoute>
			<Analytics />
		</ProtectedRoute>
	),
});
