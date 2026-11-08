import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { SavingsList } from "@/components/assets/savings/SavingsList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/savings")({
	component: () => {
		return (
			<ProtectedRoute>
				<SavingsList detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
