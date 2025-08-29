import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SessionManager } from "@/lib/auth-utils";

interface SessionWarningProps {
	className?: string;
}

export function SessionWarning({ className }: SessionWarningProps) {
	const { refreshToken, isAuthenticated } = useAuth();
	const [timeRemaining, setTimeRemaining] = useState(0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [showWarning, setShowWarning] = useState(false);

	useEffect(() => {
		if (!isAuthenticated) {
			setShowWarning(false);
			return;
		}

		const updateTimer = () => {
			const remaining = SessionManager.getSessionTimeRemaining();
			setTimeRemaining(remaining);

			const shouldShow = SessionManager.shouldShowSessionWarning();
			setShowWarning(shouldShow && remaining > 0);
		};

		// Update immediately
		updateTimer();

		// Update every second
		const interval = setInterval(updateTimer, 1000);

		return () => clearInterval(interval);
	}, [isAuthenticated]);

	const handleRefreshSession = async () => {
		setIsRefreshing(true);
		try {
			await refreshToken();
			setShowWarning(false);
		} catch (error) {
			console.error("Failed to refresh session:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	if (!showWarning) {
		return null;
	}

	const formattedTime = SessionManager.formatTimeRemaining(timeRemaining);

	return (
		<Alert className={`border-amber-200 bg-amber-50 ${className}`}>
			<AlertTriangle className="h-4 w-4 text-amber-600" />
			<AlertDescription className="flex items-center justify-between">
				<span className="text-amber-800">
					Your session will expire in {formattedTime}.
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={handleRefreshSession}
					disabled={isRefreshing}
					className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100"
				>
					{isRefreshing ? (
						<>
							<RefreshCw className="mr-2 h-3 w-3 animate-spin" />
							Refreshing...
						</>
					) : (
						"Extend Session"
					)}
				</Button>
			</AlertDescription>
		</Alert>
	);
}
