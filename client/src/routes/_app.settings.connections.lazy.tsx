import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ConnectedAccountsManager } from "@/components/settings/ConnectedAccountsManager";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/connections")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="connections" fullWidth>
				<ConnectedAccountsManager />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
