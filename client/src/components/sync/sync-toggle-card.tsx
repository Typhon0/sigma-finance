"use client";

import { format } from "date-fns";
import {
	BarChart3,
	CheckCircle,
	Clock,
	Coins,
	DollarSign,
	Globe,
	Landmark,
	RefreshCw,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type AssetType =
	| "equities"
	| "etfs"
	| "funds"
	| "indices"
	| "cryptocurrencies"
	| "currencies"
	| "money_markets"
	| "cryptos"
	| "moneymarkets";

export type SyncStatus = "idle" | "syncing" | "error" | "complete";

interface SyncToggleCardProps {
	assetType: AssetType;
	isEnabled: boolean;
	lastSynced: Date | null;
	recordCount: number;
	syncStatus: SyncStatus;
	isBusy?: boolean;
	onToggle: (enabled: boolean) => void;
	onSync: () => void;
}

const assetTypeConfig: Record<
	Exclude<AssetType, "cryptos" | "moneymarkets">,
	{ label: string; icon: typeof BarChart3; description: string }
> = {
	equities: {
		label: "Equities",
		icon: TrendingUp,
		description: "Stocks and equity securities",
	},
	etfs: {
		label: "ETFs",
		icon: BarChart3,
		description: "Exchange-traded funds",
	},
	funds: {
		label: "Funds",
		icon: Landmark,
		description: "Mutual funds and investment funds",
	},
	indices: {
		label: "Indices",
		icon: Globe,
		description: "Market indices and benchmarks",
	},
	cryptocurrencies: {
		label: "Cryptocurrencies",
		icon: Coins,
		description: "Digital assets and tokens",
	},
	currencies: {
		label: "Currencies",
		icon: DollarSign,
		description: "Foreign exchange pairs",
	},
	money_markets: {
		label: "Money Markets",
		icon: Clock,
		description: "Short-term debt instruments",
	},
};

const legacyAssetTypeMap: Partial<
	Record<AssetType, Exclude<AssetType, "cryptos" | "moneymarkets">>
> = {
	cryptos: "cryptocurrencies",
	moneymarkets: "money_markets",
};

const normalizeAssetType = (
	assetType: string,
): Exclude<AssetType, "cryptos" | "moneymarkets"> | undefined => {
	const normalized = assetType.trim().toLowerCase().replace(/\s+/g, "_");
	if (normalized in assetTypeConfig) {
		return normalized as Exclude<AssetType, "cryptos" | "moneymarkets">;
	}
	if (normalized in legacyAssetTypeMap) {
		return legacyAssetTypeMap[normalized as AssetType];
	}
	return undefined;
};

const statusConfig: Record<
	SyncStatus,
	{
		label: string;
		variant: "default" | "secondary" | "destructive" | "outline";
		icon: typeof CheckCircle;
	}
> = {
	idle: { label: "Idle", variant: "secondary", icon: Clock },
	syncing: { label: "Syncing", variant: "default", icon: RefreshCw },
	error: { label: "Error", variant: "destructive", icon: XCircle },
	complete: { label: "Complete", variant: "outline", icon: CheckCircle },
};

export function SyncToggleCard({
	assetType,
	isEnabled,
	lastSynced,
	recordCount,
	syncStatus,
	isBusy = false,
	onToggle,
	onSync,
}: SyncToggleCardProps) {
	const normalizedAssetType = normalizeAssetType(assetType);
	const config = normalizedAssetType ? assetTypeConfig[normalizedAssetType] : undefined;
	const status = statusConfig[syncStatus];
	const Icon = config?.icon ?? BarChart3;

	const isSyncing = syncStatus === "syncing" || isBusy;
	const isError = syncStatus === "error";

	return (
		<div
			className={cn(
				"rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs p-4 flex flex-col justify-between gap-4 transition-all hover:border-border/80 shadow-xs",
				!isEnabled && "opacity-60",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-foreground/80">
						<Icon className="h-4 w-4" />
					</div>
					<div className="min-w-0">
						<h4 className="text-sm font-semibold tracking-tight text-foreground truncate">
							{config?.label ?? assetType}
						</h4>
						<p className="text-[11px] text-muted-foreground truncate">
							{config?.description ?? "Configuration du catalogue"}
						</p>
					</div>
				</div>
				<Switch
					checked={isEnabled}
					onCheckedChange={onToggle}
					disabled={isSyncing}
					className="shrink-0 scale-90"
				/>
			</div>

			<div className="space-y-3 pt-1 border-t border-border/30">
				<div className="flex items-center justify-between text-xs">
					<span className="font-mono tabular-nums text-foreground/90 font-medium text-xs">
						{recordCount.toLocaleString()}{" "}
						<span className="text-[11px] font-normal text-muted-foreground">titres</span>
					</span>

					<Badge
						variant="outline"
						className={cn(
							"text-[10px] font-mono gap-1 px-1.5 py-0.5",
							isSyncing
								? "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400"
								: isError
									? "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
									: syncStatus === "complete"
										? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
										: "border-border/60 bg-muted/20 text-muted-foreground",
						)}
					>
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full",
								isSyncing
									? "bg-sky-500 animate-pulse"
									: isError
										? "bg-rose-500"
										: syncStatus === "complete"
											? "bg-emerald-500"
											: "bg-muted-foreground",
							)}
						/>
						{isSyncing ? "Sync..." : status.label}
					</Badge>
				</div>

				<div className="flex items-center justify-between gap-2 pt-0.5">
					<span className="text-[10px] text-muted-foreground truncate">
						{lastSynced ? format(lastSynced, "dd/MM/yyyy HH:mm") : "Jamais synchronisé"}
					</span>

					{isEnabled && (
						<Button
							variant="outline"
							size="sm"
							onClick={onSync}
							disabled={isSyncing}
							className="h-7 px-2.5 text-[11px] gap-1.5 border-border/60 bg-card/40 hover:bg-muted/40 shrink-0"
						>
							<RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
							{isSyncing ? "En cours" : "Sync"}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
