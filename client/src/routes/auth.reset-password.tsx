import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPage } from "../components/auth/auth-page";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/auth/reset-password")({
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();

	// Redirect to dashboard if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({
				to: "/dashboard",
				search: { portfolioId: undefined, view: undefined },
			});
		}
	}, [isAuthenticated, navigate]);

	const handleSuccess = () => {
		navigate({ to: "/auth/login" });
	};

	return <AuthPage initialMode="reset" onSuccess={handleSuccess} />;
}
