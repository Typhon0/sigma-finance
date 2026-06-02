import { createFileRoute } from "@tanstack/react-router";
import { CryptoMarketOverview } from "@/components/assets/crypto/CryptoMarketOverview";
import { ProtectedRoute } from "@/components/auth/protected-route";

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
