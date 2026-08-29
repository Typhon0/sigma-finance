import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MarketDataCenter } from "@/components/settings/MarketDataCenter";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/market-data")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="market-data">
				<MarketDataCenter />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
