import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LogViewer } from "@/components/settings/LogViewer";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/logs")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="logs" fullWidth={true}>
				<LogViewer />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
