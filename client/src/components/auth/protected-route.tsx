import { Navigate, useLocation } from "@tanstack/react-router";
import { Loader2, Shield } from "lucide-react";
import type React from "react";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface ProtectedRouteProps {
	children: React.ReactNode;
	requireEmailVerified?: boolean;
	fallbackPath?: string;
}

export function ProtectedRoute({
	children,
	requireEmailVerified = false,
	fallbackPath = "/auth/login",
}: ProtectedRouteProps) {
	const { user, isLoading, isAuthenticated, resendVerification } = useAuth();
	const location = useLocation();

	// Show loading spinner while checking authentication
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center space-y-4">
					<Loader2 className="h-8 w-8 animate-spin mx-auto" />
					<p className="text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	// Redirect to login if not authenticated
	if (!isAuthenticated) {
		return <Navigate to={fallbackPath} search={{ redirect: location.pathname } as any} />;
	}

	// Check email verification requirement
	if (requireEmailVerified && user && !user.emailVerified) {
		return (
			<div className="flex items-center justify-center min-h-screen p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center space-y-2">
						<div className="flex justify-center">
							<Shield className="h-12 w-12 text-amber-500" />
						</div>
						<CardTitle>Email Verification Required</CardTitle>
						<CardDescription>
							Please verify your email address to access this feature. Check your inbox for a
							verification link.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground text-center">
							Didn't receive the email? Check your spam folder or request a new one.
						</p>
						<Button
							onClick={() => resendVerification(user.email)}
							variant="outline"
							className="w-full"
						>
							Resend Verification Email
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Render protected content
	return <>{children}</>;
}

// Higher-order component for protecting routes
export function withAuth<P extends object>(
	Component: React.ComponentType<P>,
	options?: {
		requireEmailVerified?: boolean;
		fallbackPath?: string;
	},
) {
	return function AuthenticatedComponent(props: P) {
		return (
			<ProtectedRoute {...options}>
				<Component {...props} />
			</ProtectedRoute>
		);
	};
}
