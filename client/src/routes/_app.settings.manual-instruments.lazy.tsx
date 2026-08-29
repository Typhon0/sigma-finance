import { createLazyFileRoute } from "@tanstack/react-router";
import { ManualInstrumentsSettings } from "@/components/settings/ManualInstrumentsSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createLazyFileRoute("/_app/settings/manual-instruments")({
	component: () => (
		<SettingsLayout activeSection="manual-instruments">
			<ManualInstrumentsSettings />
		</SettingsLayout>
	),
});
