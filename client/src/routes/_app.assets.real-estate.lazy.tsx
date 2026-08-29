import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { RealEstateList } from "@/components/assets/real-estate/RealEstateList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/real-estate")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<RealEstateList onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
