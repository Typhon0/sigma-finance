import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MarketDataSettingsWrapper } from "@/components/MarketDataSettingsWrapper";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/market-data")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="market-data">
				<MarketDataSettingsWrapper showHeader={true} />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
