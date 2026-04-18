import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { SavingsList } from "@/components/SavingsList";

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
