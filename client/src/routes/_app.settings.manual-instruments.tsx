import { createFileRoute } from "@tanstack/react-router";
import { ManualInstrumentsSettings } from "@/components/settings/ManualInstrumentsSettings";
import { SettingsLayout } from "@/components/settings/SettingsLayout";

export const Route = createFileRoute("/_app/settings/manual-instruments")({
	component: ManualInstrumentsPage,
});

function ManualInstrumentsPage() {
	return (
		<SettingsLayout activeSection="manual-instruments">
			<ManualInstrumentsSettings />
		</SettingsLayout>
	);
}
