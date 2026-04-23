import { Clock, RefreshCw, WifiOff } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOfflineStatus, useStaleDataDetection } from "@/hooks/use-offline-status";

interface StaleDataIndicatorProps {
	lastUpdated?: Date | string | null;
	onRefresh?: () => void;
	isRefreshing?: boolean;
	staleThreshold?: number;
	className?: string;
}

/**
 * Component to indicate when data is stale or user is offline
 * Shows appropriate messaging and refresh options
 */
export function StaleDataIndicator({
	lastUpdated,
	onRefresh,
	isRefreshing = false,
	staleThreshold,
	className = "",
}: StaleDataIndicatorProps) {
	const { isOffline, wasOffline } = useOfflineStatus();
	const { isStale } = useStaleDataDetection(lastUpdated, staleThreshold);

	// Don't show anything if data is fresh and online
	if (!isStale && !isOffline && !wasOffline) {
		return null;
	}

	const getIndicatorContent = () => {
		if (isOffline) {
			return {
				icon: <WifiOff className="h-3 w-3" />,
				text: "Offline - Showing cached data",
				variant: "destructive" as const,
			};
		}

		if (wasOffline) {
			return {
				icon: <RefreshCw className="h-3 w-3" />,
				text: "Back online - Data may be outdated",
				variant: "secondary" as const,
			};
		}

		if (isStale) {
			return {
				icon: <Clock className="h-3 w-3" />,
				text: "Data may be outdated",
				variant: "secondary" as const,
			};
		}

		return null;
	};

	const content = getIndicatorContent();
	if (!content) return null;

	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<Badge variant={content.variant} className="gap-1 text-xs">
				{content.icon}
				{content.text}
			</Badge>
			{onRefresh && !isOffline && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="h-6 px-2 text-xs"
				>
					<RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
					{isRefreshing ? "Refreshing..." : "Refresh"}
				</Button>
			)}
		</div>
	);
}

/**
 * Compact version for use in section headers
 */
export function CompactStaleIndicator({
	lastUpdated,
	onRefresh,
	isRefreshing = false,
}: Pick<StaleDataIndicatorProps, "lastUpdated" | "onRefresh" | "isRefreshing">) {
	const { isOffline } = useOfflineStatus();
	const { isStale } = useStaleDataDetection(lastUpdated);

	if (!isStale && !isOffline) {
		return null;
	}

	return (
		<div className="flex items-center gap-1">
			{isOffline ? (
				<WifiOff className="h-3 w-3 text-destructive" />
			) : (
				<Clock className="h-3 w-3 text-muted-foreground" />
			)}
			{onRefresh && !isOffline && (
				<Button
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="h-5 w-5 p-0"
				>
					<RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
				</Button>
			)}
		</div>
	);
}

/**
 * Hook to get formatted last updated text
 */
export function useLastUpdatedText(lastUpdated?: Date | string | null): string {
	const [text, setText] = React.useState("");

	React.useEffect(() => {
		if (!lastUpdated) {
			setText("");
			return;
		}

		const updateTime = typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;

		const updateText = () => {
			const now = new Date();
			const diffMs = now.getTime() - updateTime.getTime();
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			const diffHours = Math.floor(diffMinutes / 60);
			const diffDays = Math.floor(diffHours / 24);

			if (diffMinutes < 1) {
				setText("Just now");
			} else if (diffMinutes < 60) {
				setText(`${diffMinutes}m ago`);
			} else if (diffHours < 24) {
				setText(`${diffHours}h ago`);
			} else {
				setText(`${diffDays}d ago`);
			}
		};

		updateText();
		const interval = setInterval(updateText, 60000); // Update every minute

		return () => clearInterval(interval);
	}, [lastUpdated]);

	return text;
}
