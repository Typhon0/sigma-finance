import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPage } from "../components/auth/auth-page";
import { useAuth } from "../lib/auth-context";

export const Route = createLazyFileRoute("/auth/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();

	useEffect(() => {
		if (isAuthenticated) {
			navigate({
				to: "/dashboard",
				search: { portfolioId: undefined, view: undefined },
			});
		}
	}, [isAuthenticated, navigate]);

	const handleSuccess = () => {
		navigate({
			to: "/dashboard",
			search: { portfolioId: undefined, view: undefined },
		});
	};

	return <AuthPage initialMode="login" onSuccess={handleSuccess} />;
}
