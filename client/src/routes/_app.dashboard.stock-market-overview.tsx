import { createFileRoute } from "@tanstack/react-router";
import { StockMarketOverview } from "@/components/assets/stocks-funds/StockMarketOverview";
import { ProtectedRoute } from "@/components/auth/protected-route";

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
