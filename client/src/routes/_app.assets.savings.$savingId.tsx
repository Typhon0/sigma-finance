import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { SavingDetail } from "@/components/assets/savings/SavingDetail";
import { ProtectedRoute } from "@/components/auth/protected-route";

function SavingDetailPage() {
	const { savingId } = useParams({ from: "/_app/assets/savings/$savingId" });
	const navigate = useNavigate();

	return (
		<ProtectedRoute>
			<SavingDetail savingId={savingId} onBack={() => navigate({ to: "/assets/savings" })} />
		</ProtectedRoute>
	);
}

export const Route = createFileRoute("/_app/assets/savings/$savingId")({
	component: SavingDetailPage,
});
