import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import MarketDataTest from "@/pages/MarketDataTest";

export const Route = createLazyFileRoute("/market-data-test")({
	component: () => (
		<ProtectedRoute>
			<MarketDataTest />
		</ProtectedRoute>
	),
});
