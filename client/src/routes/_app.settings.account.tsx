import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/account")({
	component: () => (
		<ProtectedRoute>
			<SettingsLayout activeSection="account">
				<AccountSettings />
			</SettingsLayout>
		</ProtectedRoute>
	),
});
