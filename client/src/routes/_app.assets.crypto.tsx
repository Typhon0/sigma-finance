import { createFileRoute } from "@tanstack/react-router";
import { CryptoList } from "@/components/assets/crypto/CryptoList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createFileRoute("/_app/assets/crypto")({
	component: () => (
		<ProtectedRoute>
			<CryptoList onSelectCrypto={() => {}} detailMode="panel" />
		</ProtectedRoute>
	),
});
