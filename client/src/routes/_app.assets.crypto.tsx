import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CryptoList } from "@/components/CryptoList";

export const Route = createFileRoute("/_app/assets/crypto")({
	component: () => (
		<ProtectedRoute>
			<CryptoList onSelectCrypto={() => {}} detailMode="panel" />
		</ProtectedRoute>
	),
});
