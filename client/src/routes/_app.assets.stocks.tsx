import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { StocksFundsModule } from "@/components/StocksFundsModule";

export const Route = createFileRoute("/_app/assets/stocks")({
	component: () => (
		<ProtectedRoute>
			<StocksFundsModule />
		</ProtectedRoute>
	),
});
