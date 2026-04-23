import { AlertCircle, CheckCircle, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth, useEmailVerification } from "@/hooks/use-auth";

interface AuthStatusProps {
	showDetails?: boolean;
	className?: string;
}

export function AuthStatus({ showDetails = false, className }: AuthStatusProps) {
	const { user, isAuthenticated, isLoading } = useAuth();
	const { isEmailVerified, needsVerification, resendVerification } = useEmailVerification();

	if (isLoading) {
		return (
			<div className={`flex items-center space-x-2 ${className}`}>
				<Clock className="h-4 w-4 animate-pulse text-gray-400" />
				<span className="text-sm text-gray-500">Loading...</span>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className={`flex items-center space-x-2 ${className}`}>
				<User className="h-4 w-4 text-gray-400" />
				<span className="text-sm text-gray-500">Not authenticated</span>
			</div>
		);
	}

	return (
		<div className={`flex items-center space-x-2 ${className}`}>
			<div className="flex items-center space-x-2">
				{isEmailVerified ? (
					<CheckCircle className="h-4 w-4 text-green-500" />
				) : (
					<AlertCircle className="h-4 w-4 text-amber-500" />
				)}

				<div className="flex flex-col">
					<span className="text-sm font-medium">{user?.name || user?.email}</span>

					{showDetails && (
						<div className="flex items-center space-x-2">
							<Badge variant={isEmailVerified ? "default" : "secondary"} className="text-xs">
								{isEmailVerified ? "Verified" : "Unverified"}
							</Badge>

							{needsVerification && (
								<Button
									variant="link"
									size="sm"
									onClick={resendVerification}
									className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
								>
									Resend verification
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
