import { AlertTriangle, Clock, Mail, Shield, XCircle } from "lucide-react";
import type { AuthError } from "../../lib/types/auth.types";
import { AUTH_ERROR_CODES } from "../../lib/types/auth.types";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

interface AuthErrorDisplayProps {
	errors: AuthError[];
	onRetry?: () => void;
	onResendVerification?: () => void;
	className?: string;
}

export function AuthErrorDisplay({
	errors,
	onRetry,
	onResendVerification,
	className,
}: AuthErrorDisplayProps) {
	if (!errors || errors.length === 0) return null;

	// Group errors by type for better display
	const primaryError = errors[0];
	const hasMultipleErrors = errors.length > 1;

	const getErrorIcon = (errorCode: string) => {
		switch (errorCode) {
			case AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED:
				return <Mail className="h-4 w-4" />;
			case AUTH_ERROR_CODES.ACCOUNT_LOCKED:
				return <Shield className="h-4 w-4" />;
			case AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED:
				return <Clock className="h-4 w-4" />;
			case AUTH_ERROR_CODES.TOKEN_EXPIRED:
			case AUTH_ERROR_CODES.INVALID_TOKEN:
				return <XCircle className="h-4 w-4" />;
			default:
				return <AlertTriangle className="h-4 w-4" />;
		}
	};

	const getErrorVariant = (errorCode: string) => {
		switch (errorCode) {
			case AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED:
				return "default" as const;
			case AUTH_ERROR_CODES.ACCOUNT_LOCKED:
			case AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED:
				return "destructive" as const;
			default:
				return "destructive" as const;
		}
	};

	const getErrorTitle = (errorCode: string) => {
		switch (errorCode) {
			case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
				return "Invalid Credentials";
			case AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS:
				return "Email Already Registered";
			case AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED:
				return "Email Verification Required";
			case AUTH_ERROR_CODES.ACCOUNT_LOCKED:
				return "Account Temporarily Locked";
			case AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED:
				return "Too Many Attempts";
			case AUTH_ERROR_CODES.TOKEN_EXPIRED:
				return "Link Expired";
			case AUTH_ERROR_CODES.INVALID_TOKEN:
				return "Invalid Link";
			case AUTH_ERROR_CODES.WEAK_PASSWORD:
				return "Password Too Weak";
			default:
				return "Authentication Error";
		}
	};

	return (
		<Alert
			variant={getErrorVariant(primaryError.code)}
			className={className}
			role="alert"
			aria-live="polite"
		>
			{getErrorIcon(primaryError.code)}
			<AlertTitle>{getErrorTitle(primaryError.code)}</AlertTitle>
			<AlertDescription className="space-y-2">
				<p>{primaryError.message}</p>

				{hasMultipleErrors && (
					<p className="text-sm opacity-80">
						{errors.length - 1} additional error{errors.length > 2 ? "s" : ""}{" "}
						occurred.
					</p>
				)}

				{/* Action buttons for specific error types */}
				<div className="flex gap-2 mt-3">
					{primaryError.code === AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED &&
						onResendVerification && (
							<Button
								variant="outline"
								size="sm"
								onClick={onResendVerification}
								className="h-8"
							>
								Resend Verification
							</Button>
						)}

					{onRetry && (
						<Button
							variant="outline"
							size="sm"
							onClick={onRetry}
							className="h-8"
						>
							Try Again
						</Button>
					)}
				</div>
			</AlertDescription>
		</Alert>
	);
}
