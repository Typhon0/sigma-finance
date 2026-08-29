import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { SavingsList } from "@/components/assets/savings/SavingsList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/savings")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<SavingsList onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
