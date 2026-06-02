import { createFileRoute } from "@tanstack/react-router";
import { LoansList } from "@/components/assets/loans/LoansList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/loans")({
	component: () => (
		<ProtectedRoute>
			<LoansList onSelectLoan={() => {}} />
		</ProtectedRoute>
	),
});
