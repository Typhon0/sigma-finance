import { createFileRoute } from "@tanstack/react-router";
import { InsuranceList } from "@/components/assets/insurance/InsuranceList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/insurance")({
	component: () => (
		<ProtectedRoute>
			<InsuranceList onSelectInsurance={() => {}} />
		</ProtectedRoute>
	),
});
