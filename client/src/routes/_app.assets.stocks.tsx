import { createFileRoute } from "@tanstack/react-router";
import { StocksFundsModule } from "@/components/assets/stocks-funds/StocksFundsModule";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/stocks")({
	component: () => (
		<ProtectedRoute>
			<StocksFundsModule />
		</ProtectedRoute>
	),
});
