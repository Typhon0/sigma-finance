import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RealEstateList } from "@/components/RealEstateList";

export const Route = createFileRoute("/_app/assets/real-estate")({
	component: () => (
		<ProtectedRoute>
			<RealEstateList onSelectProperty={() => {}} />
		</ProtectedRoute>
	),
});
