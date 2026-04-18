import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { LoansList } from "@/components/LoansList";

export const Route = createFileRoute("/_app/assets/loans")({
	component: () => (
		<ProtectedRoute>
			<LoansList onSelectLoan={() => {}} />
		</ProtectedRoute>
	),
});
