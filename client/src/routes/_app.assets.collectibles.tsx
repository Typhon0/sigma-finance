import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CollectiblesList } from "@/components/CollectiblesList";

export const Route = createFileRoute("/_app/assets/collectibles")({
	component: () => (
		<ProtectedRoute>
			<CollectiblesList onSelectCollectible={() => {}} />
		</ProtectedRoute>
	),
});
