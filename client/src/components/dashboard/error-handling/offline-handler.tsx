import { AlertCircle, Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface OfflineState {
	isOnline: boolean;
	wasOffline: boolean;
	offlineSince: Date | null;
	lastSyncTime: Date | null;
	pendingActions: number;
	hasOfflineData: boolean;
}

export function useOfflineHandler() {
	const [offlineState, setOfflineState] = useState<OfflineState>({
		isOnline: navigator.onLine,
		wasOffline: false,
		offlineSince: null,
		lastSyncTime: null,
		pendingActions: 0,
		hasOfflineData: false,
	});

	const handleOnline = useCallback(() => {
		setOfflineState((prev) => ({
			...prev,
			isOnline: true,
			wasOffline: prev.offlineSince !== null,
			offlineSince: null,
			lastSyncTime: new Date(),
		}));
	}, []);

	const handleOffline = useCallback(() => {
		setOfflineState((prev) => ({
			...prev,
			isOnline: false,
			offlineSince: new Date(),
		}));
	}, []);

	const addPendingAction = useCallback(() => {
		setOfflineState((prev) => ({
			...prev,
			pendingActions: prev.pendingActions + 1,
		}));
	}, []);

	const clearPendingActions = useCallback(() => {
		setOfflineState((prev) => ({
			...prev,
			pendingActions: 0,
		}));
	}, []);

	const setHasOfflineData = useCallback((hasData: boolean) => {
		setOfflineState((prev) => ({
			...prev,
			hasOfflineData: hasData,
		}));
	}, []);

	useEffect(() => {
		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [handleOnline, handleOffline]);

	return {
		offlineState,
		addPendingAction,
		clearPendingActions,
		setHasOfflineData,
	};
}

interface OfflineIndicatorProps {
	offlineState: OfflineState;
	variant?: "minimal" | "badge" | "full";
	className?: string;
}

export function OfflineIndicator({
	offlineState,
	variant = "badge",
	className,
}: OfflineIndicatorProps) {
	const { isOnline, offlineSince, pendingActions, hasOfflineData } =
		offlineState;

	const getOfflineDuration = () => {
		if (!offlineSince) return "";

		const now = new Date();
		const diff = now.getTime() - offlineSince.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		return `${minutes}m`;
	};

	if (variant === "minimal") {
		return (
			<div className={cn("flex items-center gap-1", className)}>
				<div
					className={cn(
						"w-2 h-2 rounded-full",
						isOnline ? "bg-green-500" : "bg-red-500",
					)}
				/>
				{!isOnline && <span className="text-xs text-red-600">Offline</span>}
			</div>
		);
	}

	if (variant === "badge") {
		if (isOnline) return null;

		return (
			<Badge
				variant="destructive"
				className={cn("flex items-center gap-1", className)}
			>
				<WifiOff className="h-3 w-3" />
				Offline {getOfflineDuration()}
			</Badge>
		);
	}

	return (
		<Card className={cn("border-orange-200", className)}>
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-orange-700">
					{isOnline ? (
						<Wifi className="h-5 w-5 text-green-500" />
					) : (
						<WifiOff className="h-5 w-5 text-red-500" />
					)}
					{isOnline ? "Back Online" : "Offline Mode"}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{!isOnline && (
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							You've been offline for {getOfflineDuration()}.
							{hasOfflineData && " Showing cached data."}
						</p>

						{pendingActions > 0 && (
							<div className="flex items-center gap-2 text-sm text-orange-600">
								<AlertCircle className="h-4 w-4" />
								{pendingActions} action{pendingActions > 1 ? "s" : ""} pending
								sync
							</div>
						)}
					</div>
				)}

				{isOnline && offlineState.wasOffline && (
					<div className="text-sm text-green-600">
						Connection restored. Syncing data...
					</div>
				)}
			</CardContent>
		</Card>
	);
}

interface OfflineDataWrapperProps {
	children: React.ReactNode;
	isOnline: boolean;
	hasOfflineData: boolean;
	lastSyncTime?: Date | null;
	onRefresh?: () => void;
	className?: string;
}

export function OfflineDataWrapper({
	children,
	isOnline,
	hasOfflineData,
	lastSyncTime,
	onRefresh,
	className,
}: OfflineDataWrapperProps) {
	const getLastSyncText = () => {
		if (!lastSyncTime) return "Never synced";

		const now = new Date();
		const diff = now.getTime() - lastSyncTime.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			return `Last synced ${hours}h ago`;
		}
		if (minutes > 0) {
			return `Last synced ${minutes}m ago`;
		}
		return "Just synced";
	};

	return (
		<div className={cn("relative", className)}>
			{!isOnline && hasOfflineData && (
				<Alert className="mb-4 border-orange-200 bg-orange-50">
					<Download className="h-4 w-4" />
					<AlertDescription className="flex items-center justify-between">
						<span>Showing cached data. {getLastSyncText()}.</span>
						{onRefresh && (
							<Button
								variant="outline"
								size="sm"
								onClick={onRefresh}
								className="ml-2"
								disabled={!isOnline}
							>
								<RefreshCw className="h-3 w-3 mr-1" />
								Refresh
							</Button>
						)}
					</AlertDescription>
				</Alert>
			)}

			<div
				className={cn(
					"transition-opacity duration-200",
					!isOnline && "opacity-75",
				)}
			>
				{children}
			</div>

			{!isOnline && (
				<div className="absolute inset-0 pointer-events-none">
					<div className="absolute top-2 right-2">
						<Badge variant="secondary" className="text-xs">
							<WifiOff className="h-3 w-3 mr-1" />
							Cached
						</Badge>
					</div>
				</div>
			)}
		</div>
	);
}

interface OfflineEmptyStateProps {
	title?: string;
	description?: string;
	onRetry?: () => void;
	className?: string;
}

export function OfflineEmptyState({
	title = "No Data Available Offline",
	description = "This data requires an internet connection to load. Please check your connection and try again.",
	onRetry,
	className,
}: OfflineEmptyStateProps) {
	return (
		<Card className={cn("border-orange-200", className)}>
			<CardContent className="flex flex-col items-center justify-center p-8 text-center">
				<WifiOff className="h-12 w-12 text-orange-500 mb-4" />
				<h3 className="font-semibold text-orange-700 mb-2">{title}</h3>
				<p className="text-sm text-muted-foreground mb-4 max-w-sm">
					{description}
				</p>
				{onRetry && (
					<Button onClick={onRetry} variant="outline" className="gap-2">
						<RefreshCw className="h-4 w-4" />
						Try Again
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

interface OfflineFallbackProps {
	children: React.ReactNode;
	fallback?: React.ReactNode;
	emptyState?: React.ReactNode;
	offlineState: OfflineState;
	hasData: boolean;
	onRefresh?: () => void;
}

export function OfflineFallback({
	children,
	fallback,
	emptyState,
	offlineState,
	hasData,
	onRefresh,
}: OfflineFallbackProps) {
	const { isOnline, hasOfflineData } = offlineState;

	// If online, show normal content
	if (isOnline) {
		return <>{children}</>;
	}

	// If offline but has cached data, show wrapped content
	if (hasOfflineData && hasData) {
		return (
			<OfflineDataWrapper
				isOnline={isOnline}
				hasOfflineData={hasOfflineData}
				lastSyncTime={offlineState.lastSyncTime}
				onRefresh={onRefresh}
			>
				{children}
			</OfflineDataWrapper>
		);
	}

	// If offline with no data, show empty state or fallback
	if (emptyState) {
		return <>{emptyState}</>;
	}

	if (fallback) {
		return <>{fallback}</>;
	}

	return <OfflineEmptyState onRetry={onRefresh} />;
}

// Hook for managing offline data caching
export function useOfflineCache<T>(key: string) {
	const [cachedData, setCachedData] = useState<T | null>(null);
	const [lastCacheTime, setLastCacheTime] = useState<Date | null>(null);

	const cacheData = useCallback(
		(data: T) => {
			try {
				localStorage.setItem(
					`offline_cache_${key}`,
					JSON.stringify({
						data,
						timestamp: new Date().toISOString(),
					}),
				);
				setCachedData(data);
				setLastCacheTime(new Date());
			} catch (error) {
				console.warn("Failed to cache data:", error);
			}
		},
		[key],
	);

	const loadCachedData = useCallback(() => {
		try {
			const cached = localStorage.getItem(`offline_cache_${key}`);
			if (cached) {
				const { data, timestamp } = JSON.parse(cached);
				setCachedData(data);
				setLastCacheTime(new Date(timestamp));
				return data;
			}
		} catch (error) {
			console.warn("Failed to load cached data:", error);
		}
		return null;
	}, [key]);

	const clearCache = useCallback(() => {
		try {
			localStorage.removeItem(`offline_cache_${key}`);
			setCachedData(null);
			setLastCacheTime(null);
		} catch (error) {
			console.warn("Failed to clear cache:", error);
		}
	}, [key]);

	useEffect(() => {
		loadCachedData();
	}, [loadCachedData]);

	return {
		cachedData,
		lastCacheTime,
		cacheData,
		loadCachedData,
		clearCache,
		hasCachedData: cachedData !== null,
	};
}
