import { Key, Loader2, LogIn, Mail, Shield, UserPlus } from "lucide-react";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription } from "../ui/alert";

interface AuthLoadingDisplayProps {
	type:
		| "login"
		| "register"
		| "logout"
		| "password-reset"
		| "email-verification"
		| "token-refresh";
	message?: string;
	className?: string;
	size?: "sm" | "md" | "lg";
}

export function AuthLoadingDisplay({
	type,
	message,
	className,
	size = "md",
}: AuthLoadingDisplayProps) {
	const getLoadingIcon = () => {
		switch (type) {
			case "register":
				return <UserPlus className="h-4 w-4" />;
			case "login":
				return <LogIn className="h-4 w-4" />;
			case "logout":
				return <Shield className="h-4 w-4" />;
			case "password-reset":
				return <Key className="h-4 w-4" />;
			case "email-verification":
				return <Mail className="h-4 w-4" />;
			case "token-refresh":
				return <Shield className="h-4 w-4" />;
			default:
				return <Loader2 className="h-4 w-4" />;
		}
	};

	const getDefaultMessage = () => {
		switch (type) {
			case "register":
				return "Creating your account...";
			case "login":
				return "Signing you in...";
			case "logout":
				return "Logging you out...";
			case "password-reset":
				return "Sending reset link...";
			case "email-verification":
				return "Verifying your email...";
			case "token-refresh":
				return "Refreshing session...";
			default:
				return "Processing...";
		}
	};

	const sizeClasses = {
		sm: "p-2",
		md: "p-3",
		lg: "p-4",
	};

	const iconSizeClasses = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};

	return (
		<Alert
			className={cn(sizeClasses[size], className)}
			role="status"
			aria-live="polite"
			aria-label={message || getDefaultMessage()}
		>
			<div className="flex items-center space-x-2">
				<Loader2 className={cn(iconSizeClasses[size], "animate-spin")} />
				{getLoadingIcon()}
				<AlertDescription className="mb-0">
					{message || getDefaultMessage()}
				</AlertDescription>
			</div>
		</Alert>
	);
}

// Inline loading component for buttons and smaller spaces
interface InlineAuthLoadingProps {
	type:
		| "login"
		| "register"
		| "logout"
		| "password-reset"
		| "email-verification";
	message?: string;
	className?: string;
}

export function InlineAuthLoading({
	type,
	message,
	className,
}: InlineAuthLoadingProps) {
	const getDefaultMessage = () => {
		switch (type) {
			case "register":
				return "Creating account...";
			case "login":
				return "Signing in...";
			case "logout":
				return "Logging out...";
			case "password-reset":
				return "Sending link...";
			case "email-verification":
				return "Verifying...";
			default:
				return "Processing...";
		}
	};

	return (
		<div className={cn("flex items-center space-x-2", className)}>
			<Loader2 className="h-4 w-4 animate-spin" />
			<span className="text-sm">{message || getDefaultMessage()}</span>
		</div>
	);
}
