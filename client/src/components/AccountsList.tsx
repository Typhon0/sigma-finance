import { useMutation, useQuery } from "@apollo/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	AlertCircle,
	ArrowUpRight,
	Building2,
	Check,
	CheckCircle2,
	ChevronDown,
	Coins,
	Copy,
	Download,
	ExternalLink,
	Eye,
	EyeOff,
	Filter,
	HardDrive,
	Layers,
	LayoutGrid,
	Link2,
	List,
	MoreVertical,
	Pencil,
	Plus,
	RefreshCw,
	SlidersHorizontal,
	Trash2,
	Wallet,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	type BasePositionItem,
	type GroupByOption,
	PositionsDataTable,
} from "@/components/assets/positions-table";
import { AssetHeroChart, buildPerformanceSeries } from "@/components/charts/AssetHeroChart";
import type { TimeRange } from "@/components/charts/PortfolioHeroChart";
import { type PortfolioAssetItem, usePortfolio } from "@/components/PortfolioProvider";
import { AssetLogo } from "@/components/shared/AssetLogo";
import { SearchInput } from "@/components/ui/search-input";
import { AddWalletDialog, DeFiReviewQueueBanner } from "@/features/wallets";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_WALLET_ACCOUNTS } from "@/graphql/queries/wallets";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { useAssetMutations } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import { classifyAccount } from "@/lib/account-classifier";
import { cn, formatCurrency as formatCurrencyWithCode } from "@/lib/utils";
import { AccountDetail } from "./AccountDetail";
import {
	AccountsExposureWidget,
	type CustodyCategoryKey,
	type CustodySlice,
} from "./account/AccountsExposureWidget";
import { AddAccountChooserDialog } from "./account/AddAccountChooserDialog";
import { CreateAccountDialog } from "./account/CreateAccountDialog";
import { DeleteAccountDialog } from "./account/DeleteAccountDialog";
import { EditAccountDialog } from "./account/EditAccountDialog";
import { AssetPageHeader } from "./assets/AssetPageHeader";
import { AddSavingForm, type SavingsFormData } from "./assets/savings/AddSavingForm";
import { ConnectInstitutionDialog } from "./sync/ConnectInstitutionDialog";
import { SyncStatusBadge } from "./sync/SyncStatusBadge";
import { TrendArrowDown, TrendArrowUp } from "./TrendArrows";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import ErrorBoundary from "./ui/error-boundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface AccountsListProps {
	onSelectAccount: (accountId: string) => void;
}

type ViewMode = "table" | "cards";
type AccountType = "all" | "Wallet" | "CEX" | "Bank" | "Broker";
type TableDensity = "compact" | "normal";

const FX_RATES_TO_EUR: Record<string, number> = {
	EUR: 1.0,
	USD: 0.89,
	JPY: 0.0056,
	INR: 0.0094,
	CHF: 1.09,
	CNY: 0.13,
	HUF: 0.0027,
	TRY: 0.027,
	GBP: 1.17,
};

function formatAccountNumber(accountNumber: string | null | undefined): string {
	if (!accountNumber) return "";
	if (accountNumber.length > 20 && accountNumber.includes("-")) {
		return `${accountNumber.slice(0, 8)}...${accountNumber.slice(-4)}`;
	}
	if (accountNumber.length > 24) {
		return `${accountNumber.slice(0, 6)}...${accountNumber.slice(-4)}`;
	}
	return accountNumber;
}

export interface AccountData {
	id: string;
	name: string;
	type: "Wallet" | "CEX" | "Bank" | "Broker";
	taxWrapper?: string;
	assetClass: string;
	totalValue: number;
	totalCost: number;
	profitLoss: number;
	profitLossPercent: number;
	accountNumber: string;
	institution?: string | null;
	currency?: string | null;
	ownershipPercentage?: number | null;
	coOwnerName?: string | null;
	coOwnerUserId?: string | null;
	color: string;
	symbol?: string;
	dayChange?: number;
	dayChangePercent?: number;
	syncProvider?: string;
	syncConnection?: {
		id: string;
		provider: string;
		syncStatus: string;
		lastSyncAt?: string | null;
		lastError?: string | null;
	} | null;
}

const ACCOUNT_TYPE_COLORS: Record<AccountData["type"], string> = {
	Wallet: "#8B5CF6",
	CEX: "#F3BA2F",
	Bank: "#117ACA",
	Broker: "#C52328",
};

const BANK_ACCOUNT_ASSET_TYPE_ID = "3";

