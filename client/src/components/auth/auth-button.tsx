import { ArrowLeft, Key, Loader2, LogIn, Mail, Shield, UserPlus } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "../ui/button";

interface AuthButtonProps extends Omit<ButtonProps, "children"> {
	type?: "submit" | "button";
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	size?: "default" | "sm" | "lg" | "icon";
	isLoading?: boolean;
	loadingText?: string;
	authType?:
		| "login"
		| "register"
		| "logout"
		| "password-reset"
		| "email-verification"
		| "back"
		| "resend";
	children?: React.ReactNode;
	fullWidth?: boolean;
}

export const AuthButton = forwardRef<HTMLButtonElement, AuthButtonProps>(
	(
		{
			type = "button",
			variant = "default",
			size = "default",
			isLoading = false,
			loadingText,
			authType,
			children,
			fullWidth = false,
			className,
			disabled,
			...props
		},
		ref,
	) => {
		const getIcon = () => {
			if (isLoading) {
				return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
			}

			switch (authType) {
				case "login":
					return <LogIn className="mr-2 h-4 w-4" />;
				case "register":
					return <UserPlus className="mr-2 h-4 w-4" />;
				case "logout":
					return <Shield className="mr-2 h-4 w-4" />;
				case "password-reset":
					return <Key className="mr-2 h-4 w-4" />;
				case "email-verification":
				case "resend":
					return <Mail className="mr-2 h-4 w-4" />;
				case "back":
					return <ArrowLeft className="mr-2 h-4 w-4" />;
				default:
					return null;
			}
		};

		const getDefaultText = () => {
			if (isLoading && loadingText) {
				return loadingText;
			}

			if (isLoading) {
				switch (authType) {
					case "login":
						return "Signing in...";
					case "register":
						return "Creating account...";
					case "logout":
						return "Logging out...";
					case "password-reset":
						return "Sending reset link...";
					case "email-verification":
						return "Verifying...";
					case "resend":
						return "Sending...";
					default:
						return "Processing...";
				}
			}

			switch (authType) {
				case "login":
					return "Sign In";
				case "register":
					return "Create Account";
				case "logout":
					return "Log Out";
				case "password-reset":
					return "Send Reset Link";
				case "email-verification":
					return "Verify Email";
				case "resend":
					return "Resend";
				case "back":
					return "Back";
				default:
					return "Submit";
			}
		};

		const buttonText = children || getDefaultText();
		const isDisabled = disabled || isLoading;

		return (
			<Button
				ref={ref}
				type={type}
				variant={variant}
				size={size}
				disabled={isDisabled}
				className={cn(fullWidth && "w-full", className)}
				aria-disabled={isDisabled}
				aria-describedby={isLoading ? "loading-status" : undefined}
				{...props}
			>
				{getIcon()}
				{buttonText}
				{isLoading && (
					<span id="loading-status" className="sr-only">
						Loading, please wait
					</span>
				)}
			</Button>
		);
	},
);

AuthButton.displayName = "AuthButton";
