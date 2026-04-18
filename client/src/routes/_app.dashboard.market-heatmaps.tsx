import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MarketHeatmaps } from "@/components/MarketHeatmaps";

export const Route = createFileRoute("/_app/dashboard/market-heatmaps")({
	component: () => (
		<ProtectedRoute>
			<MarketHeatmaps onFilterStock={() => {}} onFilterCrypto={() => {}} />
		</ProtectedRoute>
	),
});
