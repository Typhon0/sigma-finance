import { useMutation, useQuery } from "@apollo/client";
import { motion } from "framer-motion";
import {
	AlertTriangle,
	Building2,
	Cake,
	Coins,
	Copy,
	DollarSign,
	Edit,
	ExternalLink,
	Eye,
	HardDrive,
	Layers,
	MoreVertical,
	PieChart,
	Plus,
	RefreshCw,
	Settings,
	Shield,
	ShieldAlert,
	Trash2,
	Trophy,
	Wallet,
} from "lucide-react";

import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	type AllocationFilter,
	type AllocationSlice,
	AllocationWidget,
	buildAllocationSlices,
} from "@/components/assets/allocation";
import {
	type BasePositionItem,
	type GroupByOption,
	type KnownAccountGroup,
	PositionsDataTable,
} from "@/components/assets/positions-table";
import { AssetHeroChart, buildPerformanceSeries } from "@/components/charts/AssetHeroChart";
import type { TimeRange } from "@/components/charts/PortfolioHeroChart";
import { usePortfolio } from "@/components/PortfolioProvider";
import { AssetLogo } from "@/components/shared/AssetLogo";
import { computeDayChangeAmount } from "@/components/stocks-funds/day-change";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { AddWalletDialog } from "@/features/wallets";
import { UPDATE_TRANSACTION } from "@/graphql/mutations/transaction";
import {
	ASSIGN_WALLET_DEVICE,
	REFRESH_WALLET_BALANCE_PRICE,
	RESET_WALLET_BALANCE_COST_BASIS,
	SET_WALLET_BALANCE_COST_BASIS,
	TOGGLE_SPAM_TOKEN,
	TRIGGER_WALLET_SYNC,
} from "@/graphql/mutations/wallets";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { GET_WALLET_ACCOUNTS, GET_WALLET_DEVICES } from "@/graphql/queries/wallets";
import { useCurrency } from "@/hooks/use-currency";
import { computePortfolioPnl, computePositionPnl } from "@/lib/money/pnl";
import { allocatePercentages } from "@/lib/money/rounding";
import { cn } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddCryptoForm } from "./AddCryptoForm";

function getBlockExplorerUrl(
	network?: string,
	tokenAddress?: string | null,
	walletAddress?: string | null,
): string | null {
	const net = (network || "").toUpperCase();
	if (!tokenAddress && !walletAddress) return null;

	switch (net) {
		case "ETHEREUM":
			return tokenAddress
				? `https://etherscan.io/token/${tokenAddress}`
				: `https://etherscan.io/address/${walletAddress}`;
		case "BASE":
			return tokenAddress
				? `https://basescan.org/token/${tokenAddress}`
				: `https://basescan.org/address/${walletAddress}`;
		case "ARBITRUM":
			return tokenAddress
				? `https://arbiscan.io/token/${tokenAddress}`
				: `https://arbiscan.io/address/${walletAddress}`;
		case "OPTIMISM":
			return tokenAddress
				? `https://optimistic.etherscan.io/token/${tokenAddress}`
				: `https://optimistic.etherscan.io/address/${walletAddress}`;
		case "POLYGON":
			return tokenAddress
				? `https://polygonscan.com/token/${tokenAddress}`
				: `https://polygonscan.com/address/${walletAddress}`;
		case "SOLANA":
			return tokenAddress
				? `https://solscan.io/token/${tokenAddress}`
				: `https://solscan.io/account/${walletAddress}`;
		case "BITCOIN":
			return walletAddress ? `https://mempool.space/address/${walletAddress}` : null;
		default:
			return null;
	}
}

/** Crypto holding derived from portfolio asset data */
interface CryptoHolding {
	id: string;
	balanceId?: string;
	tokenAddress?: string | null;
	walletAddress?: string;
	network?: string;
	cryptoId: string;
	cryptoName: string;
	symbol: string;
	quantity: number;
	averageBuyPrice: number;
	currentPrice: number;
	value: number;
	cost: number;
	profitLoss: number;
	profitLossPercent: number;
	/**
	 * False when no purchase price was ever recorded for this holding. P&L is
	 * then genuinely unknown — reporting the full value as gain would invent
	 * profit that was never measured.
	 */
	hasCostBasis: boolean;
	costBasisType?: string | null;
	autoEstimatedBasis?: number | null;
	acquiredAt?: string | null;
	change24h: number;
	sparklineData: number[];
	accountName: string;
	accountType: "CEX" | "Wallet";
	walletAccountId?: string;
	deviceId?: string | null;
	deviceName?: string | null;
	deviceType?: "HARDWARE" | "SOFTWARE" | "STANDALONE" | null;
	icon: string;
	color: string;
	isPriceResolved?: boolean;
	priceSource?: string | null;
	priceUpdatedAt?: string | null;
}

export interface CryptoPositionItem extends BasePositionItem {
	cryptoId: string;
	accountType: "CEX" | "Wallet";
	sparklineData: number[];
	icon: string;
	color: string;
	rawHolding: CryptoHolding;
}

interface SparklinePoint {
	x: number;
	y: number;
}

interface PrioritizedInsightCard {
	id: string;
	priority: number;
	node: ReactElement;
}

