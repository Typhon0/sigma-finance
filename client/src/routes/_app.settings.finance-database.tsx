import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinanceDatabaseSettings } from "@/components/settings/FinanceDatabaseSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/finance-database")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="finance-database">
				<FinanceDatabaseSettings />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
