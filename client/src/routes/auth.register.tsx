import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthPage } from "../components/auth/auth-page";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/auth/register")({
	component: RegisterPage,
});

function RegisterPage() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();

	// Redirect to dashboard if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [isAuthenticated, navigate]);

	const handleSuccess = () => {
		navigate({ to: "/dashboard" });
	};

	return <AuthPage initialMode="register" onSuccess={handleSuccess} />;
}
