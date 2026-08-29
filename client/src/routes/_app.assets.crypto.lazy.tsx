import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { CryptoList } from "@/components/assets/crypto/CryptoList";
import { ProtectedRoute } from "@/components/auth/protected-route";

export const Route = createLazyFileRoute("/_app/assets/crypto")({
	component: () => {
		const navigate = useNavigate();
		return (
			<ProtectedRoute>
				<CryptoList
					onSelectCrypto={() => {}}
					onBack={() => navigate({ to: "/portfolios" })}
					detailMode="panel"
				/>
			</ProtectedRoute>
		);
	},
});
