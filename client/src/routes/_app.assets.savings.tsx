import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SavingsList } from "@/components/assets/savings/SavingsList";
import { ProtectedRoute } from "@/components/auth/protected-route";

function SavingsPage() {
	const navigate = useNavigate();

	return (
		<ProtectedRoute>
			<SavingsList
				onSelectSaving={(savingId) =>
					navigate({
						to: "/assets/savings/$savingId",
						params: { savingId },
					})
				}
			/>
		</ProtectedRoute>
	);
}

export const Route = createFileRoute("/_app/assets/savings")({
	component: SavingsPage,
});
