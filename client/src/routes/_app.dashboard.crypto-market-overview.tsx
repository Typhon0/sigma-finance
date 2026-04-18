import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CryptoMarketOverview } from "@/components/CryptoMarketOverview";

export const Route = createFileRoute("/_app/dashboard/crypto-market-overview")({
	component: () => (
		<ProtectedRoute>
			<CryptoMarketOverview
				onNavigateToCryptoScreener={() => {}}
				onNavigateToHeatmap={() => {}}
				onSelectCrypto={() => {}}
			/>
		</ProtectedRoute>
	),
});
