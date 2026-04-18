import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { InsuranceList } from "@/components/InsuranceList";

export const Route = createFileRoute("/_app/assets/insurance")({
	component: () => (
		<ProtectedRoute>
			<InsuranceList onSelectInsurance={() => {}} />
		</ProtectedRoute>
	),
});
