import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import ChartDemo from "@/pages/ChartDemo";

export const Route = createLazyFileRoute("/charts")({
	component: () => (
		<ProtectedRoute>
			<ChartDemo />
		</ProtectedRoute>
	),
});
