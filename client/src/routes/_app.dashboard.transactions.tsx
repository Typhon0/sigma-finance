import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { TransactionManagement } from "@/components/TransactionManagement";

export const Route = createFileRoute("/_app/dashboard/transactions")({
	component: () => (
		<ProtectedRoute>
			<TransactionManagement />
		</ProtectedRoute>
	),
});
