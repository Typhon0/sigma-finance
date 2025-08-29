import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../lib/auth-context";
import { useAuthErrorHandler } from "../../lib/auth-error-handler";
import type { AuthError } from "../../lib/types/auth.types";
import {
	type PasswordResetConfirmFormData,
	passwordResetConfirmSchema,
} from "../../lib/validations/auth.schemas";
import { Button } from "../ui/button";
import { AuthButton } from "./auth-button";
import { AuthFormField } from "./auth-form-field";
import { AuthFormWrapper } from "./auth-form-wrapper";

interface PasswordResetConfirmFormProps {
	token: string;
	onSuccess?: () => void;
}

export function PasswordResetConfirmForm({
	token,
	onSuccess,
}: PasswordResetConfirmFormProps) {
	const [authErrors, setAuthErrors] = useState<AuthError[]>([]);
	const [showSuccess, setShowSuccess] = useState(false);
	const { confirmPasswordReset } = useAuth();
	const { handleAuthResponse } = useAuthErrorHandler();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
		watch,
		reset,
	} = useForm<PasswordResetConfirmFormData>({
		resolver: zodResolver(passwordResetConfirmSchema),
		defaultValues: {
			token,
		},
	});

	const watchedValues = watch();

	const onSubmit = async (data: PasswordResetConfirmFormData) => {
		setAuthErrors([]);
		try {
			await confirmPasswordReset(data.token, data.newPassword);
			setShowSuccess(true);
			reset(); // Clear form on successful password reset
		} catch (error: any) {
			// Extract errors from the error object if available
			if (error?.graphQLErrors?.[0]?.extensions?.errors) {
				setAuthErrors(error.graphQLErrors[0].extensions.errors);
			} else {
				setAuthErrors([
					{
						code: "INTERNAL_ERROR",
						message: "Failed to update password. Please try again.",
					},
				]);
			}
		}
	};

	const handleRetry = () => {
		setAuthErrors([]);
		setShowSuccess(false);
	};

	return (
		<AuthFormWrapper
			title="Set New Password"
			description="Enter your new password below"
			errors={authErrors}
			isLoading={isSubmitting}
			loadingType="password-reset"
			showSuccess={showSuccess}
			successType="password-change"
			onRetry={handleRetry}
			onContinue={onSuccess}
		>
			<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
				<input type="hidden" {...register("token")} />

				<AuthFormField
					id="newPassword"
					name="newPassword"
					type="password"
					label="New Password"
					placeholder="Enter your new password"
					value={watchedValues.newPassword || ""}
					error={errors.newPassword?.message}
					disabled={isSubmitting}
					required
					autoComplete="new-password"
					showPasswordToggle
					description="Password must be at least 8 characters with uppercase, lowercase, and number"
					{...register("newPassword")}
				/>

				<AuthFormField
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					label="Confirm New Password"
					placeholder="Confirm your new password"
					value={watchedValues.confirmPassword || ""}
					error={errors.confirmPassword?.message}
					disabled={isSubmitting}
					required
					autoComplete="new-password"
					showPasswordToggle
					{...register("confirmPassword")}
				/>

				<AuthButton
					type="submit"
					authType="password-reset"
					isLoading={isSubmitting}
					disabled={isSubmitting}
					fullWidth
				>
					Update Password
				</AuthButton>
			</form>
		</AuthFormWrapper>
	);
}
