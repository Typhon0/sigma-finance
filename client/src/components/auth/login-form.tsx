import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../lib/auth-context";
import { useAuthErrorHandler } from "../../lib/auth-error-handler";
import type { AuthError } from "../../lib/types/auth.types";
import {
	type LoginFormData,
	loginSchema,
} from "../../lib/validations/auth.schemas";
import { Button } from "../ui/button";
import { AuthButton } from "./auth-button";
import { AuthFormField } from "./auth-form-field";
import { AuthFormWrapper } from "./auth-form-wrapper";

interface LoginFormProps {
	onSwitchToRegister?: () => void;
	onSwitchToReset?: () => void;
}

export function LoginForm({
	onSwitchToRegister,
	onSwitchToReset,
}: LoginFormProps) {
	const [authErrors, setAuthErrors] = useState<AuthError[]>([]);
	const { login, isLoading } = useAuth();
	const { _handleAuthResponse } = useAuthErrorHandler();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		watch,
		reset,
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
	});

	const watchedValues = watch();

	const onSubmit = async (data: LoginFormData) => {
		setAuthErrors([]);
		const normalizedEmail = data.email.trim().toLowerCase();
		try {
			await login(normalizedEmail, data.password);
			reset(); // Clear form on successful login
		} catch (error: any) {
			const authErrors = error?.authErrors ??
				(error?.graphQLErrors?.[0]?.extensions?.errors as AuthError[] | undefined);

			if (Array.isArray(authErrors) && authErrors.length > 0) {
				setAuthErrors(authErrors);
			} else {
				setAuthErrors([
					{
						code: "INTERNAL_ERROR",
						message:
							error instanceof Error
								? error.message
								: "Login failed. Please try again.",
					},
				]);
			}
		}
	};

	const handleRetry = () => {
		setAuthErrors([]);
	};

	const isFormLoading = isLoading || isSubmitting;

	return (
		<AuthFormWrapper
			title="Sign In"
			description="Enter your credentials to access your portfolio"
			errors={authErrors}
			isLoading={isFormLoading}
			loadingType="login"
			onRetry={handleRetry}
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				<AuthFormField
					id="email"
					name="email"
					type="email"
					label="Email"
					placeholder="Enter your email"
					value={watchedValues.email || ""}
					error={errors.email?.message}
					disabled={isFormLoading}
					required
					autoComplete="email"
					{...register("email")}
				/>

				<AuthFormField
					id="password"
					name="password"
					type="password"
					label="Password"
					placeholder="Enter your password"
					value={watchedValues.password || ""}
					error={errors.password?.message}
					disabled={isFormLoading}
					required
					autoComplete="current-password"
					showPasswordToggle
					{...register("password")}
				/>

				<AuthButton
					type="submit"
					authType="login"
					isLoading={isFormLoading}
					disabled={isFormLoading}
					fullWidth
				/>

				<div className="text-center space-y-2">
					{onSwitchToReset && (
						<Button
							type="button"
							variant="link"
							className="text-sm"
							onClick={onSwitchToReset}
							disabled={isFormLoading}
						>
							Forgot your password?
						</Button>
					)}

					{onSwitchToRegister && (
						<div className="text-sm text-muted-foreground">
							Don't have an account?{" "}
							<Button
								type="button"
								variant="link"
								className="p-0 h-auto font-normal"
								onClick={onSwitchToRegister}
								disabled={isFormLoading}
							>
								Sign up
							</Button>
						</div>
					)}
				</div>
			</form>
		</AuthFormWrapper>
	);
}
