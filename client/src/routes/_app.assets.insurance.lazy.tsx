import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { InsuranceList } from "@/components/assets/insurance/InsuranceList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/insurance")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<InsuranceList onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
