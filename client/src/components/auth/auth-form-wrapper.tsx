import type { ReactNode } from "react";
import type { AuthError } from "../../lib/types/auth.types";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { AuthErrorDisplay } from "./auth-error-display";
import { AuthLoadingDisplay } from "./auth-loading-display";
import { AuthSuccessDisplay } from "./auth-success-display";

interface AuthFormWrapperProps {
	title: string;
	description?: string;
	children: ReactNode;
	errors?: AuthError[];
	isLoading?: boolean;
	loadingType?: "login" | "register" | "logout" | "password-reset" | "email-verification";
	loadingMessage?: string;
	successType?:
		| "registration"
		| "login"
		| "logout"
		| "password-reset"
		| "email-verification"
		| "password-change";
	successMessage?: string;
	showSuccess?: boolean;
	email?: string;
	onRetry?: () => void;
	onResendVerification?: () => void;
	onResendEmail?: () => void;
	onContinue?: () => void;
	className?: string;
	maxWidth?: "sm" | "md" | "lg";
}

export function AuthFormWrapper({
	title,
	description,
	children,
	errors,
	isLoading = false,
	loadingType = "login",
	loadingMessage,
	successType,
	successMessage,
	showSuccess = false,
	email,
	onRetry,
	onResendVerification,
	onResendEmail,
	onContinue,
	className,
	maxWidth = "md",
}: AuthFormWrapperProps) {
	const maxWidthClasses = {
		sm: "max-w-sm",
		md: "max-w-md",
		lg: "max-w-lg",
	};

	return (
		<Card className={cn("w-full mx-auto", maxWidthClasses[maxWidth], className)}>
			<CardHeader className="space-y-1">
				<CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
				{description && <CardDescription className="text-center">{description}</CardDescription>}
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Loading state */}
				{isLoading && <AuthLoadingDisplay type={loadingType} message={loadingMessage} />}

				{/* Success state */}
				{showSuccess && successType && (
					<AuthSuccessDisplay
						type={successType}
						message={successMessage}
						email={email}
						onContinue={onContinue}
						onResendEmail={onResendEmail}
					/>
				)}

				{/* Error state */}
				{errors && errors.length > 0 && (
					<AuthErrorDisplay
						errors={errors}
						onRetry={onRetry}
						onResendVerification={onResendVerification}
					/>
				)}

				{/* Form content */}
				{!isLoading && !showSuccess && children}
			</CardContent>
		</Card>
	);
}
