import { useMutation, useQuery } from "@apollo/client";
import {
	AlertCircle,
	ArrowLeft,
	Building2,
	Check,
	Coins,
	Copy,
	Pencil,
	Receipt,
	RefreshCw,
	Search,
	Trash2,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { AssetLogo } from "@/components/shared/AssetLogo";
import { SyncStatusBadge } from "@/components/sync/SyncStatusBadge";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { GET_ACCOUNT, GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_TRANSACTIONS_BY_ACCOUNT } from "@/graphql/queries/transactions";
import { useCurrency } from "@/hooks/use-currency";
import { classifyAccount } from "@/lib/account-classifier";
import {
	cleanAssetSymbolForDisplay,
	formatAssetDisplayName,
	isSyntheticCashSymbol,
} from "@/lib/format-asset-name";
import { parseTransaction } from "@/lib/transaction-cleaner";
import { cn, formatCurrency as formatCurrencyWithCode } from "@/lib/utils";
import { DeleteAccountDialog } from "./account/DeleteAccountDialog";
import { EditAccountDialog } from "./account/EditAccountDialog";

interface AccountDetailProps {
	accountId: string;
	onBack: () => void;
	onSelectAsset?: (assetId: string) => void;
}

export function AccountDetail({ accountId, onBack, onSelectAsset }: AccountDetailProps) {
	const { assets, currentPortfolio, refetch: refetchPortfolio } = usePortfolio();
	const { formatCurrency } = useCurrency();
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [hasCopiedAccountNum, setHasCopiedAccountNum] = useState(false);
	const [txLimit, setTxLimit] = useState(50);
	const [txSearch, setTxSearch] = useState("");

	const {
		data: accountQueryData,
		loading: accountLoading,
		refetch: refetchAccount,
	} = useQuery(GET_ACCOUNT, {
		variables: { id: accountId },
		skip: !accountId,
		fetchPolicy: "cache-and-network",
	});

	const { data: txData, loading: txLoading } = useQuery(GET_TRANSACTIONS_BY_ACCOUNT, {
		variables: {
			filter: { accountID: accountId },
			pagination: { limit: txLimit, offset: 0 },
		},
		skip: !accountId,
		fetchPolicy: "cache-and-network",
	});

	const [triggerSync, { loading: syncing }] = useMutation(TRIGGER_ACCOUNT_SYNC, {
		refetchQueries: currentPortfolio
			? [{ query: GET_ACCOUNTS, variables: { portfolioId: currentPortfolio } }]
			: undefined,
	});

	// Find the account in GraphQL data, with fallback to portfolio assets
	const account = useMemo(() => {
		const rawAcc = accountQueryData?.account;
		if (rawAcc) {
			const typeUpper = (rawAcc.type || "").toUpperCase();
			const type: "CEX" | "Bank" | "Broker" | "Wallet" =
				typeUpper === "CRYPTO_EXCHANGE"
					? "CEX"
					: typeUpper === "CRYPTO_WALLET"
						? "Wallet"
						: typeUpper === "BROKER"
							? "Broker"
							: "Bank";

			return {
				id: rawAcc.id,
				name: rawAcc.name,
				accountName: rawAcc.name,
				type,
				rawType: rawAcc.type,
				taxWrapper: rawAcc.taxWrapper,
				institution: rawAcc.institution || "Main Account",
				accountNumber:
					rawAcc.accountNumber || (rawAcc.institution ? rawAcc.institution : "Main Account"),
				currency: rawAcc.currency || "EUR",
				syncProvider: rawAcc.syncProvider,
				syncConnection: rawAcc.syncConnection,
				ownershipPercentage:
					typeof (rawAcc as any).ownershipPercentage === "number"
						? (rawAcc as any).ownershipPercentage
						: 100,
				coOwnerName: (rawAcc as any).coOwnerName || null,
				coOwnerUserId: (rawAcc as any).coOwnerUserId || null,
				coOwnerUser: (rawAcc as any).coOwnerUser || null,
				totalValue: rawAcc.totalValue ?? 0,
				currentValue: rawAcc.totalValue ?? 0,
				balance: rawAcc.totalValue ?? 0,
				purchasePrice: rawAcc.totalValue ?? 0,
			};
		}

		const matchFromAssets = assets.find((a) => a.id === accountId);
		if (matchFromAssets) {
			return {
				id: matchFromAssets.id,
				name: matchFromAssets.institution || matchFromAssets.name,
				accountName: matchFromAssets.account || matchFromAssets.name,
				type: "Bank" as const,
				rawType: "BANK",
				taxWrapper: "STANDARD_TAXABLE",
				institution: matchFromAssets.institution || "Main Account",
				accountNumber: matchFromAssets.accountNumber || `****${matchFromAssets.id.slice(-4)}`,
				currency: matchFromAssets.currency || "EUR",
				syncProvider: null,
				syncConnection: null,
				totalValue: matchFromAssets.currentValue || 0,
				currentValue: matchFromAssets.currentValue || 0,
				balance: matchFromAssets.currentValue || 0,
				purchasePrice: matchFromAssets.purchasePrice * matchFromAssets.quantity || 0,
			};
		}

		return null;
	}, [accountQueryData, assets, accountId]);

	// Find holdings linked to this account
	const holdings = useMemo(() => {
		if (!account) return [];
		return assets
			.filter((a) => {
				if ((a as { accountId?: string }).accountId === account.id) return true;
				if (a.account === account.name) return true;
				if (a.account === (account as { accountName?: string }).accountName) return true;
				return false;
			})
			.map((h) => {
				const currentPrice = h.currentPrice || 0;
				const quantity = h.quantity || 0;
				const value = h.value || quantity * currentPrice;
				const purchasePrice = h.purchasePrice || 0;
				const cost = purchasePrice * quantity;
				const pl = value - cost;
				const plPercent = cost > 0 ? (pl / cost) * 100 : 0;

				return {
					...h,
					value,
					cost,
					profitLoss: pl,
					profitLossPercent: plPercent,
					change24h: h.dayChangePercent ?? 0,
				};
			});
	}, [assets, account]);

	const totalValue = useMemo(() => {
		if (holdings.length > 0) {
			return holdings.reduce((sum, h) => sum + h.value, 0);
		}
		return account?.balance || account?.currentValue || 0;
	}, [holdings, account]);

	const totalCost = useMemo(() => {
		if (holdings.length > 0) {
			return holdings.reduce((sum, h) => sum + h.cost, 0);
		}
		return account?.purchasePrice || totalValue;
	}, [holdings, account, totalValue]);

	const totalProfitLoss = totalValue - totalCost;
	const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

	// Calculate cash vs invested portion
	const cashHoldings = holdings.filter(
		(h) =>
			h.type === "bank" ||
			h.type === "cash" ||
			isSyntheticCashSymbol(h.symbol) ||
			h.symbol === "CASH" ||
			h.symbol === "EUR" ||
			h.symbol === "USD",
	);
	const cashValue =
		holdings.length === 0 ? totalValue : cashHoldings.reduce((sum, h) => sum + h.value, 0);
	const investedValue = Math.max(0, totalValue - cashValue);

	// Asset breakdown distribution
	const allocationSlices = useMemo(() => {
		if (holdings.length === 0) return [];
		const sorted = [...holdings].sort((a, b) => b.value - a.value);
		const top = sorted.slice(0, 5);
		const others = sorted.slice(5);
		const othersValue = others.reduce((sum, h) => sum + h.value, 0);

		const result = top.map((h) => {
			const isCash = h.type === "cash" || h.type === "bank" || isSyntheticCashSymbol(h.symbol);
			const displayName = isCash
				? formatAssetDisplayName(h.name, h.symbol) || cleanAssetSymbolForDisplay(h.symbol) || "Cash"
				: cleanAssetSymbolForDisplay(h.symbol) || formatAssetDisplayName(h.name, h.symbol);
			return {
				name: displayName,
				value: h.value,
				percent: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
			};
		});

		if (othersValue > 0) {
			result.push({
				name: `Others (${others.length})`,
				value: othersValue,
				percent: totalValue > 0 ? (othersValue / totalValue) * 100 : 0,
			});
		}

		return result;
	}, [holdings, totalValue]);

	const handleSync = async () => {
		if (!account?.id) return;
		const toastId = toast.loading(`Synchronizing ${account.name}...`);
		try {
			await triggerSync({ variables: { accountId: account.id } });
			toast.success(`Sync started for ${account.name}`, { id: toastId });
			await refetchAccount();
			await refetchPortfolio();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to sync account";
			toast.error(msg, { id: toastId });
		}
	};

	const handleCopyNumber = (num: string) => {
		navigator.clipboard.writeText(num);
		setHasCopiedAccountNum(true);
		toast.success("Account identifier copied");
		setTimeout(() => setHasCopiedAccountNum(false), 2000);
	};

	const rawTransactions = txData?.transactions || [];

	const parsedTransactions = useMemo(() => {
		return rawTransactions.map((tx: any) => {
			const effectiveType = tx.transactionType || tx.type || "";
			const amountVal = tx.amount ?? tx.quantity * (tx.unitPriceAmount || 0);
			const cleaned = parseTransaction({
				notes: tx.notes,
				transactionType: effectiveType,
				type: effectiveType,
				amount: amountVal,
			});
			return {
				...tx,
				transactionType: effectiveType,
				type: effectiveType,
				cleaned,
				effectiveAmount: amountVal,
			};
		});
	}, [rawTransactions]);

	const filteredTransactions = useMemo(() => {
		if (!txSearch.trim()) return parsedTransactions;
		const q = txSearch.toLowerCase();
		return parsedTransactions.filter(
			(tx: any) =>
				tx.cleaned.merchant.toLowerCase().includes(q) ||
				tx.cleaned.category.label.toLowerCase().includes(q) ||
				(tx.notes && tx.notes.toLowerCase().includes(q)),
		);
	}, [parsedTransactions, txSearch]);

	if (accountLoading && !account) {
		return (
			<div className="flex flex-col space-y-6 p-6 animate-pulse" aria-busy="true">
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10 rounded-full" />
					<div className="space-y-1.5">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-3 w-48" />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Skeleton className="h-16 rounded-xl" />
					<Skeleton className="h-16 rounded-xl" />
				</div>
				<Skeleton className="h-48 rounded-xl" />
			</div>
		);
	}

	if (!account) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
				<AlertCircle className="h-10 w-10 text-muted-foreground" />
				<h2 className="text-base font-semibold">Account Not Found</h2>
				<p className="text-xs text-muted-foreground">
					This account may have been deleted or moved.
				</p>
				<Button variant="outline" size="sm" onClick={onBack}>
					Back to Accounts
				</Button>
			</div>
		);
	}

	const classification = classifyAccount({
		name: account.name,
		type: account.type,
		taxWrapper: account.taxWrapper,
		institution: account.institution,
		accountNumber: account.accountNumber,
	});

	return (
		<div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-6 text-foreground">
			{/* Sticky Header with Navigation & Actions */}
			<div className="flex items-start justify-between gap-4 border-b border-border/30 pb-4">
				<div className="flex items-start gap-3 min-w-0">
					<Button
						variant="ghost"
						size="icon"
						onClick={onBack}
						className="h-8 w-8 shrink-0 touch-target mt-0.5"
						aria-label="Back to accounts list"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-2 flex-wrap">
							<h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
								{classification.friendlyTitle}
							</h2>
							<Badge
								variant="outline"
								className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold"
							>
								{account.currency || "EUR"}
							</Badge>
							{classification.badgeLabel && (
								<Badge
									variant="secondary"
									className={cn(
										"text-[10px] uppercase font-mono px-1.5 py-0 h-4",
										classification.badgeClassName,
									)}
								>
									{classification.badgeLabel}
								</Badge>
							)}
							{(account as any).ownershipPercentage &&
								(account as any).ownershipPercentage < 100 && (
									<Badge
										variant="outline"
										className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 border-amber-500/30 text-amber-500 font-semibold bg-amber-500/10"
									>
										Quote-part: {(account as any).ownershipPercentage}%
										{(account as any).coOwnerName ? ` (avec ${(account as any).coOwnerName})` : ""}
									</Badge>
								)}
						</div>
						<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
							<span>{classification.primaryTypeLabel}</span>
							<span>•</span>
							<span>{account.institution}</span>
							{account.accountNumber && (
								<>
									<span>•</span>
									<button
										type="button"
										onClick={() => handleCopyNumber(account.accountNumber)}
										className="inline-flex items-center gap-1 font-mono hover:text-foreground cursor-pointer transition-colors"
										title="Click to copy identifier"
									>
										<span>{account.accountNumber}</span>
										{hasCopiedAccountNum ? (
											<Check className="h-3 w-3 text-gain" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</button>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Header Actions */}
				<div className="flex items-center gap-1.5 shrink-0">
					{account.syncProvider && account.syncProvider !== "MANUAL" && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleSync}
							disabled={syncing}
							className="h-8 text-xs gap-1.5 touch-target"
						>
							<RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
							<span>{syncing ? "Syncing..." : "Sync"}</span>
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowEditDialog(true)}
						className="h-8 text-xs gap-1.5 touch-target"
					>
						<Pencil className="h-3.5 w-3.5" />
						<span>Edit</span>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowDeleteDialog(true)}
						className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive touch-target"
						aria-label="Delete account"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Sync Connection Ribbon if synced */}
			{account.syncProvider && account.syncProvider !== "MANUAL" && (
				<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/50 text-xs">
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Provider:</span>
						<span className="font-semibold">{account.syncProvider}</span>
					</div>
					<SyncStatusBadge
						accountId={account.id}
						portfolioId={currentPortfolio ?? undefined}
						syncStatus={account.syncConnection?.syncStatus}
						lastSyncAt={account.syncConnection?.lastSyncAt}
						lastError={account.syncConnection?.lastError}
						provider={account.syncProvider}
						onSyncComplete={() => {
							refetchAccount();
							refetchPortfolio();
						}}
					/>
				</div>
			)}

			{/* 4-KPI Metric Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<div className="p-3.5 rounded-xl border border-border/50 bg-card">
					<span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">
						Total Value
					</span>
					<p className="text-xl font-bold font-mono tracking-tight mt-1">
						{formatCurrencyWithCode(totalValue, account.currency || "EUR")}
					</p>
					{(account as any).ownershipPercentage && (account as any).ownershipPercentage < 100 ? (
						<div className="space-y-0.5 mt-1.5 pt-1.5 border-t border-border/40 text-micro">
							<div className="flex items-center justify-between text-foreground font-medium">
								<span>Ma part ({(account as any).ownershipPercentage}%) :</span>
								<span className="font-mono">
									{formatCurrencyWithCode(
										(totalValue * (account as any).ownershipPercentage) / 100,
										account.currency || "EUR",
									)}
								</span>
							</div>
							<div className="flex items-center justify-between text-muted-foreground">
								<span>
									Part {(account as any).coOwnerName || "co-titulaire"} (
									{(100 - (account as any).ownershipPercentage).toFixed(0)}%) :
								</span>
								<span className="font-mono">
									{formatCurrencyWithCode(
										(totalValue * (100 - (account as any).ownershipPercentage)) / 100,
										account.currency || "EUR",
									)}
								</span>
							</div>
						</div>
					) : (
						<span className="text-micro text-muted-foreground">Full balance</span>
					)}
				</div>

				<div className="p-3.5 rounded-xl border border-border/50 bg-card">
					<span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">
						Liquid Cash
					</span>
					<p className="text-xl font-bold font-mono tracking-tight mt-1">
						{formatCurrencyWithCode(cashValue, account.currency || "EUR")}
					</p>
					<span className="text-micro text-muted-foreground">
						{totalValue > 0 ? `${((cashValue / totalValue) * 100).toFixed(0)}% liquid` : "—"}
					</span>
				</div>

				<div className="p-3.5 rounded-xl border border-border/50 bg-card">
					<span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">
						Invested Capital
					</span>
					<p className="text-xl font-bold font-mono tracking-tight mt-1">
						{formatCurrencyWithCode(investedValue, account.currency || "EUR")}
					</p>
					<span className="text-micro text-muted-foreground">
						{holdings.length} holding{holdings.length !== 1 ? "s" : ""}
					</span>
				</div>

				<div className="p-3.5 rounded-xl border border-border/50 bg-card">
					<span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">
						Total Return
					</span>
					<div className="flex items-center gap-1.5 mt-1">
						{totalProfitLoss >= 0 ? (
							<TrendArrowUp className="h-4 w-4 text-gain" />
						) : (
							<TrendArrowDown className="h-4 w-4 text-loss" />
						)}
						<p
							className={cn(
								"text-xl font-bold font-mono tracking-tight",
								totalProfitLoss >= 0 ? "text-gain" : "text-loss",
							)}
						>
							{totalProfitLoss >= 0 ? "+" : ""}
							{totalProfitLossPercent.toFixed(1)}%
						</p>
					</div>
					<span
						className={cn("text-micro font-mono", totalProfitLoss >= 0 ? "text-gain" : "text-loss")}
					>
						{totalProfitLoss >= 0 ? "+" : ""}
						{formatCurrencyWithCode(totalProfitLoss, account.currency || "EUR")}
					</span>
				</div>
			</div>

			{/* Asset Composition Bar (Replacing fake random chart) */}
			{allocationSlices.length > 0 && (
				<div className="space-y-3 p-4 rounded-xl border border-border/50 bg-card">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-foreground">Account Asset Allocation</span>
						<span className="text-micro text-muted-foreground">
							{holdings.length} asset{holdings.length !== 1 ? "s" : ""} held
						</span>
					</div>

					{/* Composition multi-color bar */}
					<div
						className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary/60"
						role="img"
						aria-label="Account asset breakdown"
					>
						{allocationSlices.map((slice, i) => {
							const colors = ["#117ACA", "#10b981", "#F3BA2F", "#8B5CF6", "#EC4899", "#6B7280"];
							return (
								<div
									key={slice.name}
									className="h-full transition-all"
									style={{
										width: `${slice.percent}%`,
										backgroundColor: colors[i % colors.length],
									}}
								/>
							);
						})}
					</div>

					{/* Slices legend */}
					<div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
						{allocationSlices.map((slice, i) => {
							const colors = ["#117ACA", "#10b981", "#F3BA2F", "#8B5CF6", "#EC4899", "#6B7280"];
							return (
								<div key={slice.name} className="flex items-center gap-1.5">
									<span
										className="h-2 w-2 rounded-full shrink-0"
										style={{ backgroundColor: colors[i % colors.length] }}
									/>
									<span className="font-medium text-foreground">{slice.name}</span>
									<span className="font-mono text-muted-foreground text-micro">
										{slice.percent.toFixed(1)}%
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Holdings Table for this Account */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-semibold text-foreground">Holdings & Positions</h3>
					<span className="text-micro text-muted-foreground font-mono">
						{holdings.length} total
					</span>
				</div>

				{holdings.length > 0 ? (
					<div className="rounded-xl border border-border/50 overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow className="border-border/30 hover:bg-transparent">
									<TableHead className="text-xs h-9">Instrument</TableHead>
									<TableHead className="text-xs h-9 text-right">Quantity</TableHead>
									<TableHead className="text-xs h-9 text-right">Price</TableHead>
									<TableHead className="text-xs h-9 text-right">Value</TableHead>
									<TableHead className="text-xs h-9 text-right">Return</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{holdings.map((h) => (
									<TableRow
										key={h.id}
										onClick={() => onSelectAsset?.(h.id)}
										className="border-border/20 hover:bg-muted/40 cursor-pointer"
									>
										<TableCell className="py-2.5">
											<div className="flex items-center gap-2.5">
												<AssetLogo
													symbol={h.symbol}
													name={h.name}
													assetType={h.type === "bank" ? "cash" : (h.type as any)}
													className="h-7 w-7 rounded-md shrink-0"
												/>
												<div className="min-w-0">
													<p className="font-medium text-xs truncate max-w-[140px] sm:max-w-[200px]">
														{formatAssetDisplayName(h.name, h.symbol)}
													</p>
													{cleanAssetSymbolForDisplay(h.symbol) && (
														<p className="font-mono text-micro text-muted-foreground">
															{cleanAssetSymbolForDisplay(h.symbol)}
														</p>
													)}
												</div>
											</div>
										</TableCell>
										<TableCell className="py-2.5 text-right font-mono text-xs">
											{h.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}
										</TableCell>
										<TableCell className="py-2.5 text-right font-mono text-xs">
											{formatCurrency(h.currentPrice || 0)}
										</TableCell>
										<TableCell className="py-2.5 text-right font-mono text-xs font-semibold">
											{formatCurrency(h.value)}
										</TableCell>
										<TableCell className="py-2.5 text-right font-mono text-xs">
											<span
												className={cn("font-medium", h.profitLoss >= 0 ? "text-gain" : "text-loss")}
											>
												{h.profitLoss >= 0 ? "+" : ""}
												{h.profitLossPercent.toFixed(1)}%
											</span>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/60 text-center space-y-2">
						<Wallet className="h-8 w-8 text-muted-foreground/60" />
						<p className="text-xs font-semibold text-foreground">
							No individual positions recorded
						</p>
						<p className="text-micro text-muted-foreground max-w-xs">
							This account is tracked as a single cash balance or has not yet synced individual
							asset lots.
						</p>
					</div>
				)}
			</div>

			{/* Banking & Cash Transactions Activity */}
			<div className="space-y-3 pt-2 border-t border-border/30">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<div>
						<div className="flex items-center gap-2">
							<h3 className="text-sm font-semibold text-foreground">Transaction Activity</h3>
							<span className="text-micro font-mono text-muted-foreground">
								({filteredTransactions.length})
							</span>
						</div>
						<p className="text-micro text-muted-foreground">
							Live synced cash movements & budget categorisation
						</p>
					</div>
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder="Filter merchant, category, notes..."
							value={txSearch}
							onChange={(e) => setTxSearch(e.target.value)}
							className="h-8 pl-8 text-xs bg-muted/30 border-border/50"
						/>
					</div>
				</div>

				{txLoading && rawTransactions.length === 0 ? (
					<div className="space-y-2">
						<Skeleton className="h-12 w-full rounded-lg" />
						<Skeleton className="h-12 w-full rounded-lg" />
						<Skeleton className="h-12 w-full rounded-lg" />
					</div>
				) : filteredTransactions.length > 0 ? (
					<div className="rounded-xl border border-border/40 overflow-hidden bg-card divide-y divide-border/20">
						{filteredTransactions.map((tx: any) => {
							const isPositive = tx.cleaned?.isPositive ?? false;
							const dateStr = new Date(tx.executedAt).toLocaleDateString("fr-FR", {
								day: "2-digit",
								month: "short",
								year: "numeric",
							});

							return (
								<div
									key={tx.id}
									className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3"
								>
									<div className="flex items-center gap-3 min-w-0 flex-1">
										<div
											className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border select-none"
											style={{
												backgroundColor: `${tx.cleaned.category.color}15`,
												borderColor: `${tx.cleaned.category.color}30`,
											}}
										>
											<span
												className="text-micro font-bold"
												style={{ color: tx.cleaned.category.color }}
											>
												{tx.cleaned.category.label.slice(0, 2).toUpperCase()}
											</span>
										</div>

										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2 flex-wrap">
												<span className="font-semibold text-xs text-foreground truncate max-w-[200px] sm:max-w-[320px]">
													{tx.cleaned.merchant}
												</span>
												<span
													className={cn(
														"text-micro px-1.5 py-0.5 rounded border font-medium",
														tx.cleaned.category.badgeClass,
													)}
												>
													{tx.cleaned.category.label}
												</span>
											</div>
											{tx.notes && (
												<p
													className="text-micro text-muted-foreground truncate max-w-[240px] sm:max-w-[400px] mt-0.5"
													title={tx.notes}
												>
													{tx.notes}
												</p>
											)}
										</div>
									</div>

									<div className="text-right shrink-0">
										<p
											className={cn(
												"font-mono text-xs font-semibold tracking-tight",
												isPositive ? "text-gain" : "text-foreground",
											)}
										>
											{isPositive ? "+" : "-"}
											{formatCurrencyWithCode(
												Math.abs(tx.effectiveAmount),
												account.currency || "EUR",
											)}
										</p>
										<p className="font-mono text-micro text-muted-foreground mt-0.5">{dateStr}</p>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-border/60 text-center space-y-2">
						<Receipt className="h-8 w-8 text-muted-foreground/60" />
						<p className="text-xs font-semibold text-foreground">
							{txSearch ? "No transactions match your search" : "No transactions recorded"}
						</p>
						<p className="text-micro text-muted-foreground max-w-xs">
							{txSearch
								? "Try a different search keyword."
								: "Sync this account via Enable Banking or record a movement to see cash flows here."}
						</p>
					</div>
				)}

				{rawTransactions.length >= txLimit && (
					<div className="flex justify-center pt-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setTxLimit((prev) => prev + 50)}
							className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground touch-target"
						>
							Charger plus de transactions
						</Button>
					</div>
				)}
			</div>

			{/* Edit Account Dialog */}
			<EditAccountDialog
				open={showEditDialog}
				onOpenChange={setShowEditDialog}
				account={account as any}
				portfolioId={currentPortfolio || undefined}
				onSuccess={() => {
					setShowEditDialog(false);
					refetchAccount();
					refetchPortfolio();
				}}
			/>

			{/* Delete Account Dialog */}
			<DeleteAccountDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				accountId={account.id}
				accountName={account.name}
				portfolioId={currentPortfolio || undefined}
				onSuccess={() => {
					setShowDeleteDialog(false);
					onBack();
					refetchPortfolio();
				}}
			/>
		</div>
	);
}
