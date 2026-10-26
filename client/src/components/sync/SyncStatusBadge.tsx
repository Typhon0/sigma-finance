import {
	ApolloClient,
	ApolloLink,
	getApolloContext,
	InMemoryCache,
	useMutation,
} from "@apollo/client";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import { cn } from "@/lib/utils";

export interface SyncStatusBadgeProps {
	accountId: string;
	portfolioId?: string;
	syncStatus?: string | null;
	lastSyncAt?: string | Date | null;
	lastError?: string | null;
	provider?: string | null;
	onSyncComplete?: () => void;
	className?: string;
	compact?: boolean;
	showButtonText?: boolean;
}

export function formatRelativeSyncTime(dateInput: string | Date | null | undefined): string {
	if (!dateInput) return "Never synced";
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	if (Number.isNaN(date.getTime())) return "Never synced";

	const now = Date.now();
	const diffSec = Math.max(0, Math.floor((now - date.getTime()) / 1000));

	if (diffSec < 60) return "just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHours = Math.floor(diffMin / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays}d ago`;
}

export function SyncStatusBadge({
	accountId,
	portfolioId,
	syncStatus = "IDLE",
	lastSyncAt,
	lastError,
	provider,
	onSyncComplete,
	className,
	compact = false,
	showButtonText = false,
}: SyncStatusBadgeProps) {
	// Safe Apollo context handling when rendered in tests without ApolloProvider
	const apolloContext = useContext(getApolloContext());
	const fallbackClient = useMemo(() => {
		if (apolloContext?.client) return undefined;
		return new ApolloClient({ cache: new InMemoryCache(), link: ApolloLink.empty() });
	}, [apolloContext?.client]);

	const [triggerSyncMutation, { loading: isSyncing }] = useMutation(TRIGGER_ACCOUNT_SYNC, {
		client: fallbackClient,
		refetchQueries: [
			...(portfolioId ? [{ query: GET_ACCOUNTS, variables: { portfolioId } }] : []),
			...(portfolioId ? [{ query: GET_SYNC_CONNECTIONS, variables: { portfolioId } }] : []),
		],
	});
	const [localStatus, setLocalStatus] = useState<string | null>(null);

	const effectiveStatus = (localStatus || syncStatus || "IDLE").toUpperCase();
	const relativeTime = formatRelativeSyncTime(lastSyncAt);

	const handleSyncNow = async (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
			e.preventDefault();
		}

		if (isSyncing) return;

		setLocalStatus("SYNCING");
		const toastId = toast.loading("Triggering account sync...");

		try {
			const res = await triggerSyncMutation({
				variables: { accountId },
			});

			const syncRun = res.data?.triggerAccountSync;
			const status = syncRun?.status;

			if (status === "FAILED") {
				setLocalStatus("FAILED");
				toast.error(syncRun?.errorMessage || "Sync failed", { id: toastId });
			} else {
				setLocalStatus("SUCCESS");
				const itemsImported = syncRun?.itemsImported ?? 0;
				const itemsUpdated = syncRun?.itemsUpdated ?? 0;
				toast.success(
					`Account synced successfully (${itemsImported} imported, ${itemsUpdated} updated)`,
					{ id: toastId },
				);
			}

			onSyncComplete?.();
		} catch (err: unknown) {
			setLocalStatus("FAILED");
			const msg = err instanceof Error ? err.message : "Failed to sync account";
			toast.error(msg, { id: toastId });
		}
	};

	const renderBadge = () => {
		if (isSyncing || effectiveStatus === "SYNCING" || effectiveStatus === "IN_PROGRESS") {
			return (
				<Badge
					variant="outline"
					className="border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium"
				>
					<Loader2 className="mr-1.5 h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
					Syncing...
				</Badge>
			);
		}

		if (effectiveStatus === "FAILED" || effectiveStatus === "ERROR") {
			return (
				<Badge
					variant="outline"
					className="border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-medium"
					title={lastError || "Sync encountered an error"}
				>
					<AlertCircle className="mr-1.5 h-3 w-3 text-red-600 dark:text-red-400" />
					Sync Failed
				</Badge>
			);
		}

		if (effectiveStatus === "SUCCESS" || effectiveStatus === "COMPLETED") {
			return (
				<Badge
					variant="outline"
					className="border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium"
				>
					<CheckCircle2 className="mr-1.5 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
					Synced {relativeTime}
				</Badge>
			);
		}

		return (
			<Badge
				variant="outline"
				className="border-muted bg-muted/30 text-muted-foreground font-medium"
			>
				<Clock className="mr-1.5 h-3 w-3 text-muted-foreground" />
				{lastSyncAt ? `Synced ${relativeTime}` : "Ready to sync"}
			</Badge>
		);
	};

	return (
		<div
			className={cn("inline-flex items-center gap-1.5", className)}
			onClick={(e) => e.stopPropagation()}
		>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex items-center cursor-default">{renderBadge()}</span>
					</TooltipTrigger>
					<TooltipContent side="top">
						<div className="text-xs space-y-0.5">
							{provider && (
								<p className="font-semibold capitalize">Provider: {provider.toLowerCase()}</p>
							)}
							<p>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}</p>
							{lastError && <p className="text-destructive font-medium">Error: {lastError}</p>}
						</div>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className={cn(
								"h-7 w-7 text-muted-foreground hover:text-foreground",
								compact && "h-6 w-6 p-0",
							)}
							onClick={handleSyncNow}
							disabled={isSyncing}
							aria-label="Sync Now"
						>
							<RefreshCw
								className={cn("h-3.5 w-3.5", (isSyncing || effectiveStatus === "SYNCING") && "animate-spin")}
							/>
							{showButtonText && <span className="ml-1 text-xs">Sync Now</span>}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="top">
						<p className="text-xs">Sync now</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
