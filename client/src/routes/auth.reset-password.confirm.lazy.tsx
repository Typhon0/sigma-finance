import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { PasswordResetConfirmForm } from "../components/auth/password-reset-confirm-form";

export const Route = createLazyFileRoute("/auth/reset-password/confirm")({
	component: ResetPasswordConfirmPage,
});

function ResetPasswordConfirmPage() {
	const navigate = useNavigate();
	const { token } = Route.useSearch();

	const handleSuccess = () => {
		navigate({ to: "/auth/login" });
	};

	if (!token) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold mb-4">Invalid Reset Link</h1>
					<p className="text-muted-foreground mb-4">
						The password reset link is invalid or missing.
					</p>
					<button
						type="button"
						onClick={() => navigate({ to: "/auth/reset-password" })}
						className="text-primary hover:underline"
					>
						Request a new reset link
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<PasswordResetConfirmForm token={token} onSuccess={handleSuccess} />
		</div>
	);
}
