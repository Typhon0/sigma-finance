import { useState } from "react";
import { LoginForm } from "./login-form";
import { PasswordResetForm } from "./password-reset-form";
import { RegisterForm } from "./register-form";

type AuthMode = "login" | "register" | "reset";

interface AuthPageProps {
	initialMode?: AuthMode;
	onSuccess?: () => void;
}

export function AuthPage({ initialMode = "login", onSuccess }: AuthPageProps) {
	const [mode, setMode] = useState<AuthMode>(initialMode);

	const _handleAuthSuccess = () => {
		onSuccess?.();
	};

	const renderForm = () => {
		switch (mode) {
			case "register":
				return <RegisterForm onSwitchToLogin={() => setMode("login")} />;
			case "reset":
				return <PasswordResetForm onSwitchToLogin={() => setMode("login")} />;
			default:
				return (
					<LoginForm
						onSwitchToRegister={() => setMode("register")}
						onSwitchToReset={() => setMode("reset")}
					/>
				);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<div className="w-full max-w-md">{renderForm()}</div>
		</div>
	);
}
