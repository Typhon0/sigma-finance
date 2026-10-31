import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/api-keys")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="api-keys" fullWidth>
				<ApiKeysManager />
			</SettingsLayout>
		</ProtectedRoute>
	),
});

