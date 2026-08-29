import { createLazyFileRoute } from "@tanstack/react-router";
import { MetricsDashboard } from "@/components/admin/MetricsDashboard";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/metrics")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="metrics" fullWidth={true}>
				<MetricsDashboard />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
