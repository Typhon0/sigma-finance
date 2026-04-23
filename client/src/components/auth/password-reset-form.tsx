import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../lib/auth-context";
import { useAuthErrorHandler } from "../../lib/auth-error-handler";
import type { AuthError } from "../../lib/types/auth.types";
import {
	type PasswordResetFormData,
	passwordResetSchema,
} from "../../lib/validations/auth.schemas";
import { AuthButton } from "./auth-button";
import { AuthFormField } from "./auth-form-field";
import { AuthFormWrapper } from "./auth-form-wrapper";

interface PasswordResetFormProps {
	onSwitchToLogin?: () => void;
}

export function PasswordResetForm({ onSwitchToLogin }: PasswordResetFormProps) {
	const [authErrors, setAuthErrors] = useState<AuthError[]>([]);
	const [showSuccess, setShowSuccess] = useState(false);
	const [submittedEmail, setSubmittedEmail] = useState("");
	const { resetPassword } = useAuth();
	const { handleAuthResponse: _handleAuthResponse } = useAuthErrorHandler();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		watch,
		reset,
	} = useForm<PasswordResetFormData>({
		resolver: zodResolver(passwordResetSchema),
	});

	const watchedValues = watch();

	const onSubmit = async (data: PasswordResetFormData) => {
		setAuthErrors([]);
		try {
			await resetPassword(data.email);
			setSubmittedEmail(data.email);
			setShowSuccess(true);
			reset(); // Clear the form after successful submission
		} catch (error: unknown) {
			// Extract errors from the error object if available
			const gqlErr = error as {
				graphQLErrors?: Array<{ extensions?: { errors?: AuthError[] } }>;
			} | null;
			if (gqlErr?.graphQLErrors?.[0]?.extensions?.errors) {
				setAuthErrors(gqlErr.graphQLErrors[0].extensions.errors);
			} else {
				setAuthErrors([
					{
						code: "INTERNAL_ERROR",
						message: "Failed to send reset email. Please try again.",
					},
				]);
			}
		}
	};

	const handleRetry = () => {
		setAuthErrors([]);
		setShowSuccess(false);
	};

	const handleResendEmail = async () => {
		if (submittedEmail) {
			try {
				await resetPassword(submittedEmail);
			} catch (_error) {}
		}
	};

	return (
		<AuthFormWrapper
			title="Reset Password"
			description="Enter your email address and we'll send you a link to reset your password"
			errors={authErrors}
			isLoading={isSubmitting}
			loadingType="password-reset"
			showSuccess={showSuccess}
			successType="password-reset"
			email={submittedEmail}
			onRetry={handleRetry}
			onResendEmail={handleResendEmail}
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				<AuthFormField
					id="email"
					type="email"
					label="Email"
					placeholder="Enter your email"
					value={watchedValues.email || ""}
					error={errors.email?.message}
					disabled={isSubmitting}
					required
					autoComplete="email"
					{...register("email")}
				/>

				<AuthButton
					type="submit"
					authType="password-reset"
					isLoading={isSubmitting}
					disabled={isSubmitting}
					fullWidth
				/>

				{onSwitchToLogin && (
					<div className="text-center">
						<AuthButton
							type="button"
							variant="link"
							authType="back"
							className="text-sm"
							onClick={onSwitchToLogin}
							disabled={isSubmitting}
						>
							Back to Sign In
						</AuthButton>
					</div>
				)}
			</form>
		</AuthFormWrapper>
	);
}
