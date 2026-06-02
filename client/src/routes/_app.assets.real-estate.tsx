import { createFileRoute } from "@tanstack/react-router";
import { RealEstateList } from "@/components/assets/real-estate/RealEstateList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/real-estate")({
	component: () => (
		<ProtectedRoute>
			<RealEstateList onSelectProperty={() => {}} />
		</ProtectedRoute>
	),
});