export function AccountsList({ onSelectAccount }: AccountsListProps) {
	const shouldReduceMotion = useReducedMotion();
	const { assets, currentPortfolio, selectedPortfolio, refetch, getPortfolioValue } =
		usePortfolio();
	const portfolioId =
		(typeof currentPortfolio === "string" ? currentPortfolio : currentPortfolio?.id) ||
		selectedPortfolio?.id ||
		"";

	const { addBankAccount } = useAssetMutations();
	const { formatCurrency, currencySymbol: _currencySymbol } = useCurrency();

	// View & Filter states
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"accounts" | "holdings">("accounts");
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	const [density, setDensity] = useState<TableDensity>(() => {
		try {
			const saved = localStorage.getItem("sf_accounts_table_density");
			return saved === "normal" ? "normal" : "compact";
		} catch {
			return "compact";
		}
	});

	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<AccountType>("all");
	const [sortBy, setSortBy] = useState("value-desc");
	const [hideEmptyAccounts, setHideEmptyAccounts] = useState(true);
	const [activeCustodyFilter, setActiveCustodyFilter] = useState<CustodyCategoryKey | null>(null);

	// Modals & Dialogs state
	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
	const [showAddChooser, setShowAddChooser] = useState(false);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
	const [showConnectInstitution, setShowConnectInstitution] = useState(false);
	const [showAddWalletDialog, setShowAddWalletDialog] = useState(false);
	const [accountToEdit, setAccountToEdit] = useState<AccountData | null>(null);
	const [accountToDelete, setAccountToDelete] = useState<AccountData | null>(null);
	const [isSyncingAll, setIsSyncingAll] = useState(false);
	const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

	// Query Accounts from server
	const {
		data: accountsData,
		loading: accountsLoading,
		refetch: refetchAccounts,
		startPolling: startAccountsPolling,
		stopPolling: stopAccountsPolling,
	} = useQuery(GET_ACCOUNTS, {
		variables: { portfolioId },
		skip: !portfolioId,
		fetchPolicy: "cache-and-network",
	});

	// Watch wallet accounts to detect in-progress syncs
	const {
		data: walletAccountsData,
		refetch: refetchWalletAccounts,
		startPolling: startWalletPolling,
		stopPolling: stopWalletPolling,
	} = useQuery(GET_WALLET_ACCOUNTS, {
		variables: { portfolioId },
		skip: !portfolioId,
		fetchPolicy: "cache-and-network",
	});

	const isAnyAccountSyncing = useMemo(() => {
		const connSyncing = accountsData?.accounts?.some(
			(a: any) => a.syncConnection?.syncStatus === "SYNCING",
		);
		const walletSyncing = walletAccountsData?.walletAccounts?.some(
			(w: any) => w.historyStatus === "IN_PROGRESS" || w.historyStatus === "PENDING",
		);
		return Boolean(connSyncing || walletSyncing);
	}, [accountsData, walletAccountsData]);

	useEffect(() => {
		if (isAnyAccountSyncing) {
			startAccountsPolling?.(2500);
			startWalletPolling?.(2500);
			return () => {
				stopAccountsPolling?.();
				stopWalletPolling?.();
			};
		} else {
			stopAccountsPolling?.();
			stopWalletPolling?.();
		}
	}, [isAnyAccountSyncing, startAccountsPolling, stopAccountsPolling, startWalletPolling, stopWalletPolling]);

	// Query Scoped Performance History for Hero Chart
	const { data: scopedHistoryData, loading: scopedHistoryLoading } = useQuery(
		GET_SCOPED_PERFORMANCE_HISTORY,
		{
			variables: {
				portfolioID: portfolioId,
				assetTypes: ["BANK", "SAVINGS"],
			},
			skip: !portfolioId,
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
		},
	);

	const [triggerSync] = useMutation(TRIGGER_ACCOUNT_SYNC, {
		refetchQueries: portfolioId ? [{ query: GET_ACCOUNTS, variables: { portfolioId } }] : undefined,
	});

	const handleToggleDensity = () => {
		const next = density === "compact" ? "normal" : "compact";
		setDensity(next);
		try {
			localStorage.setItem("sf_accounts_table_density", next);
		} catch {
			// ignore storage errors
		}
	};

	const handleTriggerSync = async (accountId: string, accountName: string) => {
		const toastId = toast.loading(`Triggering sync for ${accountName}...`);
		try {
			await triggerSync({ variables: { accountId } });
			toast.success(`Sync started for ${accountName}`, { id: toastId });
			await refetch();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to trigger sync";
			toast.error(msg, { id: toastId });
		}
	};

	const handleAddAccount = async (data: SavingsFormData) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addBankAccount({
				portfolioId: typeof currentPortfolio === "string" ? currentPortfolio : currentPortfolio.id,
				assetTypeID: BANK_ACCOUNT_ASSET_TYPE_ID,
				name: data.accountName,
				institution: data.bankName,
				accountType: data.accountType,
				accountNumber: data.accountNumber,
				currency: data.currency || "USD",
				currentValue: Number.parseFloat(data.balance) || 0,
				interestRate: data.interestRate ? Number.parseFloat(data.interestRate) : undefined,
			});

			if (result.asset) {
				toast.success("Account added successfully");
				await refetch();
			} else {
				throw new Error("createBankAccountAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add account. Please try again.");
			throw error;
		}
	};

	// Map accounts from server accounts or fallback to portfolio assets
	const accounts = useMemo((): AccountData[] => {
		const serverAccounts = accountsData?.accounts;
		if (serverAccounts && serverAccounts.length > 0) {
			return serverAccounts.map(
				(a: {
					id: string;
					name: string;
					type: "BROKER" | "BANK" | "CRYPTO_EXCHANGE" | "CRYPTO_WALLET" | "OTHER";
					taxWrapper?: string;
					institution?: string | null;
					accountNumber?: string | null;
					totalValue?: number | null;
					ownershipPercentage?: number | null;
					coOwnerName?: string | null;
					coOwnerUserId?: string | null;
					syncProvider?: string | null;
					syncConnection?: {
						id: string;
						provider: string;
						syncStatus: string;
						lastSyncAt?: string | null;
						lastError?: string | null;
					} | null;
				}) => {
					const type: AccountData["type"] =
						a.type === "CRYPTO_WALLET"
							? "Wallet"
							: a.type === "CRYPTO_EXCHANGE"
								? "CEX"
								: a.type === "BROKER"
									? "Broker"
									: "Bank";
					const assetClass =
						type === "Wallet" || type === "CEX" ? "Crypto" : type === "Bank" ? "Cash" : "Stocks";
					const totalVal = a.totalValue ?? 0;

					return {
						id: a.id,
						name: a.name,
						type,
						taxWrapper: a.taxWrapper,
						assetClass,
						totalValue: totalVal,
						totalCost: totalVal,
						profitLoss: 0,
						profitLossPercent: 0,
						accountNumber: a.accountNumber || (a.institution ? a.institution : "Main Account"),
						institution: a.institution,
						currency: (a as { currency?: string | null }).currency || "EUR",
						ownershipPercentage:
							typeof a.ownershipPercentage === "number" ? a.ownershipPercentage : 100,
						coOwnerName: a.coOwnerName || null,
						coOwnerUserId: a.coOwnerUserId || null,
						color: ACCOUNT_TYPE_COLORS[type],
						syncProvider: a.syncProvider,
						syncConnection: a.syncConnection,
					};
				},
			);
		}

		return assets.map((a) => {
			const type: AccountData["type"] =
				a.type === "crypto"
					? /wallet|ledger|trezor|metamask|phantom/i.test(a.institution || a.name || "")
						? "Wallet"
						: "CEX"
					: a.type === "stock" || a.type === "fund"
						? "Broker"
						: "Bank";

			const totalCost = (a.purchasePrice || 0) * (a.quantity || 1);
			const profitLoss = (a.currentValue || 0) - totalCost;
			const profitLossPercent = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
			const assetClass = type === "CEX" ? "Crypto" : type === "Bank" ? "Cash" : "Stocks";

			return {
				id: a.id,
				name: a.institution || a.name,
				type,
				taxWrapper: "STANDARD_TAXABLE",
				assetClass,
				totalValue: a.currentValue || 0,
				totalCost,
				profitLoss,
				profitLossPercent,
				accountNumber: a.accountNumber || `****${a.id.slice(-4)}`,
				color: ACCOUNT_TYPE_COLORS[type],
				symbol: a.symbol,
				dayChange: a.dayChange,
				dayChangePercent: a.dayChangePercent,
			};
		});
	}, [accountsData, assets]);

	const getAccountEurValue = useCallback(
		(acc: AccountData) => {
			if (acc.currency === "EUR") return acc.totalValue;
			const linkedAssets = assets.filter((a) => a.accountId === acc.id);
			const eurFromAssets = linkedAssets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
			if (eurFromAssets > 0) return eurFromAssets;
			const rate = FX_RATES_TO_EUR[acc.currency || "EUR"] ?? 1.0;
			return acc.totalValue * rate;
		},
		[assets],
	);

	// Total Portfolio Net Worth
	const totalPortfolioValue = useMemo(() => {
		const pv = typeof getPortfolioValue === "function" ? getPortfolioValue() : 0;
		if (pv > 0) return pv;
		return accounts.reduce((sum, acc) => sum + getAccountEurValue(acc), 0);
	}, [accounts, getPortfolioValue, getAccountEurValue]);

	// Liquid Cash & Bank Reserves (Hero Chart Metric)
	const liquidCashValue = useMemo(() => {
		const bankAndCashAccounts = accounts.filter((a) => {
			const info = classifyAccount({
				name: a.name,
				type: a.type,
				taxWrapper: a.taxWrapper,
				institution: a.institution,
			});
			return a.type === "Bank" || info.category.startsWith("BANK_") || a.assetClass === "Cash";
		});
		return bankAndCashAccounts.reduce((sum, acc) => sum + getAccountEurValue(acc), 0);
	}, [accounts, getAccountEurValue]);

	// Performance Series for Hero Chart (Liquid Cash Focus)
	const performanceData = useMemo(() => {
		return buildPerformanceSeries(
			scopedHistoryData?.scopedPerformanceHistory ?? [],
			liquidCashValue,
		);
	}, [scopedHistoryData, liquidCashValue]);

	// Chart sparklines mapped from accounts
	const chartHoldings = useMemo(() => {
		return accounts.map((acc) => ({
			value: acc.totalValue,
			currentPrice: acc.totalValue,
			changePercent: acc.dayChangePercent ?? 0,
			sparklineData: undefined,
		}));
	}, [accounts]);

	// Custody Slices for Exposure Brief
	const custodySlices = useMemo((): CustodySlice[] => {
		const banks: AccountData[] = [];
		const savings: AccountData[] = [];
		const brokerages: AccountData[] = [];
		const exchanges: AccountData[] = [];
		const wallets: AccountData[] = [];

		for (const acc of accounts) {
			const info = classifyAccount({
				name: acc.name,
				type: acc.type,
				taxWrapper: acc.taxWrapper,
				institution: acc.institution,
			});

			if (acc.type === "Wallet" || info.category.startsWith("WALLET_")) {
				wallets.push(acc);
			} else if (acc.type === "CEX" || info.category === "CEX_SPOT") {
				exchanges.push(acc);
			} else if (acc.type === "Broker" || info.category.startsWith("BROKER_")) {
				brokerages.push(acc);
			} else if (info.isVault || /livret|epargne|savings/i.test(acc.name)) {
				savings.push(acc);
			} else {
				banks.push(acc);
			}
		}

		const total = totalPortfolioValue > 0 ? totalPortfolioValue : 1;

		const calcSlice = (
			key: CustodyCategoryKey,
			label: string,
			color: string,
			list: AccountData[],
		): CustodySlice => {
			const val = list.reduce((sum, a) => sum + getAccountEurValue(a), 0);
			return {
				key,
				label,
				color,
				count: list.length,
				value: val,
				percent: (val / total) * 100,
			};
		};

		return [
			calcSlice("banks", "Banks & Checking", "#117ACA", banks),
			calcSlice("savings", "Savings & Vaults", "#10b981", savings),
			calcSlice("brokerages", "Brokerages & TradFi", "#C52328", brokerages),
			calcSlice("exchanges", "Crypto Exchanges", "#F3BA2F", exchanges),
			calcSlice("wallets", "Self-Custody Wallets", "#8B5CF6", wallets),
		];
	}, [accounts, totalPortfolioValue, getAccountEurValue]);

	// Currency breakdown (filtered to currencies with real balances > 0)
	const currencyBreakdown = useMemo(() => {
		const map = new Map<string, number>();
		for (const acc of accounts) {
			const curr = acc.currency || "EUR";
			const val = getAccountEurValue(acc);
			if (val > 0) {
				map.set(curr, (map.get(curr) || 0) + val);
			}
		}
		const total = totalPortfolioValue > 0 ? totalPortfolioValue : 1;
		return Array.from(map.entries())
			.map(([curr, val]) => ({
				currency: curr,
				value: val,
				percent: (val / total) * 100,
			}))
			.filter((c) => c.percent >= 0.5 || c.value > 0)
			.sort((a, b) => b.value - a.value);
	}, [accounts, totalPortfolioValue, getAccountEurValue]);

	// Synced accounts list & last sync time
	const syncedAccounts = useMemo(() => {
		return accounts.filter((a) => a.syncProvider && a.syncProvider !== "MANUAL");
	}, [accounts]);

	const lastSyncTime = useMemo(() => {
		const timestamps = syncedAccounts
			.map((a) => a.syncConnection?.lastSyncAt)
			.filter(Boolean)
			.sort()
			.reverse();
		return timestamps[0]
			? new Date(timestamps[0]).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			: null;
	}, [syncedAccounts]);

	const handleSyncAll = async () => {
		if (syncedAccounts.length === 0) return;
		setIsSyncingAll(true);
		const toastId = toast.loading("Syncing all connected accounts...");
		try {
			await Promise.all(syncedAccounts.map((a) => triggerSync({ variables: { accountId: a.id } })));
			toast.success("All accounts synced successfully", { id: toastId });
			await refetch();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Sync partially failed";
			toast.error(msg, { id: toastId });
		} finally {
			setIsSyncingAll(false);
		}
	};

	const handleCopyAccountNumber = (id: string, num: string) => {
		navigator.clipboard.writeText(num);
		setCopiedAccountId(id);
		toast.success("Account identifier copied");
		setTimeout(() => setCopiedAccountId(null), 2000);
	};

	// Filter & Sort accounts
	const filteredAccounts = useMemo(() => {
		return accounts.filter((acc) => {
			if (hideEmptyAccounts && (acc.totalValue ?? 0) === 0) return false;
			if (filterType !== "all" && acc.type !== filterType) return false;

			// Cross-filter from custody brief
			if (activeCustodyFilter) {
				const info = classifyAccount({
					name: acc.name,
					type: acc.type,
					taxWrapper: acc.taxWrapper,
					institution: acc.institution,
				});

				if (
					activeCustodyFilter === "wallets" &&
					acc.type !== "Wallet" &&
					!info.category.startsWith("WALLET_")
				)
					return false;
				if (
					activeCustodyFilter === "exchanges" &&
					acc.type !== "CEX" &&
					info.category !== "CEX_SPOT"
				)
					return false;
				if (
					activeCustodyFilter === "brokerages" &&
					acc.type !== "Broker" &&
					!info.category.startsWith("BROKER_")
				)
					return false;
				if (
					activeCustodyFilter === "savings" &&
					!info.isVault &&
					!/livret|epargne|savings/i.test(acc.name)
				)
					return false;
				if (activeCustodyFilter === "banks") {
					if (acc.type !== "Bank" && !info.category.startsWith("BANK_")) return false;
					if (info.isVault || /livret|epargne|savings/i.test(acc.name)) return false;
				}
			}

			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					acc.name.toLowerCase().includes(query) ||
					acc.accountNumber.toLowerCase().includes(query) ||
					acc.assetClass.toLowerCase().includes(query) ||
					(acc.institution || "").toLowerCase().includes(query)
				);
			}
			return true;
		});
	}, [accounts, hideEmptyAccounts, filterType, activeCustodyFilter, searchQuery]);

	// Sort filtered accounts
	const sortedAccounts = useMemo(() => {
		const list = [...filteredAccounts];
		if (sortBy === "value-desc") list.sort((a, b) => b.totalValue - a.totalValue);
		else if (sortBy === "value-asc") list.sort((a, b) => a.totalValue - b.totalValue);
		else if (sortBy === "profit-desc") list.sort((a, b) => b.profitLoss - a.profitLoss);
		else if (sortBy === "profit-asc") list.sort((a, b) => a.profitLoss - b.profitLoss);
		else if (sortBy === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
		return list;
	}, [filteredAccounts, sortBy]);

	// Active cross-filter stats
	const activeFilterStats = useMemo(() => {
		if (!activeCustodyFilter) return null;
		const match = custodySlices.find((s) => s.key === activeCustodyFilter);
		if (!match) return null;
		return match;
	}, [activeCustodyFilter, custodySlices]);

	// Grouped positions for Tab 2: Holdings by Account
	interface AccountPositionItem extends BasePositionItem {
		assetClass: string;
		accountType: string;
	}

	const holdingsPositions = useMemo((): AccountPositionItem[] => {
		return assets.map((a) => {
			const purchase = a.purchasePrice || 0;
			const qty = a.quantity || 1;
			const cost = purchase * qty;
			const val = a.currentValue || (a.currentPrice || 0) * qty;
			const pl = val - cost;
			const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
			const accountName = a.account || a.institution || "Main Account";

			return {
				id: a.id,
				name: a.name,
				symbol: a.symbol || a.name.slice(0, 4).toUpperCase(),
				account: accountName,
				accountType: a.type || "securities",
				quantity: qty,
				currentPrice: a.currentPrice || (qty > 0 ? val / qty : 0),
				dayChange: a.dayChangePercent ?? 0,
				value: val,
				avgPrice: purchase,
				cost,
				pl,
				plPercent,
				weight: totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0,
				assetClass: a.type || "Asset",
			};
		});
	}, [assets, totalPortfolioValue]);

	const [holdingsGroupBy, setHoldingsGroupBy] = useState<string>("account");
	const holdingsGroupByOptions: GroupByOption<AccountPositionItem>[] = [
		{
			id: "account",
			label: "Group by Account",
			icon: Wallet,
			getGroupKey: (item) => item.account,
			isClickableAccount: true,
		},
		{
			id: "none",
			label: "No Grouping",
			icon: List,
			getGroupKey: () => "All Holdings",
		},
	];

	const AccountTypeIcon = ({ type }: { type: string }) => {
		if (type === "CEX") return <Building2 className="h-4 w-4" />;
		if (type === "Broker") return <Coins className="h-4 w-4" />;
		if (type === "Wallet") return <Wallet className="h-4 w-4" />;
		return <Wallet className="h-4 w-4" />;
	};

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			{/* Canonical Page Header */}
			<AssetPageHeader
				title="Accounts & Custody"
				description="Manage bank accounts, brokerages, crypto wallets, and custody envelopes across your portfolios."
				actions={
					<div className="flex items-center gap-2 flex-wrap">
						{syncedAccounts.length > 0 && (
							<>
								<div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40 text-micro font-mono text-muted-foreground">
									<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
									<span>
										{syncedAccounts.length} synced
										{lastSyncTime ? ` • ${lastSyncTime}` : ""}
									</span>
								</div>

								<Button
									variant="outline"
									size="sm"
									className="h-8 text-xs gap-1.5 border-border/50 touch-target"
									onClick={handleSyncAll}
									disabled={isSyncingAll}
									title="Sync all connected accounts"
								>
									<RefreshCw className={cn("h-3.5 w-3.5", isSyncingAll && "animate-spin")} />
									<span className="hidden md:inline">Sync All</span>
								</Button>

								<Button
									variant="outline"
									size="icon"
									className="h-8 w-8 border-border/50 text-muted-foreground hover:text-foreground touch-target"
									onClick={() => {
										window.location.href = "/settings/connections";
									}}
									title="Manage Connections"
								>
									<Link2 className="h-3.5 w-3.5" />
								</Button>
							</>
						)}

						<Button
							size="sm"
							onClick={() => setShowAddChooser(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Account
						</Button>
					</div>
				}
			/>

			{/* DeFi Review Queue Banner if pending */}
			{portfolioId && (
				<div className="space-y-4">
					<DeFiReviewQueueBanner portfolioId={portfolioId} />
				</div>
			)}

			{/* 70/30 Hero Section: Liquid Cash Chart (70%) + Custody Exposure Brief (30%) */}
			<div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
				{/* Left 70%: Liquid Cash & Bank Reserves Hero Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AssetHeroChart
							title="Liquid Cash & Bank Reserves"
							titleTooltip="Aggregated valuation of cash balances, checking accounts, and liquid bank deposits"
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={liquidCashValue}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={portfolioId}
							loading={scopedHistoryLoading && accounts.length === 0}
							defaultBenchmark="none"
							layoutId="accountsHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>

				{/* Right 30%: Custody Split & Exposure Brief */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AccountsExposureWidget
							totalCashValue={liquidCashValue}
							totalPortfolioValue={totalPortfolioValue}
							slices={custodySlices}
							activeFilter={activeCustodyFilter}
							onSelectCategory={setActiveCustodyFilter}
							formatCurrency={formatCurrency}
							currencyBreakdown={currencyBreakdown}
							loading={accountsLoading && accounts.length === 0}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{activeFilterStats && (
				<motion.div
					key="custody-cross-filter-banner"
					data-testid="cross-filter-banner"
					initial={shouldReduceMotion ? false : { opacity: 0, y: -6, scale: 0.99 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
					className="overflow-hidden"
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-xs shadow-xs mb-1">
						<div className="flex items-center gap-2.5 flex-wrap">
							<span
								className="h-2 w-2 rounded-full animate-pulse"
								style={{ backgroundColor: activeFilterStats.color }}
							/>
							<span className="font-semibold text-foreground">Filtered by Custody:</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{activeFilterStats.label}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} account{activeFilterStats.count !== 1 ? "s" : ""} •{" "}
								{formatCurrency(activeFilterStats.value)} • {activeFilterStats.percent.toFixed(1)}%
								of portfolio)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const el = document.getElementById("accounts-workspace-section");
									el?.scrollIntoView({ behavior: "smooth" });
								}}
								className="h-7 text-xs bg-background/80 hover:bg-background border-border/60 gap-1.5 cursor-pointer touch-target"
							>
								<span>Jump to Accounts</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setActiveCustodyFilter(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Mode Navigation & View Switcher */}
			<div id="accounts-workspace-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-1">
					<div
						className="relative flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Accounts workspace view"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeWorkspaceTab === "accounts"}
							onClick={() => setActiveWorkspaceTab("accounts")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeWorkspaceTab === "accounts"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeWorkspaceTab === "accounts" && (
								<motion.span
									layoutId="accountsActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Accounts Ledger</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{filteredAccounts.length}
							</span>
						</button>

						<button
							type="button"
							role="tab"
							aria-selected={activeWorkspaceTab === "holdings"}
							onClick={() => setActiveWorkspaceTab("holdings")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeWorkspaceTab === "holdings"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeWorkspaceTab === "holdings" && (
								<motion.span
									layoutId="accountsActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Holdings by Account</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{holdingsPositions.length}
							</span>
						</button>
					</div>

					{/* Density toggle for table view */}
					{activeWorkspaceTab === "accounts" && viewMode === "table" && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleToggleDensity}
							className="h-8 text-xs gap-1.5 border-border/50 hidden sm:flex touch-target"
						>
							<SlidersHorizontal className="h-3.5 w-3.5" />
							<span>{density === "compact" ? "Compact" : "Normal"}</span>
						</Button>
					)}
				</div>

				{/* Tab 1: Accounts Ledger */}
				{activeWorkspaceTab === "accounts" && (
					<div className="space-y-4">
						{/* Accounts Filter Toolbar */}
						<div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
							<div className="flex flex-1 items-center gap-2">
								<SearchInput
									placeholder="Search accounts or IBAN..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onClear={() => setSearchQuery("")}
									containerClassName="max-w-xs flex-1"
								/>

								<Select value={filterType} onValueChange={(v) => setFilterType(v as AccountType)}>
									<SelectTrigger className="w-[130px] h-9 text-xs border-border/50">
										<SelectValue placeholder="All Types" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Types</SelectItem>
										<SelectItem value="Bank">Banks</SelectItem>
										<SelectItem value="Broker">Brokers</SelectItem>
										<SelectItem value="CEX">Exchanges</SelectItem>
										<SelectItem value="Wallet">Wallets</SelectItem>
									</SelectContent>
								</Select>

								<Select value={sortBy} onValueChange={setSortBy}>
									<SelectTrigger className="w-[140px] h-9 text-xs border-border/50">
										<SelectValue placeholder="Sort" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="value-desc">Value (High to Low)</SelectItem>
										<SelectItem value="value-asc">Value (Low to High)</SelectItem>
										<SelectItem value="profit-desc">P&L (High to Low)</SelectItem>
										<SelectItem value="profit-asc">P&L (Low to High)</SelectItem>
										<SelectItem value="name-asc">Name (A-Z)</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center gap-2 justify-end">
								{/* Hide $0 accounts toggle */}
								<Button
									variant={hideEmptyAccounts ? "secondary" : "outline"}
									size="sm"
									onClick={() => setHideEmptyAccounts(!hideEmptyAccounts)}
									className="gap-1.5 text-xs h-9 border-border/50 touch-target"
								>
									{hideEmptyAccounts ? (
										<EyeOff className="h-3.5 w-3.5" />
									) : (
										<Eye className="h-3.5 w-3.5" />
									)}
									<span className="hidden md:inline">
										{hideEmptyAccounts ? "Active Only" : "Show Empty"}
									</span>
								</Button>

								{/* Table vs Cards Toggle */}
								<div className="flex border border-border/60 rounded-lg p-0.5 bg-muted/40">
									<Button
										variant={viewMode === "table" ? "default" : "ghost"}
										size="sm"
										onClick={() => setViewMode("table")}
										className="h-8 px-2.5 rounded-md"
										aria-label="Table view"
									>
										<List className="h-4 w-4" />
									</Button>
									<Button
										variant={viewMode === "cards" ? "default" : "ghost"}
										size="sm"
										onClick={() => setViewMode("cards")}
										className="h-8 px-2.5 rounded-md"
										aria-label="Cards view"
									>
										<LayoutGrid className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>

						{/* Content: Table View */}
						{viewMode === "table" && (
							<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
								<Table>
									<TableHeader>
										<TableRow className="border-border/30 hover:bg-transparent">
											<TableHead className="text-xs h-9">Account & Entity</TableHead>
											<TableHead className="text-xs h-9">Custody & Type</TableHead>
											<TableHead className="text-xs h-9">Currency & Sync</TableHead>
											<TableHead className="text-xs h-9 text-right">Total Value</TableHead>
											<TableHead className="text-xs h-9 text-right">P&L</TableHead>
											<TableHead className="text-xs h-9 text-right">Return</TableHead>
											<TableHead className="text-xs h-9 text-right">Weight</TableHead>
											<TableHead className="text-xs h-9 text-right pr-4">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{sortedAccounts.length > 0 ? (
											sortedAccounts.map((account) => {
												const classification = classifyAccount(account);
												const weight =
													totalPortfolioValue > 0
														? (account.totalValue / totalPortfolioValue) * 100
														: 0;
												const isCompact = density === "compact";

												return (
													<TableRow
														key={account.id}
														onClick={() => {
															setSelectedAccountId(account.id);
															onSelectAccount(account.id);
														}}
														className={cn(
															"border-border/20 hover:bg-muted/40 cursor-pointer transition-colors",
															isCompact ? "h-11" : "h-14",
														)}
													>
														{/* Account & Entity */}
														<TableCell className={cn("py-2", isCompact ? "py-1.5" : "py-3")}>
															<div className="flex items-center gap-3">
																<div
																	className="h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0"
																	style={{ backgroundColor: account.color }}
																>
																	<AccountTypeIcon type={account.type} />
																</div>
																<div className="min-w-0">
																	<div className="flex items-center gap-1.5 flex-wrap">
																		<span
																			className="font-semibold text-xs text-foreground truncate max-w-[200px]"
																			title={classification.legalName || account.name}
																		>
																			{classification.friendlyTitle}
																		</span>
																		{classification.badgeLabel && (
																			<Badge
																				variant="secondary"
																				className={cn(
																					"text-[10px] uppercase font-mono px-1 py-0 h-3.5",
																					classification.badgeClassName,
																				)}
																			>
																				{classification.badgeLabel}
																			</Badge>
																		)}
																	</div>
																	<div className="flex items-center gap-1.5 text-micro text-muted-foreground font-mono">
																		<span>{formatAccountNumber(account.accountNumber)}</span>
																		{account.accountNumber && (
																			<button
																				type="button"
																				onClick={(e) => {
																					e.stopPropagation();
																					handleCopyAccountNumber(
																						account.id,
																						account.accountNumber,
																					);
																				}}
																				className="hover:text-foreground transition-colors cursor-pointer"
																				title="Copy account number"
																			>
																				{copiedAccountId === account.id ? (
																					<Check className="h-3 w-3 text-gain" />
																				) : (
																					<Copy className="h-3 w-3" />
																				)}
																			</button>
																		)}
																	</div>
																</div>
															</div>
														</TableCell>

														{/* Custody & Type */}
														<TableCell className="py-2">
															<div className="flex items-center gap-1.5 flex-wrap">
																<Badge variant="outline" className="text-micro font-medium">
																	{classification.primaryTypeLabel}
																</Badge>
																{account.ownershipPercentage &&
																	account.ownershipPercentage < 100 && (
																		<Badge
																			variant="outline"
																			className="text-micro font-medium border-amber-500/30 text-amber-500 bg-amber-500/10"
																		>
																			Part: {account.ownershipPercentage}%
																			{account.coOwnerName ? ` (${account.coOwnerName})` : ""}
																		</Badge>
																	)}
																<span className="text-micro text-muted-foreground">
																	{account.institution}
																</span>
															</div>
														</TableCell>

														{/* Currency & Sync */}
														<TableCell className="py-2">
															<div className="flex items-center gap-2">
																<Badge
																	variant="outline"
																	className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold"
																>
																	{account.currency || "EUR"}
																</Badge>
																{account.syncProvider && account.syncProvider !== "MANUAL" ? (
																	<SyncStatusBadge
																		accountId={account.id}
																		portfolioId={portfolioId}
																		syncStatus={account.syncConnection?.syncStatus}
																		lastSyncAt={account.syncConnection?.lastSyncAt}
																		lastError={account.syncConnection?.lastError}
																		provider={account.syncProvider}
																		compact
																	/>
																) : (
																	<span className="text-micro text-muted-foreground">Manual</span>
																)}
															</div>
														</TableCell>

														{/* Total Value */}
														<TableCell className="py-2 text-right font-mono text-xs font-semibold">
															{account.syncConnection?.syncStatus === "SYNCING" ? (
																<div className="flex items-center justify-end gap-1.5 text-primary">
																	<span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
																	<span className="text-[11px] font-medium text-muted-foreground animate-pulse">
																		Synchro...
																	</span>
																</div>
															) : (
																<div>
																	{formatCurrencyWithCode(
																		account.totalValue,
																		account.currency || "EUR",
																	)}
																</div>
															)}
															{account.ownershipPercentage && account.ownershipPercentage < 100 ? (
																<div className="text-micro text-amber-500 font-normal">
																	Part ({account.ownershipPercentage}%) :{" "}
																	{formatCurrencyWithCode(
																		(account.totalValue * account.ownershipPercentage) / 100,
																		account.currency || "EUR",
																	)}
																</div>
															) : (
																account.currency &&
																account.currency !== "EUR" &&
																account.totalValue > 0 && (
																	<div className="text-micro text-muted-foreground font-normal">
																		≈ {formatCurrencyWithCode(getAccountEurValue(account), "EUR")}
																	</div>
																)
															)}
														</TableCell>

														{/* P&L */}
														<TableCell
															className={cn(
																"py-2 text-right font-mono text-xs",
																account.profitLoss > 0
																	? "text-gain"
																	: account.profitLoss < 0
																		? "text-loss"
																		: "text-muted-foreground",
															)}
														>
															{account.profitLoss === 0
																? "—"
																: `${account.profitLoss > 0 ? "+" : ""}${formatCurrencyWithCode(account.profitLoss, account.currency || "EUR")}`}
														</TableCell>

														{/* Return */}
														<TableCell
															className={cn(
																"py-2 text-right font-mono text-xs",
																account.profitLossPercent > 0
																	? "text-gain"
																	: account.profitLossPercent < 0
																		? "text-loss"
																		: "text-muted-foreground",
															)}
														>
															{account.profitLossPercent === 0
																? "—"
																: `${account.profitLossPercent > 0 ? "+" : ""}${account.profitLossPercent.toFixed(1)}%`}
														</TableCell>

														{/* Weight */}
														<TableCell className="py-2 text-right font-mono text-xs text-muted-foreground">
															<div className="flex items-center justify-end gap-1.5">
																<span>{weight.toFixed(1)}%</span>
																<div className="w-10 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
																	<div
																		className="h-full bg-primary rounded-full"
																		style={{ width: `${Math.min(100, Math.max(0, weight))}%` }}
																	/>
																</div>
															</div>
														</TableCell>

														{/* Actions */}
														<TableCell className="py-2 text-right pr-4">
															<div
																className="flex items-center justify-end gap-1"
																onClick={(e) => e.stopPropagation()}
															>
																{account.syncProvider && account.syncProvider !== "MANUAL" && (
																	<Button
																		variant="ghost"
																		size="icon"
																		onClick={() => handleTriggerSync(account.id, account.name)}
																		className="h-7 w-7 text-muted-foreground hover:text-foreground touch-target"
																		title="Sync Now"
																	>
																		<RefreshCw className="h-3.5 w-3.5" />
																	</Button>
																)}
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-7 w-7 text-muted-foreground hover:text-foreground touch-target"
																			aria-label="Account actions"
																		>
																			<MoreVertical className="h-3.5 w-3.5" />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end" className="text-xs">
																		<DropdownMenuItem
																			onClick={() => {
																				setSelectedAccountId(account.id);
																				onSelectAccount(account.id);
																			}}
																		>
																			<Eye className="h-3.5 w-3.5 mr-2" />
																			View Details
																		</DropdownMenuItem>
																		<DropdownMenuItem onClick={() => setAccountToEdit(account)}>
																			<Pencil className="h-3.5 w-3.5 mr-2" />
																			Edit Account
																		</DropdownMenuItem>
																		{account.syncProvider && account.syncProvider !== "MANUAL" && (
																			<DropdownMenuItem
																				onClick={() => handleTriggerSync(account.id, account.name)}
																			>
																				<RefreshCw className="h-3.5 w-3.5 mr-2" />
																				Sync Now
																			</DropdownMenuItem>
																		)}
																		<DropdownMenuSeparator />
																		<DropdownMenuItem
																			className="text-destructive focus:text-destructive"
																			onClick={() => setAccountToDelete(account)}
																		>
																			<Trash2 className="h-3.5 w-3.5 mr-2" />
																			Delete
																		</DropdownMenuItem>
																	</DropdownMenuContent>
																</DropdownMenu>
															</div>
														</TableCell>
													</TableRow>
												);
											})
										) : (
											<TableRow>
												<TableCell
													colSpan={8}
													className="h-32 text-center text-xs text-muted-foreground"
												>
													No financial accounts match your filter criteria.
												</TableCell>
											</TableRow>
										)}
									</TableBody>
								</Table>
							</div>
						)}

						{/* Content: Cards View */}
						{viewMode === "cards" && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
								{sortedAccounts.map((account) => {
									const classification = classifyAccount(account);
									const weight =
										totalPortfolioValue > 0 ? (account.totalValue / totalPortfolioValue) * 100 : 0;

									return (
										<div
											key={account.id}
											onClick={() => {
												setSelectedAccountId(account.id);
												onSelectAccount(account.id);
											}}
											className="p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-all cursor-pointer space-y-3"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="flex items-center gap-3 min-w-0">
													<div
														className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
														style={{ backgroundColor: account.color }}
													>
														<AccountTypeIcon type={account.type} />
													</div>
													<div className="min-w-0">
														<div className="flex items-center gap-1.5 flex-wrap">
															<span
																className="font-semibold text-sm text-foreground truncate max-w-[180px]"
																title={classification.legalName || account.name}
															>
																{classification.friendlyTitle}
															</span>
															{classification.badgeLabel && (
																<Badge
																	variant="secondary"
																	className={cn(
																		"text-[10px] uppercase font-mono px-1 py-0 h-3.5",
																		classification.badgeClassName,
																	)}
																>
																	{classification.badgeLabel}
																</Badge>
															)}
														</div>
														<p className="text-micro text-muted-foreground font-mono">
															{formatAccountNumber(account.accountNumber)}
														</p>
													</div>
												</div>

												<DropdownMenu>
													<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-muted-foreground"
															aria-label="Account actions"
														>
															<MoreVertical className="h-3.5 w-3.5" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="text-xs">
														<DropdownMenuItem
															onClick={() => {
																setSelectedAccountId(account.id);
																onSelectAccount(account.id);
															}}
														>
															<Eye className="h-3.5 w-3.5 mr-2" />
															View Details
														</DropdownMenuItem>
														<DropdownMenuItem onClick={() => setAccountToEdit(account)}>
															<Pencil className="h-3.5 w-3.5 mr-2" />
															Edit Account
														</DropdownMenuItem>
														{account.syncProvider && account.syncProvider !== "MANUAL" && (
															<DropdownMenuItem
																onClick={() => handleTriggerSync(account.id, account.name)}
															>
																<RefreshCw className="h-3.5 w-3.5 mr-2" />
																Sync Now
															</DropdownMenuItem>
														)}
														<DropdownMenuSeparator />
														<DropdownMenuItem
															className="text-destructive focus:text-destructive"
															onClick={() => setAccountToDelete(account)}
														>
															<Trash2 className="h-3.5 w-3.5 mr-2" />
															Delete
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>

											{/* Balance & Returns */}
											<div className="space-y-1">
												<span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">
													Total Value
												</span>
												<div className="flex items-baseline justify-between">
													<div>
														<span className="text-xl font-bold font-mono tracking-tight">
															{formatCurrencyWithCode(
																account.totalValue,
																account.currency || "EUR",
															)}
														</span>
														{account.ownershipPercentage && account.ownershipPercentage < 100 && (
															<div className="text-micro text-amber-500 font-mono font-medium mt-0.5">
																Part ({account.ownershipPercentage}%) :{" "}
																{formatCurrencyWithCode(
																	(account.totalValue * account.ownershipPercentage) / 100,
																	account.currency || "EUR",
																)}
															</div>
														)}
													</div>
													<span
														className={cn(
															"text-xs font-mono font-semibold",
															account.profitLossPercent > 0
																? "text-gain"
																: account.profitLossPercent < 0
																	? "text-loss"
																	: "text-muted-foreground",
														)}
													>
														{account.profitLossPercent === 0
															? "—"
															: `${account.profitLossPercent > 0 ? "+" : ""}${account.profitLossPercent.toFixed(1)}%`}
													</span>
												</div>
											</div>

											{/* Footer: Custody & Weight */}
											<div className="pt-2 border-t border-border/20 flex items-center justify-between text-micro text-muted-foreground">
												<span>{classification.primaryTypeLabel}</span>
												<span className="font-mono">{weight.toFixed(1)}% of portfolio</span>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* Tab 2: Holdings by Account */}
				{activeWorkspaceTab === "holdings" && (
					<div className="space-y-4">
						<PositionsDataTable<AccountPositionItem>
							positions={holdingsPositions}
							loading={accountsLoading}
							defaultGroupBy="account"
							groupBy={holdingsGroupBy}
							onGroupByChange={setHoldingsGroupBy}
							groupByOptions={holdingsGroupByOptions}
							formatCurrency={formatCurrency}
							formatQuantity={(qty) => qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
							onSelectAsset={(_symbol, item) => {
								setSelectedAccountId(item.account);
							}}
							emptyMessage="No asset holdings found across your accounts."
						/>
					</div>
				)}
			</div>

			{/* Unified Add Account Chooser Dialog */}
			<AddAccountChooserDialog
				open={showAddChooser}
				onOpenChange={setShowAddChooser}
				onChooseConnectInstitution={() => setShowConnectInstitution(true)}
				onChooseConnectWallet={() => setShowAddWalletDialog(true)}
				onChooseAddSavings={() => setShowAddForm(true)}
				onChooseCreateCustom={() => setShowCreateAccountModal(true)}
			/>

			{/* Create Account Modal */}
			<CreateAccountDialog
				open={showCreateAccountModal}
				onOpenChange={setShowCreateAccountModal}
				portfolioId={portfolioId}
			/>

			{/* Add Savings / Bank Account Form */}
			<AddSavingForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={handleAddAccount}
			/>

			{/* Connect Institution (Trade Republic / Enable Banking) */}
			{portfolioId && (
				<ConnectInstitutionDialog
					open={showConnectInstitution}
					onOpenChange={setShowConnectInstitution}
					portfolioId={portfolioId}
					onSuccess={() => {
						void refetchAccounts();
						void refetchWalletAccounts();
					}}
				/>
			)}

			{/* Connect Crypto Wallet */}
			{portfolioId && (
				<AddWalletDialog
					open={showAddWalletDialog}
					onOpenChange={setShowAddWalletDialog}
					portfolioId={portfolioId}
					onSuccess={() => {
						void refetchAccounts();
						void refetchWalletAccounts();
					}}
				/>
			)}

			{/* Edit Account Dialog */}
			{accountToEdit && (
				<EditAccountDialog
					open={Boolean(accountToEdit)}
					onOpenChange={(open) => {
						if (!open) setAccountToEdit(null);
					}}
					account={accountToEdit}
					portfolioId={portfolioId || undefined}
					onSuccess={() => {
						setAccountToEdit(null);
						void refetch();
					}}
				/>
			)}

			{/* Delete Account Dialog */}
			{accountToDelete && (
				<DeleteAccountDialog
					open={Boolean(accountToDelete)}
					onOpenChange={(open) => {
						if (!open) setAccountToDelete(null);
					}}
					accountId={accountToDelete.id}
					accountName={accountToDelete.name}
					portfolioId={portfolioId || undefined}
					onSuccess={() => {
						setAccountToDelete(null);
						void refetch();
					}}
				/>
			)}

			{/* Slide-over Account Detail Sheet */}
			<Sheet
				open={Boolean(selectedAccountId)}
				onOpenChange={(open) => !open && setSelectedAccountId(null)}
			>
				<SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
					<SheetHeader className="sr-only">
						<SheetTitle>Account Details</SheetTitle>
						<SheetDescription>Detailed account overview and holdings breakdown</SheetDescription>
					</SheetHeader>
					{selectedAccountId && (
						<AccountDetail
							accountId={selectedAccountId}
							onBack={() => setSelectedAccountId(null)}
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
