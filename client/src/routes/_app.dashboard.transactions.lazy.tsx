import { createLazyFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { TransactionManagement } from "@/components/TransactionManagement";

export const Route = createLazyFileRoute("/_app/dashboard/transactions")({
	component: () => (
		<ProtectedRoute>
			<TransactionManagement />
		</ProtectedRoute>
	),
});
