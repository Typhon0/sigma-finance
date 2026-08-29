import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { EmailVerification } from "../components/auth/email-verification";
import { useAuth } from "../lib/auth-context";

export const Route = createLazyFileRoute("/auth/verify-email")({
	component: VerifyEmailPage,
});

function VerifyEmailPage() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const { token } = Route.useSearch();

	const handleSuccess = () => {
		navigate({
			to: "/dashboard",
			search: { portfolioId: undefined, view: undefined },
		});
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<EmailVerification token={token} email={user?.email} onSuccess={handleSuccess} />
		</div>
	);
}