interface CryptoListProps {
	onSelectCrypto: (cryptoId: string) => void;
	onSelectAccount?: (accountId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

/** Groupings for the shared allocation widget (mirrors the stock page card). */
const ALLOCATION_MODES = [
	{ id: "crypto", label: "By Crypto", groupUnit: "Assets" },
	{ id: "account", label: "By Account", groupUnit: "Accounts" },
	{ id: "type", label: "By Type", groupUnit: "Types" },
] as const;

type AllocationModeId = (typeof ALLOCATION_MODES)[number]["id"];

/** Custody split colours (data series, not status) */
const CUSTODY_COLORS: Record<string, string> = {
	CEX: "#38BDF8",
	Wallet: "#10B981",
};

/** Well-known crypto brand colours */
const CRYPTO_COLORS: Record<string, string> = {
	BTC: "#F7931A",
	ETH: "#627EEA",
	BNB: "#F3BA2F",
	SOL: "#14F195",
	XRP: "#23292F",
	ADA: "#0033AD",
	DOGE: "#C2A633",
	DOT: "#E6007A",
	MATIC: "#8247E5",
	LINK: "#2A5ADA",
	AVAX: "#E84142",
	UNI: "#FF007A",
	USDT: "#26A17B",
	USDC: "#2775CA",
};

const STABLE_SYMBOLS = new Set(["USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE"]);

const CRYPTO_TICKER_ALIASES: Record<string, string> = {
	RNDR: "RENDER",
	MATIC: "POL",
};

function buildSparklinePoints(data: number[], width: number, height: number): SparklinePoint[] {
	if (data.length === 0) return [];

	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;

	return data.map((value, index) => {
		const x = data.length > 1 ? (index / (data.length - 1)) * width : width;
		const y = height - ((value - min) / range) * height;
		return { x, y };
	});
}

function sparklinePath(points: SparklinePoint[]): string {
	if (points.length < 2) return "";
	return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function computeFallbackSparkline(currentPrice: number, dayChangePercent: number): number[] {
	if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
		return [0, 0, 0, 0, 0, 0, 0];
	}

	const points = 7;
	const startPrice = currentPrice / (1 + dayChangePercent / 100);
	const drift = currentPrice - startPrice;
	const volatility =
		Math.max(Math.abs(dayChangePercent) / 100, 0.004) * Math.max(currentPrice, startPrice);
	const seed = (Math.round(currentPrice * 100) % 37) / 37;
	const phaseA = seed * Math.PI * 2;
	const phaseB = seed * Math.PI;

	const series = Array.from({ length: points }, (_, index) => {
		const progress = points > 1 ? index / (points - 1) : 1;
		const baseline = startPrice + drift * progress;
		const waveA = Math.sin(progress * Math.PI * 1.8 + phaseA) * volatility * 0.25;
		const waveB = Math.sin(progress * Math.PI * 3.2 + phaseB) * volatility * 0.12;
		return Math.max(0, baseline + waveA + waveB);
	});

	series[0] = startPrice;
	series[series.length - 1] = currentPrice;
	return series.map((value) => Number(value.toFixed(4)));
}

function toFiniteNumber(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return value;
}

function SetCostBasisDialog({
	target,
	onClose,
	onSave,
	onReset,
	formatCurrency,
}: {
	target: CryptoHolding | null;
	onClose: () => void;
	onSave: (purchasePrice: number, purchaseDate?: string) => Promise<void>;
	onReset?: () => Promise<void>;
	formatCurrency: (val: number) => string;
}) {
	const [price, setPrice] = useState("");
	const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isResetting, setIsResetting] = useState(false);

	useEffect(() => {
		if (target) {
			setPrice(
				target.averageBuyPrice > 0
					? String(target.averageBuyPrice)
					: target.currentPrice > 0
						? String(target.currentPrice)
						: "",
			);
			setDate(new Date().toISOString().split("T")[0]);
		}
	}, [target]);

	if (!target) return null;

	const numPrice = parseFloat(price) || 0;
	const totalCost = numPrice * target.quantity;
	const hasAutoEstimated =
		typeof target.autoEstimatedBasis === "number" && target.autoEstimatedBasis > 0;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (numPrice <= 0) {
			toast.error("Please enter a valid purchase price");
			return;
		}
		setIsSubmitting(true);
		try {
			await onSave(numPrice, date);
			toast.success(`Cost basis recorded for ${target.symbol}`);
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to record cost basis";
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReset = async () => {
		if (!onReset) return;
		setIsResetting(true);
		try {
			await onReset();
			toast.success(`Restored auto-estimated basis for ${target.symbol}`);
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to reset cost basis";
			toast.error(msg);
		} finally {
			setIsResetting(false);
		}
	};

	return (
		<Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Set Cost Basis for {target.symbol}</DialogTitle>
					<DialogDescription>
						Record the purchase price for your on-chain {target.cryptoName} ({target.accountName})
						to calculate accurate Profit &amp; Loss.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4 pt-2">
					<div className="space-y-1">
						<Label className="text-xs text-muted-foreground">Quantity</Label>
						<Input
							disabled
							value={`${target.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${target.symbol}`}
							className="bg-muted font-mono text-sm"
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="purchase-price" className="text-xs">
							Purchase Price Per Token ($)
						</Label>
						<Input
							id="purchase-price"
							type="number"
							step="any"
							placeholder="e.g. 145.50"
							value={price}
							onChange={(e) => setPrice(e.target.value)}
							required
							autoFocus
							className="font-mono text-sm"
						/>
					</div>
					<div className="space-y-1">
						<Label htmlFor="purchase-date" className="text-xs">
							Purchase Date (Optional)
						</Label>
						<Input
							id="purchase-date"
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="text-sm"
						/>
					</div>
					<div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1.5 border border-border/60">
						<div className="flex justify-between text-muted-foreground">
							<span>Calculated Total Cost:</span>
							<span className="font-mono font-medium text-foreground">
								{formatCurrency(totalCost)}
							</span>
						</div>
						{hasAutoEstimated && (
							<div className="flex items-center justify-between pt-1 border-t border-border/40 text-muted-foreground">
								<span>Auto-Estimated Basis:</span>
								<span className="font-mono font-medium text-foreground">
									{formatCurrency(target.autoEstimatedBasis!)}/token
								</span>
							</div>
						)}
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 justify-between">
						{hasAutoEstimated && onReset ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
								onClick={handleReset}
								disabled={isSubmitting || isResetting}
							>
								{isResetting ? "Resetting..." : "Reset to Auto-Estimated"}
							</Button>
						) : (
							<div />
						)}
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								disabled={isSubmitting || isResetting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting || isResetting || numPrice <= 0}>
								{isSubmitting ? "Saving..." : "Save Cost Basis"}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function AssignDeviceDialog({
	target,
	devices,
	onClose,
	onAssign,
}: {
	target: CryptoHolding | null;
	devices: Array<{ id: string; name: string; deviceType: string }>;
	onClose: () => void;
	onAssign: (walletAccountId: string, deviceId: string | null) => Promise<void>;
}) {
	const [selectedDev, setSelectedDev] = useState<string>("none");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (target) {
			setSelectedDev(target.deviceId || "none");
		}
	}, [target]);

	if (!target || !target.walletAccountId) return null;

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await onAssign(target.walletAccountId!, selectedDev === "none" ? null : selectedDev);
			toast.success("Appareil mis à jour avec succès");
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Erreur association appareil";
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Associer à un Appareil / Hardware</DialogTitle>
					<DialogDescription>
						Associez l'adresse {target.symbol} ({target.accountName}) à un portefeuille physique
						(ex: Cypherock, Ledger) pour le regrouper en Cold Storage.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSave} className="space-y-4 pt-2">
					<div className="space-y-1.5">
						<Label className="text-xs">Appareil sélectionné</Label>
						<Select value={selectedDev} onValueChange={setSelectedDev}>
							<SelectTrigger className="text-sm">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">
									<span>🌐 Aucun (Hot Wallet / Software)</span>
								</SelectItem>
								{devices.map((d) => (
									<SelectItem key={d.id} value={d.id}>
										<div className="flex items-center justify-between w-full gap-2">
											<span>
												{d.deviceType === "HARDWARE" ? "🛡️ " : "📱 "}
												{d.name}
											</span>
											<span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
												{d.deviceType}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Enregistrement..." : "Enregistrer"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function truncateAddress(addr: string): string {
	if (!addr || addr.length <= 14) return addr || "";
	return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function CryptoList({
	onSelectCrypto,
	onSelectAccount,
	detailMode = "external",
	onBack,
}: CryptoListProps) {
	const {
		assets,
		allAssets,
		loading,
		addCrypto,
		currentPortfolio,
		transactions,
		selectedPortfolio,
		deleteAsset,
		updateAsset,
		refetch,
	} = usePortfolio();
	const [showAddForm, setShowAddForm] = useState(false);
	const [hideSmallBalances, setHideSmallBalances] = useState(false);
	const [filterExchange, setFilterExchange] = useState("all");
	const [cryptoGroupBy, setCryptoGroupBy] = useState<string>("account");
	const [timeRange, setTimeRange] = useState<TimeRange>("1M");
	const [allocationMode, setAllocationMode] = useState<AllocationModeId>("crypto");
	const [allocationFilter, setAllocationFilter] = useState<AllocationFilter | null>(null);
	const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CryptoHolding | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [editTarget, setEditTarget] = useState<CryptoHolding | null>(null);
	const [editQuantity, setEditQuantity] = useState("");
	const [editAverageBuyPrice, setEditAverageBuyPrice] = useState("");
	const [isSavingEdit, setIsSavingEdit] = useState(false);
	const [costBasisTarget, setCostBasisTarget] = useState<CryptoHolding | null>(null);
	const [editTransactionTarget, setEditTransactionTarget] = useState<{
		id: string;
		quantity: string;
		unitPriceAmount: string;
		executedAt: string;
		notes: string;
	} | null>(null);
	const { formatCurrency } = useCurrency();
	const [updateTransactionMutation, { loading: isSavingTransactionEdit }] =
		useMutation(UPDATE_TRANSACTION);

	const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
	const [isSyncingWallets, setIsSyncingWallets] = useState(false);

	const {
		data: walletAccountsData,
		refetch: refetchWalletAccounts,
		startPolling: startWalletPolling,
		stopPolling: stopWalletPolling,
	} = useQuery(GET_WALLET_ACCOUNTS, {
		variables: { portfolioId: currentPortfolio },
		skip: !currentPortfolio,
		fetchPolicy: "cache-and-network",
	});

	const isAnyWalletSyncing = useMemo(
		() =>
			(walletAccountsData?.walletAccounts ?? []).some(
				(w: any) => w.historyStatus === "IN_PROGRESS" || w.historyStatus === "PENDING",
			),
		[walletAccountsData],
	);

	useEffect(() => {
		if (isAnyWalletSyncing) {
			startWalletPolling?.(2500);
			return () => stopWalletPolling?.();
		} else {
			stopWalletPolling?.();
		}
	}, [isAnyWalletSyncing, startWalletPolling, stopWalletPolling]);

	const walletAccounts = useMemo(
		() => walletAccountsData?.walletAccounts ?? [],
		[walletAccountsData],
	);

	const { data: walletDevicesData } = useQuery(GET_WALLET_DEVICES);
	const walletDevices = useMemo(() => walletDevicesData?.walletDevices ?? [], [walletDevicesData]);

	const [assignWalletDeviceMutation] = useMutation(ASSIGN_WALLET_DEVICE, {
		onCompleted: () => {
			void refetchWalletAccounts();
		},
	});
	const [assignDeviceTarget, setAssignDeviceTarget] = useState<CryptoHolding | null>(null);

	const [triggerSyncMutation] = useMutation(TRIGGER_WALLET_SYNC);
	const [setWalletBalanceCostBasis] = useMutation(SET_WALLET_BALANCE_COST_BASIS);
	const [resetWalletBalanceCostBasis] = useMutation(RESET_WALLET_BALANCE_COST_BASIS);
	const [toggleSpamToken] = useMutation(TOGGLE_SPAM_TOKEN, {
		onCompleted: () => {
			toast.success("Token visibility updated");
			void refetchWalletAccounts();
		},
		onError: (err) => {
			toast.error(`Failed to update token: ${err.message}`);
		},
	});

	const [refreshWalletBalancePriceMutation] = useMutation(REFRESH_WALLET_BALANCE_PRICE, {
		onCompleted: () => {
			void refetchWalletAccounts();
		},
	});

	const handleRefreshPrice = useCallback(
		async (item: CryptoPositionItem) => {
			const balanceId = item.rawHolding?.balanceId;
			if (!balanceId) return;
			const toastId = toast.loading(`Refreshing price for ${item.symbol}...`);
			try {
				await refreshWalletBalancePriceMutation({
					variables: { balanceId },
				});
				await refetchWalletAccounts();
				toast.success(`Price updated for ${item.symbol}`, { id: toastId });
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : "Failed to refresh price";
				toast.error(msg, { id: toastId });
			}
		},
		[refreshWalletBalancePriceMutation, refetchWalletAccounts],
	);

	const handleSyncAllWallets = async () => {
		if (!walletAccounts.length) {
			toast.info("No on-chain wallets connected yet");
			return;
		}
		setIsSyncingWallets(true);
		const toastId = toast.loading(`Syncing ${walletAccounts.length} on-chain wallet(s)...`);
		try {
			let successCount = 0;
			for (const w of walletAccounts) {
				try {
					await triggerSyncMutation({ variables: { id: w.id } });
					successCount++;
				} catch (e) {
					console.error(`Failed to trigger sync for wallet ${w.id}:`, e);
				}
			}
			await refetchWalletAccounts();
			await refetch();
			toast.success(`Synchronized ${successCount} wallet(s)`, { id: toastId });
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to sync wallets";
			toast.error(msg, { id: toastId });
		} finally {
			setIsSyncingWallets(false);
		}
	};

	const cryptoHoldings = useMemo((): CryptoHolding[] => {
		const manualHoldings: CryptoHolding[] = assets
			.filter((asset) => asset.type === "crypto")
			.map((asset) => {
				const quantity = Number.isFinite(asset.quantity) && asset.quantity > 0 ? asset.quantity : 0;
				const averageBuyPrice = Number.isFinite(asset.purchasePrice) ? asset.purchasePrice : 0;
				const currentPrice = Number.isFinite(asset.currentPrice) ? asset.currentPrice : 0;
				const value = Number.isFinite(asset.currentValue) ? asset.currentValue : 0;
				const cost = averageBuyPrice * quantity;
				// A missing purchase price is NOT a zero-cost position. The shared
				// helper owns that rule so crypto and stocks cannot disagree again.
				const { hasCostBasis, pnl, pnlPercent } = computePositionPnl(value, cost);
				const profitLoss = pnl ?? 0;
				const profitLossPercent = pnlPercent ?? 0;
				const symbol = asset.symbol?.toUpperCase() || "?";
				const change24h = asset.dayChangePercent ?? 0;
				const accountName = asset.institution || asset.exchange || "Manual Entry";
				const accountType = /wallet/i.test(accountName) ? ("Wallet" as const) : ("CEX" as const);

				return {
					id: asset.id,
					cryptoId: asset.symbol?.toLowerCase() || asset.id,
					cryptoName: asset.name,
					symbol,
					quantity,
					averageBuyPrice,
					currentPrice,
					value,
					cost,
					profitLoss,
					profitLossPercent,
					hasCostBasis,
					change24h,
					sparklineData:
						Array.isArray(asset.sparklineData) && asset.sparklineData.length >= 2
							? asset.sparklineData
							: computeFallbackSparkline(currentPrice, change24h),
					accountName,
					accountType,
					icon: symbol.charAt(0),
					color: CRYPTO_COLORS[symbol] || "#64748B",
				};
			});

		// Build price & market data lookup from existing assets
		const priceLookup = new Map<
			string,
			{ currentPrice: number; change24h: number; sparklineData?: number[] }
		>();
		const sourceAssets = Array.isArray(allAssets) && allAssets.length > 0 ? allAssets : assets;
		for (const a of sourceAssets) {
			if (a.symbol && Number.isFinite(a.currentPrice) && (a.currentPrice ?? 0) > 0) {
				const sym = a.symbol.toUpperCase();
				if (!priceLookup.has(sym)) {
					priceLookup.set(sym, {
						currentPrice: a.currentPrice,
						change24h: a.dayChangePercent ?? 0,
						sparklineData: Array.isArray(a.sparklineData) ? a.sparklineData : undefined,
					});
				}
			}
		}

		for (const sym of STABLE_SYMBOLS) {
			if (!priceLookup.has(sym)) {
				priceLookup.set(sym, {
					currentPrice: 1.0,
					change24h: 0,
					sparklineData: [1, 1, 1, 1, 1, 1, 1],
				});
			}
		}

		// Map on-chain wallet account balances into CryptoHolding items
		const walletHoldings: CryptoHolding[] = [];
		for (const wallet of walletAccounts) {
			if (!wallet.isActive) continue;
			const shortAddr = truncateAddress(wallet.addressOrXpub);
			const formattedNet = wallet.network
				? wallet.network.charAt(0).toUpperCase() + wallet.network.slice(1).toLowerCase()
				: "Crypto";
			const accountName = wallet.label?.trim()
				? wallet.label.trim()
				: `${formattedNet} Wallet (${shortAddr})`;

			for (const b of wallet.balances ?? []) {
				if (b.isSpam || b.isHidden) continue;
				const quantity = Number(b.formattedQuantity) || 0;
				if (quantity <= 0) continue;

				let symbol = (b.symbol || "?").toUpperCase();
				let cryptoName = b.name || symbol;

				// Client-side mint fallback for Solana tokens
				if (wallet.network === "SOLANA" || b.tokenAddress) {
					if (
						b.tokenAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" ||
						(symbol.startsWith("SPL") && b.tokenAddress?.startsWith("EPjF"))
					) {
						symbol = "USDC";
						cryptoName = "USD Coin";
					} else if (
						b.tokenAddress === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" ||
						(symbol.startsWith("SPL") && b.tokenAddress?.startsWith("Es9v"))
					) {
						symbol = "USDT";
						cryptoName = "Tether USD";
					} else if (b.tokenAddress === "So11111111111111111111111111111111111111112") {
						symbol = "WSOL";
						cryptoName = "Wrapped SOL";
					} else if (b.tokenAddress === "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN") {
						symbol = "JUP";
						cryptoName = "Jupiter";
					} else if (b.tokenAddress === "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263") {
						symbol = "BONK";
						cryptoName = "Bonk";
					} else if (b.tokenAddress === "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm") {
						symbol = "WIF";
						cryptoName = "dogwifhat";
					} else if (
						b.tokenAddress === "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof" ||
						symbol === "RNDR"
					) {
						symbol = "RENDER";
						cryptoName = "Render";
					} else if (
						b.tokenAddress === "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" ||
						symbol === "PENGU"
					) {
						symbol = "PENGU";
						cryptoName = "Pudgy Penguins";
					}
				}

				if (CRYPTO_TICKER_ALIASES[symbol]) {
					symbol = CRYPTO_TICKER_ALIASES[symbol];
				}

				const serverPrice =
					typeof b.currentPrice === "number" && b.currentPrice > 0 ? b.currentPrice : null;
				const marketData =
					priceLookup.get(symbol) ??
					(CRYPTO_TICKER_ALIASES[symbol]
						? priceLookup.get(CRYPTO_TICKER_ALIASES[symbol])
						: undefined) ??
					(symbol === "WSOL" ? priceLookup.get("SOL") : undefined) ??
					(symbol === "WETH" ? priceLookup.get("ETH") : undefined) ??
					(symbol === "WBTC" ? priceLookup.get("BTC") : undefined);
				const currentPrice =
					serverPrice ?? marketData?.currentPrice ?? (STABLE_SYMBOLS.has(symbol) ? 1.0 : 0);
				const change24h =
					serverPrice !== null && typeof b.dayChange24h === "number"
						? b.dayChange24h
						: (marketData?.change24h ?? 0);
				const value =
					serverPrice !== null && typeof b.currentValue === "number" && b.currentValue > 0
						? b.currentValue
						: currentPrice > 0
							? quantity * currentPrice
							: 0;

				const isPriceResolved = b.isPriceResolved ?? currentPrice > 0;

				const costBasisPerUnit =
					typeof b.costBasisPerUnit === "number" && b.costBasisPerUnit > 0
						? b.costBasisPerUnit
						: null;
				const averageBuyPrice = costBasisPerUnit ?? 0;
				const cost = averageBuyPrice * quantity;
				const { hasCostBasis, pnl, pnlPercent } = computePositionPnl(value, cost);
				const profitLoss = pnl ?? 0;
				const profitLossPercent = pnlPercent ?? 0;

				walletHoldings.push({
					id: `wallet-bal-${b.id}`,
					balanceId: b.id,
					tokenAddress: b.tokenAddress,
					walletAddress: wallet.addressOrXpub,
					network: wallet.network,
					cryptoId: symbol.toLowerCase(),
					cryptoName,
					symbol,
					quantity,
					averageBuyPrice,
					currentPrice,
					value,
					cost,
					profitLoss,
					profitLossPercent,
					hasCostBasis,
					costBasisType: b.costBasisType,
					autoEstimatedBasis: b.autoEstimatedBasis,
					acquiredAt: b.acquiredAt,
					change24h,
					sparklineData:
						marketData?.sparklineData && marketData.sparklineData.length >= 2
							? marketData.sparklineData
							: computeFallbackSparkline(currentPrice, change24h),
					accountName,
					accountType: "Wallet",
					walletAccountId: wallet.id,
					deviceId: wallet.deviceId || wallet.device?.id || null,
					deviceName: wallet.device?.name || null,
					deviceType: (wallet.device?.deviceType as any) || null,
					icon: symbol.charAt(0),
					color: CRYPTO_COLORS[symbol] || "#10B981",
					isPriceResolved,
					priceSource: b.priceSource,
					priceUpdatedAt: b.priceUpdatedAt,
				});
			}
		}

		return [...manualHoldings, ...walletHoldings].sort((a, b) => b.value - a.value);
	}, [assets, allAssets, walletAccounts]);

	const cryptoPositions = useMemo<CryptoPositionItem[]>(() => {
		const values = cryptoHoldings.map((h) => h.value);
		const apportionedWeights = allocatePercentages(values);

		return cryptoHoldings.map((holding, index) => {
			const dayChangeAmount = computeDayChangeAmount(holding.value, holding.change24h);
			return {
				id: holding.id,
				assetId: holding.id,
				cryptoId: holding.cryptoId,
				portfolioId: currentPortfolio,
				symbol: holding.symbol,
				name: holding.cryptoName,
				quantity: holding.quantity,
				avgPrice: holding.averageBuyPrice,
				currentPrice: holding.currentPrice,
				value: holding.value,
				cost: holding.cost,
				pl: holding.hasCostBasis ? holding.profitLoss : null,
				plPercent: holding.profitLossPercent,
				currency: "USD",
				account: holding.accountName,
				accountType: holding.accountType,
				dayChange: holding.change24h,
				dayChangeAmount,
				weight: apportionedWeights[index] ?? 0,
				isPriceResolved: holding.isPriceResolved ?? holding.currentPrice > 0,
				sparklineData: holding.sparklineData,
				icon: holding.icon,
				color: holding.color,
				rawHolding: holding,
			};
		});
	}, [cryptoHoldings, currentPortfolio]);

	const displayCryptoPositions = useMemo(() => {
		return cryptoPositions.filter((pos) => {
			if (hideSmallBalances && pos.value < 1) return false;
			if (filterExchange !== "all" && pos.account !== filterExchange) return false;
			// Account-mode allocation taps are synced into filterExchange above;
			// asset and custody taps filter here.
			if (allocationFilter?.mode === "crypto" && pos.symbol !== allocationFilter.value)
				return false;
			if (allocationFilter?.mode === "type" && pos.accountType !== allocationFilter.value)
				return false;
			return true;
		});
	}, [cryptoPositions, hideSmallBalances, filterExchange, allocationFilter]);

	const knownAccountGroups = useMemo<KnownAccountGroup[]>(() => {
		const groups: KnownAccountGroup[] = [];

		for (const w of walletAccounts) {
			if (!w.isActive) continue;
			const shortAddr = truncateAddress(w.addressOrXpub);
			const formattedNet = w.network
				? w.network.charAt(0).toUpperCase() + w.network.slice(1).toLowerCase()
				: "Crypto";
			const groupName =
				w.device?.deviceType === "HARDWARE" && w.device?.name
					? `${w.device.name} (Hardware)`
					: w.label?.trim() || `${formattedNet} Wallet (${shortAddr})`;

			const syncStatus =
				w.historyStatus === "IN_PROGRESS" || w.historyStatus === "PENDING"
					? "SYNCING"
					: w.historyStatus === "ERROR"
						? "ERROR"
						: "SYNCED";

			if (!groups.some((g) => g.name === groupName)) {
				groups.push({
					name: groupName,
					syncStatus,
				});
			}
		}

		for (const holding of cryptoHoldings) {
			if (!groups.some((g) => g.name === holding.accountName)) {
				groups.push({
					name: holding.accountName,
					syncStatus: "SYNCED",
				});
			}
		}

		return groups;
	}, [walletAccounts, cryptoHoldings]);

	const uniqueExchanges = useMemo(
		() => [...new Set(cryptoHoldings.map((holding) => holding.accountName))],
		[cryptoHoldings],
	);

	const cryptoGroupByOptions = useMemo<GroupByOption<CryptoPositionItem>[]>(
		() => [
			{
				id: "account",
				label: "Account",
				icon: Wallet,
				getGroupKey: (p) => {
					if (p.rawHolding.deviceType === "HARDWARE" && p.rawHolding.deviceName) {
						return `${p.rawHolding.deviceName} (Hardware)`;
					}
					return p.account;
				},
				isClickableAccount: true,
			},
			{
				id: "asset",
				label: "Asset",
				icon: Layers,
				getGroupKey: (p) => p.symbol,
			},
			{
				id: "custody",
				label: "Custody",
				icon: Building2,
				getGroupKey: (p) => {
					if (p.accountType === "Wallet") {
						return p.rawHolding.deviceType === "HARDWARE"
							? "Self-Custody (Hardware / Cold Storage)"
							: "Self-Custody (Hot Wallet)";
					}
					return "Centralized Exchange (CEX)";
				},
			},
			{
				id: "none",
				label: "None",
				icon: PieChart,
				getGroupKey: () => "All",
			},
		],
		[],
	);

	const renderCryptoIcon = useCallback((item: CryptoPositionItem) => {
		return <AssetLogo symbol={item.symbol} name={item.name} assetType="crypto" size="sm" />;
	}, []);

	const renderCryptoBadges = useCallback(
		(item: CryptoPositionItem) => {
			// When grouped by account, the account/wallet name is already in the group header.
			// Showing "Wallet" or "CEX" on every single row inside the group is redundant.
			if (cryptoGroupBy === "account") {
				return null;
			}

			const isHardware = item.rawHolding.deviceType === "HARDWARE";
			return isHardware ? (
				<Badge
					variant="outline"
					className="h-4 px-1.5 py-0 text-micro font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 flex-shrink-0"
					title={
						item.rawHolding.deviceName
							? `${item.rawHolding.deviceName} (Hardware / Cold Storage)`
							: "Hardware Wallet (Cold Storage)"
					}
				>
					🛡️ Hardware
				</Badge>
			) : (
				<Badge
					variant="outline"
					className="h-4 px-1 py-0 text-micro font-medium text-muted-foreground border-border/40 flex-shrink-0"
				>
					{item.accountType}
				</Badge>
			);
		},
		[cryptoGroupBy],
	);

	const renderCryptoCostBasis = useCallback(
		(item: CryptoPositionItem) => {
			const isWalletItem = item.accountType === "Wallet";
			const needsCostBasis = isWalletItem && !item.rawHolding.hasCostBasis;
			const basisType = item.rawHolding.costBasisType;
			const acquiredDateStr = item.rawHolding.acquiredAt
				? new Date(item.rawHolding.acquiredAt).toLocaleDateString()
				: null;

			if (needsCostBasis) {
				return (
					<button
						type="button"
						onClick={(event) => {
							event.stopPropagation();
							setCostBasisTarget(item.rawHolding);
						}}
						className="inline-flex items-center h-4 px-1.5 py-0 text-[10px] font-semibold text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 rounded transition-colors cursor-pointer"
						title="Set purchase price or cost basis"
					>
						Set Cost Basis
					</button>
				);
			}

			if (basisType === "HISTORICAL_FMV") {
				return (
					<div className="flex items-center gap-1 flex-nowrap">
						<span className="text-micro text-muted-foreground font-mono tabular-nums">
							Cost: {formatCurrency(item.cost)}
						</span>
						<Badge
							variant="secondary"
							className="h-4 px-1 py-0 text-micro font-medium bg-muted/60 text-muted-foreground border-border/30 cursor-pointer hover:bg-muted flex-shrink-0"
							title={
								acquiredDateStr
									? `Estimated basis on transfer date ${acquiredDateStr}. Click to edit.`
									: "Estimated basis based on historical market value. Click to edit."
							}
							onClick={(event) => {
								event.stopPropagation();
								setCostBasisTarget(item.rawHolding);
							}}
						>
							Est. Basis
						</Badge>
					</div>
				);
			}

			if (basisType === "DEX_SWAP") {
				return (
					<div className="flex items-center gap-1 flex-nowrap">
						<span className="text-micro text-muted-foreground font-mono tabular-nums">
							Cost: {formatCurrency(item.cost)}
						</span>
						<Badge
							variant="secondary"
							className="h-4 px-1 py-0 text-micro font-medium bg-blue-500/10 text-blue-500 border-blue-500/20 cursor-pointer hover:bg-blue-500/20 flex-shrink-0"
							title="Cost basis derived from on-chain DEX swap. Click to edit."
							onClick={(event) => {
								event.stopPropagation();
								setCostBasisTarget(item.rawHolding);
							}}
						>
							DEX Swap
						</Badge>
					</div>
				);
			}

			if (basisType === "MANUAL") {
				return (
					<div className="flex items-center gap-1 flex-nowrap">
						<span className="text-micro text-muted-foreground font-mono tabular-nums">
							Cost: {formatCurrency(item.cost)}
						</span>
						<Badge
							variant="secondary"
							className="h-4 px-1 py-0 text-micro font-medium bg-primary/10 text-primary border-primary/20 cursor-pointer hover:bg-primary/20 flex-shrink-0"
							title="Manual cost basis set by user. Click to edit."
							onClick={(event) => {
								event.stopPropagation();
								setCostBasisTarget(item.rawHolding);
							}}
						>
							Manual
						</Badge>
					</div>
				);
			}

			return null;
		},
		[formatCurrency],
	);

	const selectCrypto = useCallback(
		(holding: CryptoHolding) => {
			if (detailMode === "panel") {
				setSelectedHoldingId(holding.id);
				return;
			}
			onSelectCrypto(holding.cryptoId);
		},
		[detailMode, onSelectCrypto],
	);

	const handleSelectAccount = useCallback(
		(accountName: string) => {
			if (onSelectAccount) {
				onSelectAccount(accountName);
				return;
			}
			window.location.href = "/settings/connections";
		},
		[onSelectAccount],
	);

	const openEditDialog = useCallback((holding: CryptoHolding) => {
		setEditTarget(holding);
		setEditQuantity(String(holding.quantity));
		setEditAverageBuyPrice(String(holding.averageBuyPrice));
	}, []);

	const renderCryptoActions = useCallback(
		(item: CryptoPositionItem) => {
			const isWalletItem = item.accountType === "Wallet";
			const explorerUrl = isWalletItem
				? getBlockExplorerUrl(
						item.rawHolding.network,
						item.rawHolding.tokenAddress,
						item.rawHolding.walletAddress,
					)
				: null;
			const addressToCopy = item.rawHolding.tokenAddress || item.rawHolding.walletAddress || "";

			return (
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
						<Button
							variant="ghost"
							size="sm"
							aria-label={`Actions for ${item.symbol}`}
							className="min-h-[44px] min-w-[44px] md:min-h-0 md:h-7 md:w-7 p-0 cursor-pointer opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:opacity-100 touch-target"
						>
							<MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onClick={(event) => {
								event.stopPropagation();
								selectCrypto(item.rawHolding);
							}}
						>
							<Eye className="mr-2 h-4 w-4" />
							View details
						</DropdownMenuItem>

						{isWalletItem ? (
							<>
								{explorerUrl && (
									<DropdownMenuItem
										onClick={(event) => {
											event.stopPropagation();
											window.open(explorerUrl, "_blank", "noopener,noreferrer");
										}}
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										View on Explorer
									</DropdownMenuItem>
								)}
								{addressToCopy && (
									<DropdownMenuItem
										onClick={(event) => {
											event.stopPropagation();
											navigator.clipboard.writeText(addressToCopy);
											toast.success("Address copied to clipboard");
										}}
									>
										<Copy className="mr-2 h-4 w-4" />
										Copy Address
									</DropdownMenuItem>
								)}
								<DropdownMenuItem
									onClick={(event) => {
										event.stopPropagation();
										setCostBasisTarget(item.rawHolding);
									}}
								>
									<DollarSign className="mr-2 h-4 w-4" />
									Set Cost Basis
								</DropdownMenuItem>
								{item.rawHolding.walletAccountId && (
									<DropdownMenuItem
										onClick={(event) => {
											event.stopPropagation();
											setAssignDeviceTarget(item.rawHolding);
										}}
									>
										<Shield className="mr-2 h-4 w-4" />
										Associer à un appareil...
									</DropdownMenuItem>
								)}
								{item.rawHolding.balanceId && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-amber-600 focus:text-amber-600 focus:bg-amber-500/10"
											onClick={(event) => {
												event.stopPropagation();
												void toggleSpamToken({
													variables: {
														balanceId: item.rawHolding.balanceId,
														isHidden: true,
													},
												});
											}}
										>
											<ShieldAlert className="mr-2 h-4 w-4" />
											Hide Token
										</DropdownMenuItem>
									</>
								)}
							</>
						) : (
							<>
								<DropdownMenuItem
									onClick={(event) => {
										event.stopPropagation();
										openEditDialog(item.rawHolding);
									}}
								>
									<Edit className="mr-2 h-4 w-4" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive focus:bg-destructive/10"
									onClick={(event) => {
										event.stopPropagation();
										setDeleteTarget(item.rawHolding);
									}}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			);
		},
		[selectCrypto, openEditDialog, toggleSpamToken],
	);

	const selectedHolding = useMemo(
		() => cryptoHoldings.find((holding) => holding.id === selectedHoldingId) ?? null,
		[cryptoHoldings, selectedHoldingId],
	);

	const selectedHoldingTransactions = useMemo(() => {
		if (!selectedHolding) return [];
		const symbolLower = selectedHolding.symbol.toLowerCase();
		const selectedAssetId = selectedHolding.id;
		return (Array.isArray(transactions) ? transactions : [])
			.filter((transaction) => {
				const row = transaction as Record<string, unknown>;
				const transactionAssetId = typeof row.assetId === "string" ? row.assetId : "";
				if (transactionAssetId && selectedAssetId && transactionAssetId === selectedAssetId) {
					return true;
				}
				const assetSymbol =
					typeof row.assetSymbol === "string" ? row.assetSymbol.toLowerCase() : "";
				const notes = typeof row.notes === "string" ? row.notes.toLowerCase() : "";
				return assetSymbol === symbolLower || notes.includes(symbolLower);
			})
			.slice()
			.sort((a, b) => {
				const aDate = new Date(
					((a as Record<string, unknown>).executedAt as string | Date | undefined) ?? 0,
				).getTime();
				const bDate = new Date(
					((b as Record<string, unknown>).executedAt as string | Date | undefined) ?? 0,
				).getTime();
				return bDate - aDate;
			});
	}, [transactions, selectedHolding]);

	const closeEditDialog = () => {
		setEditTarget(null);
		setEditQuantity("");
		setEditAverageBuyPrice("");
	};

	const handleSaveEdit = async () => {
		if (!editTarget) return;
		const quantity = Number(editQuantity);
		const averageBuyPrice = Number(editAverageBuyPrice);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			toast.error("Quantity must be greater than 0.");
			return;
		}
		if (!Number.isFinite(averageBuyPrice) || averageBuyPrice < 0) {
			toast.error("Average price must be greater than or equal to 0.");
			return;
		}

		setIsSavingEdit(true);
		try {
			await updateAsset(editTarget.id, {
				portfolioId: currentPortfolio || undefined,
				quantity,
				averagePurchasePrice: averageBuyPrice,
			});
			toast.success(`${editTarget.symbol} updated.`);
			closeEditDialog();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to update.";
			toast.error(message);
		} finally {
			setIsSavingEdit(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteTarget) return;
		setIsDeleting(true);
		try {
			await deleteAsset(deleteTarget.id, currentPortfolio || undefined);
			toast.success(`${deleteTarget.symbol} removed from portfolio.`);
			if (selectedHoldingId === deleteTarget.id) {
				setSelectedHoldingId(null);
			}
			setDeleteTarget(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to delete position.";
			toast.error(message);
		} finally {
			setIsDeleting(false);
		}
	};

	const openTransactionEditDialog = (row: Record<string, unknown>) => {
		const id = typeof row.id === "string" ? row.id : "";
		if (!id) {
			toast.error("Transaction not found.");
			return;
		}

		const quantityValue = Number(row.quantity ?? 0);
		const unitPriceValue = Number(row.unitPriceAmount ?? 0);
		const executedAtRaw = row.executedAt;
		const executedAt = executedAtRaw ? new Date(String(executedAtRaw)) : new Date();
		const localDateTimeValue = Number.isNaN(executedAt.getTime())
			? ""
			: `${executedAt.getFullYear()}-${String(executedAt.getMonth() + 1).padStart(2, "0")}-${String(
					executedAt.getDate(),
				).padStart(2, "0")}T${String(executedAt.getHours()).padStart(2, "0")}:${String(
					executedAt.getMinutes(),
				).padStart(2, "0")}`;

		setEditTransactionTarget({
			id,
			quantity: Number.isFinite(quantityValue) ? String(quantityValue) : "",
			unitPriceAmount: Number.isFinite(unitPriceValue) ? String(unitPriceValue) : "",
			executedAt: localDateTimeValue,
			notes: typeof row.notes === "string" ? row.notes : "",
		});
	};

	const closeTransactionEditDialog = () => {
		setEditTransactionTarget(null);
	};

	const handleSaveTransactionEdit = async () => {
		if (!editTransactionTarget) return;

		const quantity = Number(editTransactionTarget.quantity);
		const unitPriceAmount = Number(editTransactionTarget.unitPriceAmount);
		if (!Number.isFinite(quantity) || quantity <= 0) {
			toast.error("Transaction quantity must be greater than 0.");
			return;
		}
		if (!Number.isFinite(unitPriceAmount) || unitPriceAmount <= 0) {
			toast.error("Unit price must be greater than 0.");
			return;
		}

		const executedAtDate = new Date(editTransactionTarget.executedAt);
		if (Number.isNaN(executedAtDate.getTime())) {
			toast.error("Invalid transaction date.");
			return;
		}

		try {
			await updateTransactionMutation({
				variables: {
					id: editTransactionTarget.id,
					input: {
						quantity,
						unitPriceAmount,
						executedAt: executedAtDate.toISOString(),
						notes: editTransactionTarget.notes.trim() || null,
					},
				},
			});
			await refetch?.();
			toast.success("Transaction updated.");
			closeTransactionEditDialog();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to update transaction.";
			toast.error(message);
		}
	};

	// Portfolio P&L and the value/cost subtotals come from the shared helper: it
	// sums only the holdings whose cost basis is known, and withholds the total
	// when too little of the portfolio is priced to describe the whole.
	const pnlTotals = computePortfolioPnl(
		cryptoHoldings.map((holding) => ({ value: holding.value, cost: holding.cost })),
	);
	const totalValue = pnlTotals.totalValue;
	const totalCost = pnlTotals.coveredCost;
	const hasReliableCostBasis = pnlTotals.isReliable;
	const latentPnL = pnlTotals.pnl;
	const latentPnLPercent = pnlTotals.pnlPercent;

	// Rank only holdings whose gain is actually measurable. A position without a
	// purchase price has no return to compare, and would otherwise sit at 0% and
	// win or lose by accident.
	const ratedHoldings = cryptoHoldings.filter((holding) => holding.hasCostBasis);
	const bestPerformer =
		ratedHoldings.length > 0
			? [...ratedHoldings].sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]
			: null;
	// Cash received from sales. This is turn­over, NOT profit: a sale's gain is
	// proceeds minus the cost of the units sold, which the transaction list does
	// not carry here. It is labelled as proceeds wherever it is shown.
	const sellProceeds = useMemo(() => {
		if (!Array.isArray(transactions)) return 0;

		return transactions.reduce((sum: number, transaction: { type?: string; total?: number }) => {
			if (transaction?.type === "sell" && Number.isFinite(transaction.total)) {
				return sum + Math.abs(transaction.total ?? 0);
			}
			return sum;
		}, 0);
	}, [transactions]);

	const { data: scopedHistoryData } = useQuery(GET_SCOPED_PERFORMANCE_HISTORY, {
		variables: {
			portfolioID: selectedPortfolio?.id ?? "",
			assetTypes: ["CRYPTO"],
		},
		skip: !selectedPortfolio?.id,
		fetchPolicy: "cache-and-network",
		nextFetchPolicy: "cache-first",
	});
	const performanceData = useMemo(
		() => buildPerformanceSeries(scopedHistoryData?.scopedPerformanceHistory ?? [], totalValue),
		[scopedHistoryData, totalValue],
	);

	const chartHoldings = useMemo(
		() =>
			cryptoHoldings.map((h) => ({
				value: h.value,
				currentPrice: h.currentPrice,
				changePercent: h.change24h,
				sparklineData: h.sparklineData,
			})),
		[cryptoHoldings],
	);

	const allocationItems = useMemo<AllocationSlice[]>(() => {
		if (cryptoHoldings.length === 0 || totalValue <= 0) return [];

		const accountPalette = [
			"#38BDF8",
			"#A78BFA",
			"#F97316",
			"#22C55E",
			"#EF4444",
			"#EAB308",
			"#14B8A6",
		];
		const typeColors: Record<string, string> = {
			CEX: "#38BDF8",
			Wallet: "#10B981",
		};
		if (allocationMode === "account") {
			const grouped = new Map<string, { value: number; count: number }>();
			for (const holding of cryptoHoldings) {
				const current = grouped.get(holding.accountName) ?? { value: 0, count: 0 };
				grouped.set(holding.accountName, {
					value: current.value + holding.value,
					count: current.count + 1,
				});
			}
			return buildAllocationSlices(
				[...grouped.entries()].map(([name, { value, count }]) => ({ name, value, count })),
				{
					colorFor: (_name, index) => accountPalette[index % accountPalette.length],
				},
			);
		}

		if (allocationMode === "type") {
			const grouped = new Map<string, { value: number; count: number }>();
			for (const holding of cryptoHoldings) {
				const current = grouped.get(holding.accountType) ?? { value: 0, count: 0 };
				grouped.set(holding.accountType, {
					value: current.value + holding.value,
					count: current.count + 1,
				});
			}
			return buildAllocationSlices(
				[...grouped.entries()].map(([name, { value, count }]) => ({ name, value, count })),
				{
					colorFor: (name) => typeColors[name] ?? "#94A3B8",
				},
			);
		}

		const grouped = new Map<string, { value: number; count: number }>();
		for (const holding of cryptoHoldings) {
			const current = grouped.get(holding.symbol) ?? { value: 0, count: 0 };
			grouped.set(holding.symbol, {
				value: current.value + holding.value,
				count: current.count + 1,
			});
		}
		return buildAllocationSlices(
			[...grouped.entries()].map(([name, { value, count }]) => ({ name, value, count })),
			{
				// Well-known brand colours first; unknown symbols fall back to
				// the theme series inside the shared builder.
				colorFor: (name) => CRYPTO_COLORS[name],
			},
		);
	}, [cryptoHoldings, allocationMode, totalValue]);

	const handleAllocationModeChange = useCallback(
		(mode: string) => {
			setAllocationMode(mode as AllocationModeId);
			if (allocationFilter?.mode === "account") setFilterExchange("all");
			setAllocationFilter(null);
		},
		[allocationFilter],
	);

	const handleAllocationFilterChange = useCallback(
		(filter: AllocationFilter | null) => {
			setAllocationFilter(filter);
			// Account taps drive the existing toolbar account filter so the
			// table and the widget never disagree about what is selected.
			if (filter?.mode === "account") {
				setFilterExchange(filter.value);
			} else if (allocationFilter?.mode === "account") {
				setFilterExchange("all");
			}
		},
		[allocationFilter],
	);

	const handleAllocationSelectItem = useCallback(
		(item: AllocationSlice, mode: string) => {
			if (mode !== "crypto") return;
			const holding = cryptoHoldings.find((h) => h.symbol === item.name);
			if (!holding) return;
			if (detailMode === "panel") {
				setSelectedHoldingId(holding.id);
				return;
			}
			onSelectCrypto(holding.cryptoId);
		},
		[cryptoHoldings, detailMode, onSelectCrypto],
	);

	const dryPowderValue = cryptoHoldings
		.filter((holding) => STABLE_SYMBOLS.has(holding.symbol))
		.reduce((sum, holding) => sum + holding.value, 0);
	const dryPowderPercent = totalValue > 0 ? Math.min(100, (dryPowderValue / totalValue) * 100) : 0;
	const cexHoldings = cryptoHoldings.filter((holding) => holding.accountType === "CEX");
	const walletHoldings = cryptoHoldings.filter((holding) => holding.accountType === "Wallet");
	const cexValue = cexHoldings.reduce((sum, holding) => sum + holding.value, 0);
	const walletValue = walletHoldings.reduce((sum, holding) => sum + holding.value, 0);
	const cexPercent = totalValue > 0 ? (cexValue / totalValue) * 100 : 0;
	const walletPercent = totalValue > 0 ? (walletValue / totalValue) * 100 : 0;
	const underwaterCount = cryptoHoldings.filter((holding) => holding.profitLoss < 0).length;
	const ath = performanceData.reduce((max, point) => Math.max(max, point.portfolioValue), 0);
	const athDistancePercent = ath > 0 ? ((totalValue - ath) / ath) * 100 : 0;
	const inProfitCount = cryptoHoldings.filter((holding) => holding.profitLoss > 0).length;
	const normalizedTransactions = Array.isArray(transactions) ? transactions : [];
	const cumulativeFees = normalizedTransactions.reduce((sum, tx) => {
		const txRecord = tx as Record<string, unknown>;
		const directFee =
			toFiniteNumber(txRecord.feesAmount) ??
			toFiniteNumber(txRecord.fees) ??
			toFiniteNumber(txRecord.fee);
		if (directFee !== null) return sum + Math.abs(directFee);
		const txType = typeof txRecord.type === "string" ? txRecord.type.toLowerCase() : "";
		if (txType === "fee") return sum + Math.abs(toFiniteNumber(txRecord.total) ?? 0);
		return sum;
	}, 0);
	const hasConnectedExchange = cryptoHoldings.some(
		(holding) => holding.accountType === "CEX" && !/manual entry/i.test(holding.accountName),
	);
	const hasSellTransaction = normalizedTransactions.some((tx) => {
		const txType = typeof tx?.type === "string" ? tx.type.toLowerCase() : "";
		return txType === "sell";
	});
	const dcaBuyDates = normalizedTransactions
		.filter((tx) => {
			const txType = typeof tx?.type === "string" ? tx.type.toLowerCase() : "";
			return txType === "buy" || txType === "deposit" || txType === "transfer_in";
		})
		.map((tx) => new Date(tx.date))
		.filter((date) => !Number.isNaN(date.getTime()))
		.sort((a, b) => a.getTime() - b.getTime());
	const dcaLast30Count = dcaBuyDates.filter(
		(date) => date.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000,
	).length;
	const averageDaysBetweenBuys =
		dcaBuyDates.length >= 2
			? dcaBuyDates.slice(1).reduce((sum, date, index) => {
					const prev = dcaBuyDates[index];
					const diff = (date.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
					return sum + Math.max(0, diff);
				}, 0) /
				(dcaBuyDates.length - 1)
			: null;
	const concentrationShare =
		cryptoHoldings.length > 0 && totalValue > 0 ? (cryptoHoldings[0].value / totalValue) * 100 : 0;
	const worstPerformer =
		ratedHoldings.length > 0
			? [...ratedHoldings].sort((a, b) => a.profitLossPercent - b.profitLossPercent)[0]
			: null;
	const today = new Date();
	const firstBuyDate = dcaBuyDates[0] ?? null;
	const anniversaryYears = firstBuyDate ? today.getFullYear() - firstBuyDate.getFullYear() : 0;
	const isFirstBuyAnniversary =
		Boolean(firstBuyDate) &&
		anniversaryYears >= 1 &&
		firstBuyDate?.getDate() === today.getDate() &&
		firstBuyDate?.getMonth() === today.getMonth();
	const allTimeReturnPercent = latentPnLPercent;
	const rawScopedHistory = scopedHistoryData?.scopedPerformanceHistory;
	const hasBackendHistory = Array.isArray(rawScopedHistory) && rawScopedHistory.length >= 2;
	const isNewAthMilestone = useMemo(() => {
		if (!hasBackendHistory || !rawScopedHistory) return false;
		const values = rawScopedHistory.map((point: { value: number }) => point.value);
		if (values.length < 2) return false;
		const last = values[values.length - 1];
		const previousMax = Math.max(...values.slice(0, -1));
		return Number.isFinite(last) && Number.isFinite(previousMax) && last > previousMax * 1.0001;
	}, [rawScopedHistory, hasBackendHistory]);

	// 24h pulse leaders for the Exposure rail.
	const sortedByDayChange = useMemo(
		() => [...cryptoHoldings].sort((a, b) => b.change24h - a.change24h),
		[cryptoHoldings],
	);
	const bestDayChange = sortedByDayChange[0] ?? null;
	const worstDayChange = sortedByDayChange[sortedByDayChange.length - 1] ?? null;
	// Share of realized profits consumed by fees — a sharper lens than fees alone.
	// Fees as a share of sale proceeds — a cost ratio that is arithmetically
	// true, rather than a "share of profits" the client cannot derive.
	const feeTakeRate =
		sellProceeds > 0 && cumulativeFees > 0 ? (cumulativeFees / sellProceeds) * 100 : null;
	// Last-30-day buy cadence for the rhythm strip: one cell per day, filled on buys.
	const dcaDayCells = useMemo(() => {
		const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
		const buyDays = new Set(dcaBuyDates.map(dayKey));
		const today = new Date();
		return Array.from({ length: 30 }, (_, offset) => {
			const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (29 - offset));
			return { key: dayKey(date), active: buyDays.has(dayKey(date)) };
		});
	}, [dcaBuyDates]);
	// Downsampled portfolio-value trace for the drawdown card sparkline.
	const drawdownTrace = useMemo(() => {
		const values = performanceData
			.map((point) => point.portfolioValue)
			.filter((value) => Number.isFinite(value));
		if (values.length < 2 || ath <= 0) return null;
		const step = Math.max(1, Math.floor(values.length / 48));
		const sampled = values.filter((_, index) => index % step === 0);
		if (sampled[sampled.length - 1] !== values[values.length - 1]) {
			sampled.push(values[values.length - 1]);
		}
		const lo = Math.min(...sampled);
		const hi = Math.max(ath, ...sampled);
		const span = hi - lo || 1;
		return { sampled, lo, hi, span };
	}, [performanceData, ath]);

	const prioritizedInsightCards = useMemo<PrioritizedInsightCard[]>(() => {
		const cards: PrioritizedInsightCard[] = [];

		cards.push({
			id: "distribution",
			priority: 100,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardContent className="pt-4">
						<ErrorBoundary>
							<AllocationWidget
								modes={ALLOCATION_MODES}
								activeMode={allocationMode}
								onModeChange={handleAllocationModeChange}
								items={allocationItems}
								totalValue={totalValue}
								formatCurrency={formatCurrency}
								activeFilter={allocationFilter}
								onFilterChange={handleAllocationFilterChange}
								onSelectItem={handleAllocationSelectItem}
								loading={loading}
								testId="crypto-allocation-widget"
							/>
						</ErrorBoundary>
					</CardContent>
				</Card>
			),
		});
		cards.push({
			id: "drawdown",
			priority: athDistancePercent <= -25 ? 84 : 52,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-semibold tracking-tight">Drawdown</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						{ath <= 0 ? (
							<p className="text-sm text-muted-foreground">
								Not enough history to measure the distance from the peak yet.
							</p>
						) : (
							<>
								<p
									className={cn(
										"flex items-center gap-1.5 font-mono text-4xl font-bold tracking-tight",
										athDistancePercent >= 0 ? "text-gain" : "text-loss",
									)}
								>
									{athDistancePercent >= 0 ? <TrendArrowUp /> : <TrendArrowDown />}
									{athDistancePercent >= 0 ? "+" : ""}
									{athDistancePercent.toFixed(1)}%
								</p>
								{drawdownTrace && (
									<svg
										viewBox="0 0 100 32"
										preserveAspectRatio="none"
										className="mt-3 h-12 w-full"
										role="img"
										aria-label="Portfolio value trace against its all-time high"
									>
										<line
											x1="0"
											x2="100"
											y1={30 - ((ath - drawdownTrace.lo) / drawdownTrace.span) * 28}
											y2={30 - ((ath - drawdownTrace.lo) / drawdownTrace.span) * 28}
											stroke="currentColor"
											className="text-warning"
											strokeWidth="0.6"
											strokeDasharray="2 2"
											opacity="0.8"
											vectorEffect="non-scaling-stroke"
										/>
										<polyline
											points={drawdownTrace.sampled
												.map(
													(value, index) =>
														`${((index / Math.max(1, drawdownTrace.sampled.length - 1)) * 100).toFixed(1)},${(30 - ((value - drawdownTrace.lo) / drawdownTrace.span) * 28).toFixed(1)}`,
												)
												.join(" ")}
											fill="none"
											stroke="currentColor"
											className="text-muted-foreground"
											strokeWidth="1.2"
											strokeLinejoin="round"
											strokeLinecap="round"
											vectorEffect="non-scaling-stroke"
										/>
									</svg>
								)}
								<p className="mt-2 text-xs text-muted-foreground">
									Peak value {formatCurrency(ath)}.{" "}
									{dryPowderPercent > 0 && athDistancePercent < 0
										? `${formatCurrency(dryPowderValue)} in stablecoins is ready to buy the dip.`
										: "The hero chart tracks the climb back."}
								</p>
							</>
						)}
					</CardContent>
				</Card>
			),
		});

		cards.push({
			id: "position-score",
			priority: 31,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-semibold tracking-tight">Position Score</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="font-mono text-4xl font-bold tracking-tight">
							{inProfitCount}
							<span className="text-muted-foreground text-2xl"> / {cryptoHoldings.length}</span>
						</p>
						<div
							className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/60"
							role="img"
							aria-label={`${inProfitCount} of ${cryptoHoldings.length} positions above cost basis`}
						>
							<motion.div
								className="h-full bg-gain"
								initial={{ width: 0 }}
								animate={{
									width: `${cryptoHoldings.length > 0 ? (inProfitCount / cryptoHoldings.length) * 100 : 0}%`,
								}}
								transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
							/>
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							{inProfitCount === cryptoHoldings.length
								? "Every position is above its average purchase price."
								: underwaterCount > 0
									? `${underwaterCount} position${underwaterCount === 1 ? " is" : "s are"} underwater — candidates to review below.`
									: "Based on average purchase price."}
						</p>
					</CardContent>
				</Card>
			),
		});

		if (cumulativeFees > 10) {
			const feeWeight = totalValue > 0 ? (cumulativeFees / totalValue) * 100 : 0;
			cards.push({
				id: "fee-impact",
				priority: 56,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">Fee Impact</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="font-mono text-3xl font-bold tracking-tight">
								{formatCurrency(cumulativeFees)}
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{feeTakeRate !== null
									? `Fees took ${feeTakeRate >= 100 ? feeTakeRate.toFixed(0) : feeTakeRate.toFixed(1)}% of sale proceeds.`
									: `${feeWeight.toFixed(2)}% of current portfolio value.`}
							</p>
							<div
								className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/60"
								role="img"
								aria-label={`Fees are ${feeTakeRate !== null ? `${feeTakeRate.toFixed(1)} percent of sale proceeds` : `${feeWeight.toFixed(2)} percent of portfolio value`}`}
							>
								<motion.div
									className="h-full bg-warning"
									initial={{ width: 0 }}
									animate={{
										width: `${Math.min(100, Math.max(4, feeTakeRate !== null ? Math.min(100, feeTakeRate) : Math.min(100, feeWeight * 10)))}%`,
									}}
									transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
								/>
							</div>
						</CardContent>
					</Card>
				),
			});
		} else {
			const cadenceLabel =
				averageDaysBetweenBuys === null
					? "Not enough history"
					: averageDaysBetweenBuys <= 10
						? "Steady pace"
						: averageDaysBetweenBuys <= 21
							? "Moderate pace"
							: "Opportunistic pace";
			cards.push({
				id: "dca-rhythm",
				priority: 47,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">
								Investment Rhythm (DCA)
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="flex items-baseline justify-between">
								<p className="font-mono text-3xl font-bold tracking-tight">
									{dcaLast30Count}
									<span className="text-muted-foreground text-lg"> / 30d</span>
								</p>
								<span className="text-xs font-medium text-foreground/80">{cadenceLabel}</span>
							</div>
							<div
								className="mt-3 flex items-center gap-[3px]"
								role="img"
								aria-label={`${dcaLast30Count} buy days in the last 30 days`}
							>
								{dcaDayCells.map((cell) => (
									<span
										key={cell.key}
										className={cn(
											"h-4 w-full rounded-[2px]",
											cell.active ? "bg-gain" : "bg-secondary/60",
										)}
									/>
								))}
							</div>
							<p className="mt-2 text-xs text-muted-foreground">
								{averageDaysBetweenBuys === null
									? "Add more buy transactions to measure consistency."
									: `Average interval: ${averageDaysBetweenBuys.toFixed(1)} days.`}
							</p>
						</CardContent>
					</Card>
				),
			});
		}

