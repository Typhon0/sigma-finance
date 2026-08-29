import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectiblesList } from "@/components/assets/collectibles/CollectiblesList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/collectibles")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<CollectiblesList onBack={() => navigate({ to: "/portfolios" })} detailMode="panel" />
			</ProtectedRoute>
		);
	},
});
