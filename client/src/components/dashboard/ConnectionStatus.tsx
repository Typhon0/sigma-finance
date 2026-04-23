import { AlertCircle, CheckCircle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRealTimeDashboard } from "@/contexts/RealTimeDashboardContext";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
	className?: string;
	showReconnectButton?: boolean;
	variant?: "badge" | "full" | "minimal";
}

export function ConnectionStatus({
	className = "",
	showReconnectButton = true,
	variant = "badge",
}: ConnectionStatusProps) {
	const { state } = useRealTimeDashboard();
	const [lastConnectedTime, setLastConnectedTime] = useState<number | null>(null);
	const [reconnectAttempts, setReconnectAttempts] = useState(0);

	useEffect(() => {
		if (state.isConnected) {
			setLastConnectedTime(Date.now());
			setReconnectAttempts(0);
		}
	}, [state.isConnected]);

	const getStatusText = () => {
		if (state.isConnecting) return "Connecting...";
		if (state.isConnected) return "Connected";
		if (state.connectionError) return "Connection Error";
		return "Disconnected";
	};

	const getStatusColor = () => {
		if (state.isConnecting) return "bg-yellow-500";
		if (state.isConnected) return "bg-green-500";
		return "bg-red-500";
	};

	const getStatusIcon = () => {
		if (state.isConnecting) {
			return <Loader2 className="h-4 w-4 animate-spin" />;
		}
		if (state.isConnected) {
			return <Wifi className="h-4 w-4" />;
		}
		return <WifiOff className="h-4 w-4" />;
	};

	const getLastConnectedText = () => {
		if (!lastConnectedTime) return "Never connected";

		const now = Date.now();
		const diff = now - lastConnectedTime;

		if (diff < 60000) return "Connected just now";
		if (diff < 3600000) return `Last connected ${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `Last connected ${Math.floor(diff / 3600000)}h ago`;
		return `Last connected ${Math.floor(diff / 86400000)}d ago`;
	};

	const handleReconnect = () => {
		setReconnectAttempts((prev) => prev + 1);
		// The WebSocket manager will handle the actual reconnection
		// This is just for UI feedback
	};

	if (variant === "minimal") {
		return (
			<div className={cn("flex items-center gap-1", className)}>
				<div className={cn("w-2 h-2 rounded-full", getStatusColor())} />
				{!state.isConnected && <span className="text-xs text-gray-500">Offline</span>}
			</div>
		);
	}

	if (variant === "badge") {
		return (
			<Badge
				variant={state.isConnected ? "default" : "destructive"}
				className={cn("flex items-center gap-1", className)}
			>
				{getStatusIcon()}
				{getStatusText()}
			</Badge>
		);
	}

	return (
		<div className={cn("flex items-center gap-3 p-3 rounded-lg border", className)}>
			<div className="flex items-center gap-2">
				{getStatusIcon()}
				<div>
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">{getStatusText()}</span>
						{state.isConnected && <CheckCircle className="h-4 w-4 text-green-500" />}
						{state.connectionError && <AlertCircle className="h-4 w-4 text-red-500" />}
					</div>

					{!state.isConnected && (
						<p className="text-xs text-gray-500 mt-1">{getLastConnectedText()}</p>
					)}

					{state.connectionError && (
						<p className="text-xs text-red-600 mt-1">{state.connectionError}</p>
					)}
				</div>
			</div>

			{showReconnectButton && !state.isConnected && !state.isConnecting && (
				<Button
					size="sm"
					variant="outline"
					onClick={handleReconnect}
					className="ml-auto"
					disabled={reconnectAttempts >= 3}
				>
					<RefreshCw className="h-3 w-3 mr-1" />
					{reconnectAttempts >= 3 ? "Max Attempts" : "Reconnect"}
				</Button>
			)}
		</div>
	);
}

/**
 * Global connection status indicator for the app header
 */
export function GlobalConnectionStatus() {
	const { state } = useRealTimeDashboard();
	const [showDetails, setShowDetails] = useState(false);

	// Auto-show details when connection issues occur
	useEffect(() => {
		if (!state.isConnected && !state.isConnecting) {
			setShowDetails(true);

			// Auto-hide after 10 seconds
			const timer = setTimeout(() => {
				setShowDetails(false);
			}, 10000);

			return () => clearTimeout(timer);
		}
	}, [state.isConnected, state.isConnecting]);

	return (
		<div className="relative">
			<Button
				variant="ghost"
				onClick={() => setShowDetails(!showDetails)}
				className="flex items-center gap-2 px-2 py-1 h-auto"
			>
				<ConnectionStatus variant="minimal" />
				{!state.isConnected && (
					<span className="text-xs text-red-600 font-medium">Connection Lost</span>
				)}
			</Button>

			{showDetails && (
				<div className="absolute top-full right-0 mt-2 w-80 z-50">
					<div className="bg-white border rounded-lg shadow-lg p-4">
						<ConnectionStatus variant="full" showReconnectButton={true} />

						<div className="mt-3 pt-3 border-t text-xs text-gray-600">
							<p>Real-time updates require an active connection.</p>
							<p className="mt-1">
								While offline, you'll see cached data with limited functionality.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
