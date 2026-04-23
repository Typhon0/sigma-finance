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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

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
	const StatusIcon = status.icon;

	return (
		<Card className={!isEnabled ? "opacity-60" : ""}>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="bg-muted rounded-lg p-2">
							<Icon className="h-5 w-5 text-muted-foreground" />
						</div>
						<div>
							<CardTitle className="text-base">{config?.label ?? assetType}</CardTitle>
							<CardDescription className="text-xs">
								{config?.description ?? "Catalog sync settings"}
							</CardDescription>
						</div>
					</div>
					<Switch
						checked={isEnabled}
						onCheckedChange={onToggle}
						disabled={syncStatus === "syncing" || isBusy}
					/>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="flex items-center justify-between text-sm">
					<div className="flex items-center gap-2">
						<Badge variant="outline" className="font-mono">
							{recordCount.toLocaleString()} records
						</Badge>
						<Badge variant={status.variant} className="flex items-center gap-1">
							<StatusIcon className="h-3 w-3" />
							{status.label}
						</Badge>
					</div>
					{lastSynced && (
						<span className="text-xs text-muted-foreground">
							{format(lastSynced, "MMM d, h:mm a")}
						</span>
					)}
				</div>
				{isEnabled && syncStatus !== "syncing" && !isBusy && (
					<Button onClick={onSync} className="mt-3 w-full" size="sm">
						<RefreshCw className="h-4 w-4" />
						Sync Now
					</Button>
				)}
				{isEnabled && isBusy && syncStatus !== "syncing" && (
					<div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<RefreshCw className="h-4 w-4 animate-spin" />
						Sync in progress
					</div>
				)}
				{syncStatus === "syncing" && (
					<div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<RefreshCw className="h-4 w-4 animate-spin" />
						Syncing...
					</div>
				)}
			</CardContent>
		</Card>
	);
}
