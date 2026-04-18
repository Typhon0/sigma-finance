import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import MarketDataTest from "@/pages/MarketDataTest";

export const Route = createFileRoute("/market-data-test")({
	component: () => (
		<ProtectedRoute>
			<MarketDataTest />
		</ProtectedRoute>
	),
});
