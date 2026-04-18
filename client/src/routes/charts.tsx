import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import ChartDemo from "@/pages/ChartDemo";

export const Route = createFileRoute("/charts")({
	component: () => (
		<ProtectedRoute>
			<ChartDemo />
		</ProtectedRoute>
	),
});
