import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { LoansList } from "@/components/assets/loans/LoansList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/loans")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<LoansList onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
