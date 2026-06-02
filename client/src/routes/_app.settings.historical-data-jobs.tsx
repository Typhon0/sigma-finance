import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { HistoricalDataJobsSettings } from "@/components/settings/HistoricalDataJobsSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/historical-data-jobs")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="historical-data-jobs">
				<HistoricalDataJobsSettings />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
