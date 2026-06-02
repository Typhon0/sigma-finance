import { createFileRoute } from "@tanstack/react-router";
import { CollectiblesList } from "@/components/assets/collectibles/CollectiblesList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/collectibles")({
	component: () => (
		<ProtectedRoute>
			<CollectiblesList onSelectCollectible={() => {}} />
		</ProtectedRoute>
	),
});