		if (cryptoHoldings.length < 3) {
			cards.push({
				id: "concentration-alert",
				priority: 64,
				node: (
					<Card className="border-warning/30 bg-warning/5">
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-warning">
								<AlertTriangle className="h-3.5 w-3.5" />
								Concentration Alert
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="font-mono text-3xl font-bold tracking-tight">
								{cryptoHoldings[0]?.symbol ?? "-"}{" "}
								<span className="text-warning">{concentrationShare.toFixed(0)}%</span>
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								One position holds the majority of risk. Adding a second asset would balance the
								portfolio.
							</p>
						</CardContent>
					</Card>
				),
			});
		} else {
			cards.push({
				id: "movers",
				priority: 58,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">Movers</CardTitle>
						</CardHeader>
						<CardContent className="space-y-1 pt-0 text-sm">
							{bestPerformer && (
								<button
									type="button"
									onClick={() => selectCrypto(bestPerformer)}
									className="flex w-full cursor-pointer items-center justify-between rounded-md px-1.5 py-1.5 transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									aria-label={`Open ${bestPerformer.symbol} details, up ${bestPerformer.profitLossPercent.toFixed(1)} percent`}
								>
									<span className="text-muted-foreground">Best · {bestPerformer.symbol}</span>
									<span className="flex items-center gap-1 font-mono font-semibold text-gain">
										<TrendArrowUp className="h-3 w-3" />+
										{bestPerformer.profitLossPercent.toFixed(1)}%
									</span>
								</button>
							)}
							{worstPerformer && worstPerformer.id !== bestPerformer?.id && (
								<button
									type="button"
									onClick={() => selectCrypto(worstPerformer)}
									className="flex w-full cursor-pointer items-center justify-between rounded-md px-1.5 py-1.5 transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									aria-label={`Open ${worstPerformer.symbol} details, ${worstPerformer.profitLossPercent.toFixed(1)} percent`}
								>
									<span className="text-muted-foreground">Worst · {worstPerformer.symbol}</span>
									<span className="flex items-center gap-1 font-mono font-semibold text-loss">
										<TrendArrowDown className="h-3 w-3" />
										{worstPerformer.profitLossPercent.toFixed(1)}%
									</span>
								</button>
							)}
							{!bestPerformer && <p className="text-muted-foreground">-</p>}
						</CardContent>
					</Card>
				),
			});
		}

		if (!hasSellTransaction) {
			cards.push({
				id: "realized-pnl-empty",
				priority: 72,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">Realized P&L</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
								<p className="text-sm text-foreground">No sales recorded yet.</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Profits appear here once you log a sell transaction.
								</p>
								<Button
									size="sm"
									variant="outline"
									className="mt-3 h-7 text-xs"
									onClick={() => setShowAddForm(true)}
								>
									<Plus className="mr-1.5 h-3.5 w-3.5" />
									Add transaction
								</Button>
							</div>
						</CardContent>
					</Card>
				),
			});
		}

		if (!hasConnectedExchange) {
			cards.push({
				id: "exchange-empty",
				priority: 80,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">Fee Analysis</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-sm text-muted-foreground">
								Automatic fee analysis needs an exchange connection. Until then, fees are tracked
								from the transactions you log.
							</p>
							<div className="mt-3 flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									className="h-7 text-xs"
									disabled
									aria-disabled="true"
									title="Exchange connections are not available yet"
								>
									Connect an exchange
								</Button>
								<Badge
									variant="outline"
									className="h-4 px-1.5 text-micro font-medium text-muted-foreground border-border/40"
								>
									Soon
								</Badge>
							</div>
						</CardContent>
					</Card>
				),
			});
		}

		return cards.sort((a, b) => b.priority - a.priority).slice(0, 3);
	}, [
		athDistancePercent,
		bestPerformer,
		concentrationShare,
		cryptoHoldings,
		cumulativeFees,
		dcaDayCells,
		dcaLast30Count,
		drawdownTrace,
		dryPowderPercent,
		dryPowderValue,
		feeTakeRate,
		allocationFilter,
		allocationItems,
		allocationMode,
		ath,
		formatCurrency,
		handleAllocationFilterChange,
		handleAllocationModeChange,
		handleAllocationSelectItem,
		loading,
		hasConnectedExchange,
		hasSellTransaction,
		inProfitCount,
		averageDaysBetweenBuys,
		selectCrypto,
		totalValue,
		underwaterCount,
		worstPerformer,
	]);

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-24 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
				<div className="h-80 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
				<div className="h-72 rounded-xl border border-border/50 bg-muted/20 animate-pulse" />
			</div>
		);
	}

	if (cryptoHoldings.length === 0 && walletAccounts.length === 0) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
						<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
							<span className="h-2 w-2 animate-pulse rounded-full bg-gain" />
							Last sync: Just now
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="h-10 px-3 text-xs font-medium"
							onClick={() => setShowAddWalletDialog(true)}
						>
							<Wallet className="mr-1.5 h-3.5 w-3.5 text-primary" />
							Connect Wallet
						</Button>
						{walletAccounts.length > 0 && (
							<Button
								variant="outline"
								size="sm"
								className="h-10 px-3 text-xs"
								onClick={handleSyncAllWallets}
								disabled={isSyncingWallets}
							>
								<RefreshCw className={`mr-1.5 h-3 w-3 ${isSyncingWallets ? "animate-spin" : ""}`} />
								Sync Wallets
							</Button>
						)}
						<Button
							className="h-10 px-4 bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
							onClick={() => setShowAddForm(true)}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Transaction
						</Button>
					</div>
				</div>
				<div className="py-16 text-center max-w-xl mx-auto">
					<Coins className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
					<h2 className="mb-2 text-2xl font-bold">No crypto positions</h2>
					<p className="mx-auto mb-6 text-muted-foreground text-sm">
						Connect your on-chain crypto wallets for automatic balance and trade synchronization, or
						add positions manually.
					</p>
					<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
						<Button onClick={() => setShowAddWalletDialog(true)} className="w-full sm:w-auto">
							<Wallet className="mr-2 h-4 w-4" />
							Connect On-Chain Wallet
						</Button>
						<Button
							variant="outline"
							onClick={() => setShowAddForm(true)}
							className="w-full sm:w-auto"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Position Manually
						</Button>
					</div>
					<div className="mt-6 flex flex-wrap justify-center items-center gap-1.5 text-xs text-muted-foreground">
						<span className="font-medium text-foreground">Supported Networks:</span>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Ethereum
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Base
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Arbitrum
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Optimism
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Polygon
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Solana
						</Badge>
						<Badge variant="secondary" className="text-[11px] font-mono">
							Bitcoin
						</Badge>
					</div>
				</div>

				<AddWalletDialog
					open={showAddWalletDialog}
					onOpenChange={setShowAddWalletDialog}
					portfolioId={currentPortfolio}
					onSuccess={() => {
						void refetchWalletAccounts();
						void refetch();
					}}
				/>

				<AddCryptoForm
					open={showAddForm}
					onClose={() => setShowAddForm(false)}
					onSubmit={async (data) => {
						if (!currentPortfolio) {
							toast.error("No portfolio selected. Please select a portfolio first.");
							throw new Error("No portfolio selected");
						}
						try {
							const result = await addCrypto({
								name: data.cryptoName || data.symbol,
								instrumentID: data.instrumentID || data.cryptoId || undefined,
								assetTypeID: "2",
								quantity: data.quantity || 0,
								purchasePrice: data.averageBuyPrice || 0,
								currentValue: data.currentPrice * data.quantity || undefined,
								purchaseDate: data.purchaseDate,
								walletAddress: data.walletAddress || undefined,
								blockchainNetwork: undefined,
								quoteCurrency: data.quoteCurrency,
							});

							if (result.asset || result.portfolioAsset) {
								toast.success(`Added ${data.quantity} ${data.symbol} to your portfolio!`);
								setShowAddForm(false);
							} else {
								throw new Error("createCryptoAsset returned no asset");
							}
						} catch (error) {
							const msg =
								error instanceof Error ? error.message : "Failed to add crypto. Please try again.";
							toast.error(msg);
							throw error;
						}
					}}
				/>
			</div>
		);
	}

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			<AssetPageHeader
				title="Crypto Assets"
				description="Track cryptocurrency assets, portfolio allocation, wallet performance, and live market trends."
				onBack={onBack}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs font-medium"
							onClick={() => setShowAddWalletDialog(true)}
						>
							<Wallet className="mr-1.5 h-3.5 w-3.5 text-primary" />
							Connect Wallet
						</Button>
						{walletAccounts.length > 0 && (
							<Button
								size="sm"
								variant="outline"
								className="h-8 text-xs"
								onClick={handleSyncAllWallets}
								disabled={isSyncingWallets}
							>
								<RefreshCw className={`mr-1.5 h-3 w-3 ${isSyncingWallets ? "animate-spin" : ""}`} />
								Sync Wallets
							</Button>
						)}
						<Button
							size="sm"
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs"
							onClick={() => setShowAddForm(true)}
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							New Transaction
						</Button>
					</div>
				}
			/>

			{/* Connected Wallets Sync Status Ribbon */}
			{walletAccounts.length > 0 && (
				<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs">
					<div className="flex items-center gap-2.5 flex-wrap">
						<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
						<span className="font-semibold text-foreground">
							{walletAccounts.length} On-Chain Wallet{walletAccounts.length > 1 ? "s" : ""}{" "}
							Connected
						</span>
						<span className="text-muted-foreground">•</span>
						<div className="flex items-center gap-1.5 flex-wrap">
							{Array.from(
								new Set<string>(walletAccounts.map((w: { network: string }) => w.network)),
							).map((net) => (
								<Badge
									key={net}
									variant="outline"
									className="text-[10px] uppercase font-mono px-1.5 py-0 h-4"
								>
									{net}
								</Badge>
							))}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground text-[11px]">
							{(() => {
								const lastSync = walletAccounts
									.map((w: { lastSyncAt?: string | null }) => w.lastSyncAt)
									.filter(Boolean)
									.sort()
									.reverse()[0];
								return lastSync
									? `Last synced: ${new Date(lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
									: "Sync ready";
							})()}
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs text-primary hover:text-primary/80"
							onClick={handleSyncAllWallets}
							disabled={isSyncingWallets}
						>
							<RefreshCw className={`h-3 w-3 mr-1 ${isSyncingWallets ? "animate-spin" : ""}`} />
							Sync Now
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
							onClick={() => (window.location.href = "/settings/connections")}
						>
							<Settings className="h-3 w-3 mr-1" />
							Manage Wallets
						</Button>
					</div>
				</div>
			)}

			{/* Unified Dashboard Grid: Chart + Summary side by side with vertical separator */}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-10 border-b border-border/30 pb-6">
				{/* Unified Left Section: Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AssetHeroChart
							title="Crypto Value"
							titleTooltip="Total value of crypto held in this portfolio"
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={totalValue}
							totalGain={latentPnL ?? undefined}
							totalGainPercent={latentPnLPercent ?? undefined}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={selectedPortfolio?.id}
							loading={loading && cryptoHoldings.length === 0}
							defaultBenchmark="sp500"
							layoutId="cryptoHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>{" "}
				{/* Unified Right Section: Exposure brief */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<div className="flex flex-col space-y-4">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
								Exposure
							</span>
						</div>

						{/* Custody split */}
						<div className="space-y-2">
							<div
								className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/60"
								role="img"
								aria-label={`${cexPercent.toFixed(1)} percent on exchanges, ${walletPercent.toFixed(1)} percent in self-custody`}
							>
								<motion.div
									className="h-full"
									style={{ backgroundColor: CUSTODY_COLORS.CEX }}
									initial={{ width: 0 }}
									animate={{ width: `${Math.min(100, Math.max(0, cexPercent))}%` }}
									transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
								/>
								<motion.div
									className="h-full"
									style={{ backgroundColor: CUSTODY_COLORS.Wallet }}
									initial={{ width: 0 }}
									animate={{ width: `${Math.min(100, Math.max(0, walletPercent))}%` }}
									transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
								/>
							</div>
							<div className="space-y-1.5 text-xs">
								<div className="flex items-center justify-between">
									<span className="flex items-center gap-1.5 text-muted-foreground">
										<span
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: CUSTODY_COLORS.CEX }}
										/>
										Exchanges · {cexHoldings.length}
									</span>
									<span className="font-mono font-semibold">
										{formatCurrency(cexValue)} · {cexPercent.toFixed(0)}%
									</span>
								</div>
								<div className="flex items-center justify-between">
									<span className="flex items-center gap-1.5 text-muted-foreground">
										<span
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: CUSTODY_COLORS.Wallet }}
										/>
										Self-custody · {walletHoldings.length}
									</span>
									<span className="font-mono font-semibold">
										{formatCurrency(walletValue)} · {walletPercent.toFixed(0)}%
									</span>
								</div>
							</div>
						</div>

						<div className="space-y-3 border-t border-border/15 pt-3 text-xs">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Dry powder</span>
								{dryPowderPercent === 0 ? (
									<span className="flex items-center gap-1 font-mono font-semibold text-warning">
										<AlertTriangle className="h-3 w-3" />
										Fully deployed
									</span>
								) : (
									<span className="font-mono font-semibold">
										{formatCurrency(dryPowderValue)} · {dryPowderPercent.toFixed(0)}%
									</span>
								)}
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Invested capital</span>
								<span className="font-mono font-semibold">
									{hasReliableCostBasis ? formatCurrency(totalCost) : "--"}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Sell proceeds</span>
								<span className="font-mono font-semibold">
									{sellProceeds > 0 ? formatCurrency(sellProceeds) : "--"}
								</span>
							</div>
						</div>

						{bestDayChange && worstDayChange && bestDayChange.id !== worstDayChange.id && (
							<div className="space-y-1.5 border-t border-border/15 pt-3 text-xs">
								<p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
									24h pulse
								</p>
								<button
									type="button"
									onClick={() => selectCrypto(bestDayChange)}
									className="flex w-full cursor-pointer items-center justify-between rounded-md px-1.5 py-1 transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									aria-label={`Open ${bestDayChange.symbol} details`}
								>
									<span className="text-muted-foreground">{bestDayChange.symbol}</span>
									<span
										className={cn(
											"flex items-center gap-1 font-mono font-semibold",
											bestDayChange.change24h >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{bestDayChange.change24h >= 0 ? (
											<TrendArrowUp className="h-3 w-3" />
										) : (
											<TrendArrowDown className="h-3 w-3" />
										)}
										{bestDayChange.change24h >= 0 ? "+" : ""}
										{bestDayChange.change24h.toFixed(1)}%
									</span>
								</button>
								<button
									type="button"
									onClick={() => selectCrypto(worstDayChange)}
									className="flex w-full cursor-pointer items-center justify-between rounded-md px-1.5 py-1 transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									aria-label={`Open ${worstDayChange.symbol} details`}
								>
									<span className="text-muted-foreground">{worstDayChange.symbol}</span>
									<span
										className={cn(
											"flex items-center gap-1 font-mono font-semibold",
											worstDayChange.change24h >= 0 ? "text-gain" : "text-loss",
										)}
									>
										{worstDayChange.change24h >= 0 ? (
											<TrendArrowUp className="h-3 w-3" />
										) : (
											<TrendArrowDown className="h-3 w-3" />
										)}
										{worstDayChange.change24h >= 0 ? "+" : ""}
										{worstDayChange.change24h.toFixed(1)}%
									</span>
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{(isNewAthMilestone || isFirstBuyAnniversary) && (
				<div
					className={cn(
						"flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
						isNewAthMilestone ? "border-warning/30 bg-warning/5" : "border-gain/30 bg-gain/5",
					)}
					role="status"
				>
					<div className="flex items-center gap-3">
						<span
							className={cn(
								"flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
								isNewAthMilestone ? "bg-warning/15 text-warning" : "bg-gain/15 text-gain",
							)}
						>
							{isNewAthMilestone ? <Trophy className="h-5 w-5" /> : <Cake className="h-5 w-5" />}
						</span>
						<div>
							<p className="text-sm font-semibold">
								{isNewAthMilestone
									? "New all-time high reached"
									: `Your portfolio is ${anniversaryYears} year${anniversaryYears > 1 ? "s" : ""} old today`}
							</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								{isNewAthMilestone
									? "The climb is real. Review whether winners should be trimmed into strength."
									: "Held through every cycle since. Consistency is the strategy working."}
							</p>
						</div>
					</div>
					<p className="font-mono text-2xl font-bold tracking-tight sm:text-right">
						<span className={isNewAthMilestone ? "text-warning" : "text-gain"}>
							{isNewAthMilestone
								? formatCurrency(totalValue)
								: `${allTimeReturnPercent !== null && allTimeReturnPercent >= 0 ? "+" : ""}${allTimeReturnPercent !== null ? allTimeReturnPercent.toFixed(1) : "--"}%`}
						</span>{" "}
						<span className="block text-xs font-medium text-muted-foreground sm:inline">
							{isNewAthMilestone ? "peak value" : "all-time return"}
						</span>
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{prioritizedInsightCards.map((card) => (
					<div key={card.id}>{card.node}</div>
				))}
			</div>

			<PositionsDataTable<CryptoPositionItem>
				positions={displayCryptoPositions}
				loading={loading}
				defaultGroupBy="account"
				groupBy={cryptoGroupBy}
				onGroupByChange={setCryptoGroupBy}
				groupByOptions={cryptoGroupByOptions}
				knownAccountGroups={knownAccountGroups}
				emptyGroupMessage="No crypto holdings in this wallet yet."
				toolbarExtra={
					<div className="flex items-center gap-2">
						<Select value={filterExchange} onValueChange={setFilterExchange}>
							<SelectTrigger className="h-8 w-32 text-xs border-border/50 bg-background touch-target">
								<SelectValue placeholder="Account" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All accounts</SelectItem>
								{uniqueExchanges.map((exchange) => (
									<SelectItem key={exchange} value={exchange}>
										{exchange}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<div className="flex items-center gap-2 rounded-lg border border-border/50 px-2 h-8 bg-background text-xs text-muted-foreground">
							<Switch
								id="crypto-hide-small"
								checked={hideSmallBalances}
								onCheckedChange={setHideSmallBalances}
							/>
							<label
								htmlFor="crypto-hide-small"
								className="cursor-pointer select-none text-micro font-medium"
							>
								Hide &lt; $1
							</label>
						</div>
					</div>
				}
				renderInstrumentIcon={renderCryptoIcon}
				renderBadges={renderCryptoBadges}
				renderCostBasisExtra={renderCryptoCostBasis}
				renderActions={renderCryptoActions}
				formatCurrency={formatCurrency}
				formatQuantity={(qty) => qty.toLocaleString("en-US", { maximumFractionDigits: 6 })}
				onSelectAsset={(_symbol, item) => selectCrypto(item.rawHolding)}
				onSelectAccount={handleSelectAccount}
				onDeletePosition={(item) => setDeleteTarget(item.rawHolding)}
				onRefreshPrice={handleRefreshPrice}
				csvFilename={`sigma_crypto_holdings_export_${new Date().toISOString().split("T")[0]}.csv`}
				csvHeaders={[
					"Symbol",
					"Name",
					"Account",
					"Custody Type",
					"Quantity",
					"Current Price",
					"24H Change (%)",
					"Total Value",
					"Avg Buy Price",
					"Total Cost Basis",
					"Unrealized P&L ($)",
					"Unrealized P&L (%)",
					"Portfolio Weight (%)",
				]}
				csvRowMapper={(p) => [
					p.symbol,
					p.name,
					p.account,
					p.accountType,
					p.quantity,
					p.currentPrice.toFixed(4),
					(p.dayChange ?? 0).toFixed(2),
					p.value.toFixed(2),
					p.avgPrice.toFixed(4),
					p.cost.toFixed(2),
					p.pl === null ? "" : p.pl.toFixed(2),
					p.pl === null ? "" : p.plPercent.toFixed(2),
					(p.weight ?? 0).toFixed(2),
				]}
				emptyMessage="No crypto assets found matching the criteria."
			/>

			<AddCryptoForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={async (data) => {
					if (!currentPortfolio) {
						toast.error("No portfolio selected. Please select a portfolio first.");
						throw new Error("No portfolio selected");
					}
					try {
						const result = await addCrypto({
							name: data.cryptoName || data.symbol,
							instrumentID: data.instrumentID || data.cryptoId || undefined,
							assetTypeID: "2",
							quantity: data.quantity || 0,
							purchasePrice: data.averageBuyPrice || 0,
							currentValue: data.currentPrice * data.quantity || undefined,
							purchaseDate: data.purchaseDate,
							walletAddress: data.walletAddress || undefined,
							blockchainNetwork: undefined,
							quoteCurrency: data.quoteCurrency,
						});

						if (result.asset || result.portfolioAsset) {
							toast.success(`Added ${data.quantity} ${data.symbol} to your portfolio!`);
							setShowAddForm(false);
						} else {
							throw new Error("createCryptoAsset returned no asset");
						}
					} catch (error) {
						const msg =
							error instanceof Error ? error.message : "Failed to add crypto. Please try again.";
						toast.error(msg);
						throw error;
					}
				}}
			/>
			<AddWalletDialog
				open={showAddWalletDialog}
				onOpenChange={setShowAddWalletDialog}
				portfolioId={currentPortfolio}
				onSuccess={() => {
					void refetchWalletAccounts();
					void refetch();
				}}
			/>
			<SetCostBasisDialog
				target={costBasisTarget}
				onClose={() => setCostBasisTarget(null)}
				onSave={async (purchasePrice, purchaseDate) => {
					if (!costBasisTarget || !currentPortfolio) return;
					if (costBasisTarget.balanceId) {
						await setWalletBalanceCostBasis({
							variables: {
								balanceId: costBasisTarget.balanceId,
								costBasisPerUnit: purchasePrice,
								currency: "USD",
							},
						});
						await refetchWalletAccounts();
					} else {
						await updateAsset({
							id: costBasisTarget.id,
							purchasePrice,
							purchaseDate,
						});
						await refetch();
					}
				}}
				onReset={
					costBasisTarget?.balanceId
						? async () => {
								await resetWalletBalanceCostBasis({
									variables: {
										balanceId: costBasisTarget.balanceId,
									},
								});
								await refetchWalletAccounts();
							}
						: undefined
				}
				formatCurrency={formatCurrency}
			/>

			<AssignDeviceDialog
				target={assignDeviceTarget}
				devices={walletDevices}
				onClose={() => setAssignDeviceTarget(null)}
				onAssign={async (walletAccountId, deviceId) => {
					await assignWalletDeviceMutation({
						variables: {
							walletAccountId,
							deviceId,
						},
					});
					await refetchWalletAccounts();
					await refetch?.();
				}}
			/>

			<ConfirmationDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleteTarget(null);
				}}
				title="Delete position?"
				description={
					deleteTarget
						? `Remove ${deleteTarget.symbol} (${deleteTarget.cryptoName}) from your portfolio. This action cannot be undone.`
						: "This action cannot be undone."
				}
				confirmText={isDeleting ? "Deleting..." : "Delete"}
				cancelText="Cancel"
				variant="destructive"
				onConfirm={() => {
					if (!isDeleting) {
						void handleDelete();
					}
				}}
			/>
			<Dialog open={editTarget !== null} onOpenChange={(open) => !open && closeEditDialog()}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit position</DialogTitle>
						<DialogDescription>
							{editTarget ? `${editTarget.symbol} · ${editTarget.cryptoName}` : ""}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label htmlFor="edit-quantity">Quantity</Label>
							<Input
								id="edit-quantity"
								type="number"
								min="0"
								step="any"
								value={editQuantity}
								onChange={(event) => setEditQuantity(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-average-buy-price">Average Buy Price</Label>
							<Input
								id="edit-average-buy-price"
								type="number"
								min="0"
								step="any"
								value={editAverageBuyPrice}
								onChange={(event) => setEditAverageBuyPrice(event.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeEditDialog} disabled={isSavingEdit}>
							Cancel
						</Button>
						<Button onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
							{isSavingEdit ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog
				open={editTransactionTarget !== null}
				onOpenChange={(open) => !open && closeTransactionEditDialog()}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit Transaction</DialogTitle>
						<DialogDescription>Update this transaction individually.</DialogDescription>
					</DialogHeader>
					{editTransactionTarget && (
						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<Label htmlFor="tx-edit-quantity">Quantity</Label>
								<Input
									id="tx-edit-quantity"
									type="number"
									min="0"
									step="any"
									value={editTransactionTarget.quantity}
									onChange={(event) =>
										setEditTransactionTarget((prev) =>
											prev ? { ...prev, quantity: event.target.value } : prev,
										)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="tx-edit-unit-price">Unit Price</Label>
								<Input
									id="tx-edit-unit-price"
									type="number"
									min="0"
									step="any"
									value={editTransactionTarget.unitPriceAmount}
									onChange={(event) =>
										setEditTransactionTarget((prev) =>
											prev ? { ...prev, unitPriceAmount: event.target.value } : prev,
										)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="tx-edit-date">Execution Date</Label>
								<Input
									id="tx-edit-date"
									type="datetime-local"
									value={editTransactionTarget.executedAt}
									onChange={(event) =>
										setEditTransactionTarget((prev) =>
											prev ? { ...prev, executedAt: event.target.value } : prev,
										)
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="tx-edit-notes">Notes</Label>
								<Input
									id="tx-edit-notes"
									value={editTransactionTarget.notes}
									onChange={(event) =>
										setEditTransactionTarget((prev) =>
											prev ? { ...prev, notes: event.target.value } : prev,
										)
									}
								/>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={closeTransactionEditDialog}
							disabled={isSavingTransactionEdit}
						>
							Cancel
						</Button>
						<Button
							onClick={() => void handleSaveTransactionEdit()}
							disabled={isSavingTransactionEdit}
						>
							{isSavingTransactionEdit ? "Saving..." : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Sheet
				open={detailMode === "panel" && selectedHolding !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedHoldingId(null);
				}}
			>
				<SheetContent side="right" className="w-full p-0 sm:max-w-2xl">
					{selectedHolding && (
						<div className="flex h-full flex-col">
							<SheetHeader className="sticky top-0 z-20 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-3">
										<AssetLogo
											symbol={selectedHolding.symbol}
											name={selectedHolding.cryptoName}
											assetType="crypto"
											size="lg"
										/>
										<div className="min-w-0">
											<div className="flex min-w-0 items-baseline gap-2">
												<SheetTitle className="truncate text-left text-base">
													{selectedHolding.cryptoName}
												</SheetTitle>
												<span className="shrink-0 font-mono text-xs text-muted-foreground">
													{selectedHolding.symbol}
												</span>
											</div>
											<div className="mt-1 flex flex-wrap items-center gap-1.5">
												<Badge
													variant="outline"
													className="h-4 px-1.5 py-0 text-micro font-medium text-muted-foreground border-border/40"
												>
													{selectedHolding.accountType === "Wallet" ? "Self-custody" : "Exchange"}
												</Badge>
												<span className="max-w-40 truncate text-micro text-muted-foreground">
													{selectedHolding.accountName}
												</span>
											</div>
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<div className="text-right">
											<p className="font-mono text-lg font-semibold leading-none">
												{formatCurrency(selectedHolding.currentPrice)}
											</p>
											<p
												className={cn(
													"mt-1 flex items-center justify-end gap-1 font-mono text-xs font-semibold",
													selectedHolding.change24h >= 0 ? "text-gain" : "text-loss",
												)}
											>
												{selectedHolding.change24h >= 0 ? (
													<TrendArrowUp className="h-3 w-3" />
												) : (
													<TrendArrowDown className="h-3 w-3" />
												)}
												{selectedHolding.change24h >= 0 ? "+" : ""}
												{selectedHolding.change24h.toFixed(2)}%
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											aria-label={`Edit ${selectedHolding.symbol} position`}
											className="h-9 cursor-pointer px-2.5 text-xs"
											onClick={() => openEditDialog(selectedHolding)}
										>
											<Edit className="h-3.5 w-3.5 sm:mr-1.5" />
											<span className="hidden sm:inline">Edit</span>
										</Button>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Delete ${selectedHolding.symbol} position`}
											className="h-9 w-9 cursor-pointer text-muted-foreground hover:text-destructive"
											onClick={() => setDeleteTarget(selectedHolding)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</SheetHeader>

							<div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
								{/* Single scrolling page, no tabs: banner → performance → price → transactions → token. */}
								<div className="space-y-6">
									{/* Position banner — the holding at a glance */}
									<section
										aria-label={`${selectedHolding.symbol} position summary`}
										className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/40 bg-border/40"
									>
										<div className="bg-card p-4">
											<p className="text-xs text-muted-foreground">Balance</p>
											<p className="mt-1 font-mono text-lg font-bold tracking-tight">
												{selectedHolding.quantity.toLocaleString("en-US", {
													maximumFractionDigits: 6,
												})}{" "}
												<span className="text-sm font-semibold text-muted-foreground">
													{selectedHolding.symbol}
												</span>
											</p>
										</div>
										<div className="bg-card p-4">
											<p className="text-xs text-muted-foreground">Current value</p>
											<p className="mt-1 font-mono text-lg font-bold tracking-tight">
												{formatCurrency(selectedHolding.value)}
											</p>
										</div>
										<div className="bg-card p-4">
											<p className="text-xs text-muted-foreground">Avg. buy price</p>
											<p className="mt-1 font-mono text-lg font-bold tracking-tight">
												{selectedHolding.hasCostBasis
													? formatCurrency(selectedHolding.averageBuyPrice)
													: "--"}
											</p>
										</div>
										<div className="bg-card p-4">
											<p className="text-xs text-muted-foreground">Unrealized P&L</p>
											{selectedHolding.hasCostBasis ? (
												<>
													<p
														className={cn(
															"mt-1 flex items-center gap-1 font-mono text-lg font-bold tracking-tight",
															selectedHolding.profitLoss >= 0 ? "text-gain" : "text-loss",
														)}
													>
														{selectedHolding.profitLoss >= 0 ? (
															<TrendArrowUp className="h-3.5 w-3.5" />
														) : (
															<TrendArrowDown className="h-3.5 w-3.5" />
														)}
														{selectedHolding.profitLoss >= 0 ? "+" : ""}
														{formatCurrency(selectedHolding.profitLoss)}
													</p>
													<p className="mt-0.5 font-mono text-xs text-muted-foreground">
														{selectedHolding.profitLossPercent >= 0 ? "+" : ""}
														{selectedHolding.profitLossPercent.toFixed(2)}% all-time
													</p>
												</>
											) : (
												<>
													<p className="mt-1 font-mono text-lg font-bold tracking-tight text-muted-foreground">
														--
													</p>
													<p className="mt-0.5 text-xs text-muted-foreground">
														No purchase price recorded
													</p>
												</>
											)}
										</div>
									</section>

									{/* Performance — day and lifetime, cost basis and weight */}
									<Card className="border-border/60 bg-card/90">
										<CardHeader className="pb-2">
											<CardTitle className="text-sm">Performance</CardTitle>
										</CardHeader>
										<CardContent className="space-y-3 pt-0 text-sm">
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">24h change</span>
												<span
													className={cn(
														"flex items-center gap-1 font-mono font-semibold",
														selectedHolding.change24h >= 0 ? "text-gain" : "text-loss",
													)}
												>
													{selectedHolding.change24h >= 0 ? (
														<TrendArrowUp className="h-3 w-3" />
													) : (
														<TrendArrowDown className="h-3 w-3" />
													)}
													{selectedHolding.change24h >= 0 ? "+" : ""}
													{selectedHolding.change24h.toFixed(2)}%
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Day P&L</span>
												{(() => {
													const dayAmount = computeDayChangeAmount(
														selectedHolding.value,
														selectedHolding.change24h,
													);
													return (
														<span
															className={cn(
																"font-mono font-semibold",
																dayAmount >= 0 ? "text-gain" : "text-loss",
															)}
														>
															{dayAmount >= 0 ? "+" : ""}
															{formatCurrency(dayAmount)}
														</span>
													);
												})()}
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Cost basis</span>
												<span className="font-mono">
													{selectedHolding.hasCostBasis
														? formatCurrency(selectedHolding.cost)
														: "--"}
												</span>
											</div>
											<div className="flex items-center justify-between">
												<span className="text-muted-foreground">Share of crypto</span>
												<span className="font-mono">
													{totalValue > 0
														? ((selectedHolding.value / totalValue) * 100).toFixed(1)
														: "--"}
													%
												</span>
											</div>
										</CardContent>
									</Card>

									{/* 7-day price trace */}
									<Card className="border-border/60 bg-card/90">
										<CardHeader className="pb-2">
											<div className="flex items-baseline justify-between">
												<CardTitle className="text-sm">Price · 7d</CardTitle>
												<span className="font-mono text-xs text-muted-foreground">
													{selectedHolding.change24h >= 0 ? "+" : ""}
													{selectedHolding.change24h.toFixed(2)}% / 24h
												</span>
											</div>
										</CardHeader>
										<CardContent className="pt-0">
											{(() => {
												const data =
													selectedHolding.sparklineData.length >= 2
														? selectedHolding.sparklineData
														: [0, 0];
												const W = 300;
												const H = 72;
												const points = buildSparklinePoints(data, W, H);
												const d = sparklinePath(points);
												const last = points[points.length - 1];
												const positive = selectedHolding.change24h >= 0;
												return (
													<>
														<svg
															viewBox={`0 0 ${W} ${H}`}
															preserveAspectRatio="none"
															className="h-20 w-full"
															role="img"
															aria-label={`7-day price trend for ${selectedHolding.symbol}, ${positive ? "up" : "down"} over the last 24 hours`}
														>
															<path
																d={d}
																fill="none"
																stroke="currentColor"
																className={positive ? "text-gain" : "text-loss"}
																strokeWidth="2"
																strokeLinecap="round"
																strokeLinejoin="round"
																vectorEffect="non-scaling-stroke"
															/>
															{last && (
																<circle
																	cx={last.x}
																	cy={last.y}
																	r={2.5}
																	fill="currentColor"
																	className={positive ? "text-gain" : "text-loss"}
																/>
															)}
														</svg>
														<div className="mt-1 flex items-center justify-between font-mono text-micro text-muted-foreground">
															<span>{formatCurrency(Math.min(...data))}</span>
															<span>7d range</span>
															<span>{formatCurrency(Math.max(...data))}</span>
														</div>
													</>
												);
											})()}
										</CardContent>
									</Card>

									{/* Transactions — full ledger, newest first */}
									<section aria-label={`${selectedHolding.symbol} transactions`}>
										<Card className="border-border/60 bg-card/90">
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">
													Transactions · {selectedHoldingTransactions.length}
												</CardTitle>
											</CardHeader>
											<CardContent className="pt-0">
												{selectedHoldingTransactions.length === 0 ? (
													<p className="text-sm text-muted-foreground">
														No linked transactions found for this asset.
													</p>
												) : (
													<div className="space-y-2">
														{selectedHoldingTransactions.map((transaction) => {
															const row = transaction as Record<string, unknown>;
															const quantity = Number(row.quantity ?? 0);
															const unitPrice = Number(row.unitPriceAmount ?? 0);
															const total = Number.isFinite(quantity * unitPrice)
																? quantity * unitPrice
																: Number(row.total ?? row.amount ?? 0);
															const typeRaw =
																typeof row.transactionType === "string"
																	? row.transactionType
																	: typeof row.type === "string"
																		? row.type
																		: "unknown";
															const typeLabel = typeRaw.toLowerCase();
															return (
																<div
																	key={String(row.id ?? `${row.executedAt}-${row.quantity}`)}
																	className="rounded-md border border-border/60 p-3"
																>
																	<div className="flex items-center justify-between text-xs text-muted-foreground">
																		<span>
																			{new Date(
																				String(row.executedAt ?? Date.now()),
																			).toLocaleDateString("en-US")}
																		</span>
																		<Badge variant="outline" className="uppercase">
																			{typeLabel}
																		</Badge>
																	</div>
																	<div className="mt-2 grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<p className="text-xs text-muted-foreground">Quantity</p>
																			<p className="font-mono">
																				{Number.isFinite(quantity)
																					? quantity.toLocaleString("en-US")
																					: "--"}
																			</p>
																		</div>
																		<div>
																			<p className="text-xs text-muted-foreground">Unit Price</p>
																			<p className="font-mono">
																				{Number.isFinite(unitPrice)
																					? formatCurrency(unitPrice)
																					: "--"}
																			</p>
																		</div>
																		<div className="col-span-2">
																			<p className="text-xs text-muted-foreground">Total Amount</p>
																			<p className="font-mono">
																				{Number.isFinite(total) ? formatCurrency(total) : "--"}
																			</p>
																		</div>
																	</div>
																	<div className="mt-3 flex justify-end">
																		<Button
																			variant="outline"
																			size="sm"
																			onClick={() => openTransactionEditDialog(row)}
																		>
																			<Edit className="mr-2 h-3.5 w-3.5" />
																			Edit
																		</Button>
																	</div>
																</div>
															);
														})}
													</div>
												)}
											</CardContent>
										</Card>
									</section>

									{/* Token — custody, weight, range context */}
									<section aria-label={`${selectedHolding.symbol} token details`}>
										<Card className="border-border/60 bg-card/90">
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Token</CardTitle>
											</CardHeader>
											<CardContent className="space-y-3 pt-0 text-sm">
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Custody</span>
													<Badge
														variant="outline"
														className="h-4 px-1.5 text-micro font-medium text-muted-foreground border-border/40"
													>
														{selectedHolding.accountType === "Wallet" ? "Self-custody" : "Exchange"}
													</Badge>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Share of crypto</span>
													<span className="font-mono">
														{totalValue > 0
															? ((selectedHolding.value / totalValue) * 100).toFixed(1)
															: "--"}
														%
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Local All-Time High</span>
													<span className="font-mono">
														{formatCurrency(Math.max(...selectedHolding.sparklineData))}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">ATH Distance</span>
													{(() => {
														const localAth = Math.max(...selectedHolding.sparklineData);
														if (!Number.isFinite(localAth) || localAth <= 0)
															return <span className="font-mono text-muted-foreground">--</span>;
														const distance =
															((selectedHolding.currentPrice - localAth) / localAth) * 100;
														return (
															<span
																className={cn(
																	"flex items-center justify-end gap-1 font-mono font-semibold",
																	distance >= 0 ? "text-gain" : "text-loss",
																)}
															>
																{distance >= 0 ? (
																	<TrendArrowUp className="h-3 w-3" />
																) : (
																	<TrendArrowDown className="h-3 w-3" />
																)}
																{distance >= 0 ? "+" : ""}
																{distance.toFixed(2)}%
															</span>
														);
													})()}
												</div>
												<div className="pt-1">
													<a
														href={`https://www.coingecko.com/en/coins/${selectedHolding.symbol.toLowerCase()}`}
														target="_blank"
														rel="noreferrer"
														className="text-sm text-primary hover:underline"
													>
														View on CoinGecko
													</a>
												</div>
											</CardContent>
										</Card>
									</section>
								</div>
							</div>
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
