import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { StocksFundsModule } from "@/components/assets/stocks-funds/StocksFundsModule";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/stocks")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<StocksFundsModule onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
