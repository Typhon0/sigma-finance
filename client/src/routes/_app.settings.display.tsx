import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DisplaySettings } from "@/components/settings/DisplaySettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/display")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="display">
				<DisplaySettings />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
