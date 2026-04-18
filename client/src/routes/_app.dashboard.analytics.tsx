import { createFileRoute } from "@tanstack/react-router";
import { Analytics } from "@/components/Analytics";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/dashboard/analytics")({
	component: () => (
		<ProtectedRoute>
			<Analytics />
		</ProtectedRoute>
	),
});
