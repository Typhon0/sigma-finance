import { createFileRoute } from "@tanstack/react-router";
import { AccountsList } from "@/components/AccountsList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/accounts")({
	component: () => (
		<ProtectedRoute>
			<AccountsList onSelectAccount={() => {}} />
		</ProtectedRoute>
	),
});
