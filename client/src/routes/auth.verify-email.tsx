import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EmailVerification } from "../components/auth/email-verification";
import { useAuth } from "../lib/auth-context";

export interface VerifyEmailSearch {
	token?: string;
}

export const Route = createFileRoute("/auth/verify-email")({
	validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => {
		return {
			token: typeof search.token === "string" ? search.token : undefined,
		};
	},
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
