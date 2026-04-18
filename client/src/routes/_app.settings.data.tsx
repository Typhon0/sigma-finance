import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DataSettings } from "@/components/settings/DataSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/data")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="data">
				<DataSettings />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
