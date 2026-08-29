import { createLazyFileRoute } from "@tanstack/react-router";
import { AccountsList } from "@/components/AccountsList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/accounts")({
	component: () => (
		<ProtectedRoute>
			<AccountsList onSelectAccount={() => {}} />
		</ProtectedRoute>
	),
});
