import { createFileRoute } from "@tanstack/react-router";
import { LogViewer } from "@/components/settings/LogViewer";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/logs")({
	component: () => (
		<SettingsLayout activeSection="logs" fullWidth={true}>
			<LogViewer />
		</SettingsLayout>
	),
});
