import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StockMarketOverview } from "@/components/StockMarketOverview";

export const Route = createFileRoute("/_app/dashboard/stock-market-overview")({
	component: () => (
		<ProtectedRoute>
			<StockMarketOverview
				onNavigateToStockScreener={() => {}}
				onNavigateToHeatmap={() => {}}
				onNavigateToCalendar={() => {}}
				onSelectStock={() => {}}
			/>
		</ProtectedRoute>
	),
});
