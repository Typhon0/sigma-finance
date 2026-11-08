import { useQuery } from "@apollo/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ArrowUpDown,
	Building2,
	ChevronDown,
	Coins,
	Eye,
	Filter,
	Layers,
	List,
	MoreVertical,
	Pencil,
	PiggyBank,
	Plus,
	SlidersHorizontal,
	Tag,
	Trash2,
	Wallet,
	X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ErrorBoundary from "@/components/ui/error-boundary";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { useAssetMutations } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import { classifyAccount } from "@/lib/account-classifier";
import { cn, formatCurrency as formatCurrencyWithCode } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddSavingForm, type SavingsFormData } from "./AddSavingForm";
import { DeleteSavingDialog } from "./DeleteSavingDialog";
import { EditSavingDialog, type SavingEditData } from "./EditSavingDialog";
import { SavingDetail } from "./SavingDetail";
import { type BankSlice, SavingsExposureWidget } from "./SavingsExposureWidget";
import { TagSavingsAccountDialog } from "./TagSavingsAccountDialog";

interface SavingsListProps {
	onSelectSaving?: (savingId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

const BANK_ACCOUNT_ASSET_TYPE_ID = "3";

type TableDensity = "compact" | "normal";

export interface SavingItemData {
	id: string;
	bankName: string;
	accountName: string;
	balance: number;
	ownership: "personal" | "joint" | "company";
	interestRate: number;
	hasRecordedRate: boolean;
	annualYield: number;
	currency: string;
	accountType: string;
	accountNumber: string;
	isVault: boolean;
	color: string;
	categoryLabel: string;
	rawAsset: PortfolioAssetItem;
}

import {
	BANK_PALETTE,
	getBankColor,
	resolveBankName,
	resolveCategoryLabel,
} from "./savings-utils";

export { resolveBankName, resolveCategoryLabel };

export function SavingsList({ onSelectSaving, detailMode = "panel", onBack }: SavingsListProps) {
	const shouldReduceMotion = useReducedMotion();
	const { assets, currentPortfolio, selectedPortfolio, refetch, getPortfolioValue } =
		usePortfolio();
	const { addBankAccount } = useAssetMutations();
	const { formatCurrency, currency: defaultCurrency } = useCurrency();

	const portfolioId =
		(typeof currentPortfolio === "string" ? currentPortfolio : currentPortfolio?.id) ||
		selectedPortfolio?.id ||
		"";

	// View & Workspace state
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"ledger" | "holdings">("ledger");
	const [density, setDensity] = useState<TableDensity>(() => {
		try {
			const saved = localStorage.getItem("sf_savings_table_density");
			return saved === "normal" ? "normal" : "compact";
		} catch {
			return "compact";
		}
	});

	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
	const [searchQuery, setSearchQuery] = useState("");
	const [ownershipFilter, setOwnershipFilter] = useState("all");
	const [activeBankFilter, setActiveBankFilter] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState("balance-desc");

	// Dialogs & Slide-over states
	const [selectedSavingId, setSelectedSavingId] = useState<string | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [showTagDialog, setShowTagDialog] = useState(false);
	const [savingToEdit, setSavingToEdit] = useState<SavingEditData | null>(null);
	const [savingToDelete, setSavingToDelete] = useState<SavingItemData | null>(null);

	// Manual Savings IDs set (persisted in localStorage)
	const [manualSavingsIds, setManualSavingsIds] = useState<Set<string>>(() => {
		try {
			const raw = localStorage.getItem("sf_manual_savings_account_ids");
			return raw ? new Set(JSON.parse(raw)) : new Set();
		} catch {
			return new Set();
		}
	});

	// Toggle manual saving tag
	const handleToggleManualSaving = (assetId: string) => {
		setManualSavingsIds((prev) => {
			const next = new Set(prev);
			if (next.has(assetId)) {
				next.delete(assetId);
			} else {
				next.add(assetId);
			}
			try {
				localStorage.setItem("sf_manual_savings_account_ids", JSON.stringify(Array.from(next)));
			} catch {
				// ignore
			}
			return next;
		});
	};

	const handleToggleDensity = () => {
		const next = density === "compact" ? "normal" : "compact";
		setDensity(next);
		try {
			localStorage.setItem("sf_savings_table_density", next);
		} catch {
			// ignore storage errors
		}
	};

	// Query Scoped Performance History for Hero Chart (BANK_ACCOUNT asset type)
	const { data: scopedHistoryData, loading: scopedHistoryLoading } = useQuery(
		GET_SCOPED_PERFORMANCE_HISTORY,
		{
			variables: {
				portfolioID: portfolioId,
				assetTypes: ["BANK_ACCOUNT"],
			},
			skip: !portfolioId,
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
		},
	);

	// Load custom rate overrides
	const customRatesMap = useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem("sf_savings_custom_rates") || "{}");
		} catch {
			return {};
		}
	}, []);

	// Strict Savings perimeter mapping:
	// Includes: type === 'savings' || interestRate > 0 || isVault || keywords || manual tagged
	const savings = useMemo((): SavingItemData[] => {
		const result: SavingItemData[] = [];

		const candidateAssets = assets.filter((a) => {
			if (a.type === "savings") return true;
			if (manualSavingsIds.has(a.id)) return true;

			// Bank account checks
			if (a.type === "bank" || a.assetType?.name === "BANK_ACCOUNT") {
				const customRate = customRatesMap[a.id];
				const rate = typeof customRate === "number" ? customRate : (a.interestRate ?? 0);
				if (rate > 0) return true;

				const classification = classifyAccount({
					name: a.name || "",
					type: "Bank",
					institution: a.institution,
					accountNumber: a.accountNumber,
				});

				if (classification.isVault) return true;
				if (classification.category === "BANK_VAULT") return true;

				const nameLower = (a.name || "").toLowerCase();
				const instLower = (a.institution || "").toLowerCase();
				if (
					/livret|epargne|coffre|vault|poche|cat|csl|ldds|pel|cel|lep|deposit|savings/i.test(
						nameLower + " " + instLower,
					)
				) {
					return true;
				}
			}

			return false;
		});

		const uniqueBanksMap = new Map<string, number>();

		candidateAssets.forEach((a) => {
			const customRate = customRatesMap[a.id];
			const effectiveRate = typeof customRate === "number" ? customRate : (a.interestRate ?? 0);
			const hasRecordedRate = effectiveRate > 0;

			const bankName = resolveBankName(a.name || "", a.institution || a.symbol);
			if (!uniqueBanksMap.has(bankName)) {
				uniqueBanksMap.set(bankName, uniqueBanksMap.size);
			}
			const color = getBankColor(bankName, uniqueBanksMap.get(bankName) || 0);

			const balance =
				typeof a.balance === "number" && a.balance > 0
					? a.balance
					: typeof a.currentValue === "number" && a.currentValue > 0
						? a.currentValue
						: a.purchasePrice || 0;
			const annualYield = hasRecordedRate ? (balance * effectiveRate) / 100 : 0;

			const classification = classifyAccount({
				name: a.name || "",
				type: "Bank",
				institution: bankName,
				accountNumber: a.accountNumber,
			});

			const categoryLabel = resolveCategoryLabel(
				a.name || "",
				a.accountType || a.type,
				classification.isVault,
			);

			result.push({
				id: a.id,
				bankName,
				accountName: a.name,
				balance,
				ownership: (a.accountType === "joint"
					? "joint"
					: a.accountType === "company"
						? "company"
						: "personal") as "personal" | "joint" | "company",
				interestRate: effectiveRate,
				hasRecordedRate,
				annualYield,
				currency: a.currency || defaultCurrency || "EUR",
				accountType: a.accountType || a.type || "savings",
				accountNumber: a.accountNumber || `****${a.id.slice(-4)}`,
				isVault: classification.isVault,
				color,
				categoryLabel,
				rawAsset: a,
			});
		});

		return result;
	}, [assets, manualSavingsIds, customRatesMap, defaultCurrency]);

	// Total Savings Balance
	const totalSavingsValue = useMemo(() => {
		return savings.reduce((sum, s) => sum + s.balance, 0);
	}, [savings]);

	// Total and Weighted APY (unrecorded rates excluded from denominator)
	const { weightedApy, totalAnnualYield, monthlyIncome } = useMemo(() => {
		let rateWeightedSum = 0;
		let balanceWithRateSum = 0;
		let totalYield = 0;
		const knownRates: number[] = [];

		for (const s of savings) {
			if (s.hasRecordedRate) {
				knownRates.push(s.interestRate);
				if (s.balance > 0) {
					rateWeightedSum += s.balance * s.interestRate;
					balanceWithRateSum += s.balance;
					totalYield += s.annualYield;
				}
			}
		}

		let apy: number | null = null;
		if (balanceWithRateSum > 0) {
			apy = rateWeightedSum / balanceWithRateSum;
		} else if (knownRates.length > 0) {
			apy = knownRates.reduce((a, b) => a + b, 0) / knownRates.length;
		}

		return {
			weightedApy: apy,
			totalAnnualYield: totalYield,
			monthlyIncome: totalYield / 12,
		};
	}, [savings]);

	// Performance Series for Hero Chart
	const performanceData = useMemo(() => {
		return buildPerformanceSeries(
			scopedHistoryData?.scopedPerformanceHistory ?? [],
			totalSavingsValue,
		);
	}, [scopedHistoryData, totalSavingsValue]);

	// Chart holdings mapped from savings
	const chartHoldings = useMemo(() => {
		return savings.map((s) => ({
			value: s.balance,
			currentPrice: s.balance,
			changePercent: 0,
			sparklineData: undefined,
		}));
	}, [savings]);

	// Bank Slices for Exposure Widget
	const bankSlices = useMemo((): BankSlice[] => {
		const bankMap = new Map<
			string,
			{ value: number; count: number; types: Set<string>; color: string }
		>();

		for (const s of savings) {
			const current = bankMap.get(s.bankName) || {
				value: 0,
				count: 0,
				types: new Set<string>(),
				color: s.color,
			};
			current.value += s.balance;
			current.count += 1;
			if (s.categoryLabel) current.types.add(s.categoryLabel);
			bankMap.set(s.bankName, current);
		}

		const total = totalSavingsValue > 0 ? totalSavingsValue : 1;
		const slices: BankSlice[] = [];

		bankMap.forEach((data, bankName) => {
			slices.push({
				key: bankName,
				label: bankName,
				color: data.color,
				count: data.count,
				value: data.value,
				percent: (data.value / total) * 100,
				types: Array.from(data.types).slice(0, 2),
			});
		});

		slices.sort((a, b) => b.value - a.value);
		return slices;
	}, [savings, totalSavingsValue]);

	// Currency breakdown
	const currencyBreakdown = useMemo(() => {
		const map: Record<string, number> = {};
		for (const s of savings) {
			map[s.currency] = (map[s.currency] || 0) + s.balance;
		}
		const total = totalSavingsValue > 0 ? totalSavingsValue : 1;
		return Object.entries(map).map(([curr, val]) => ({
			currency: curr,
			value: val,
			percent: (val / total) * 100,
		}));
	}, [savings, totalSavingsValue]);

	// Filtering & Sorting for Tab 1 (Ledger)
	const filteredSavings = useMemo(() => {
		return savings.filter((s) => {
			if (activeBankFilter && s.bankName !== activeBankFilter) return false;
			if (ownershipFilter !== "all" && s.ownership !== ownershipFilter) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					s.accountName.toLowerCase().includes(query) ||
					s.bankName.toLowerCase().includes(query) ||
					s.accountNumber.toLowerCase().includes(query) ||
					s.categoryLabel.toLowerCase().includes(query)
				);
			}
			return true;
		});
	}, [savings, activeBankFilter, ownershipFilter, searchQuery]);

	const sortedSavings = useMemo(() => {
		const list = [...filteredSavings];
		if (sortBy === "balance-desc") list.sort((a, b) => b.balance - a.balance);
		else if (sortBy === "balance-asc") list.sort((a, b) => a.balance - b.balance);
		else if (sortBy === "rate-desc") list.sort((a, b) => b.interestRate - a.interestRate);
		else if (sortBy === "rate-asc") list.sort((a, b) => a.interestRate - b.interestRate);
		else if (sortBy === "yield-desc") list.sort((a, b) => b.annualYield - a.annualYield);
		else if (sortBy === "name-asc") list.sort((a, b) => a.accountName.localeCompare(b.accountName));
		return list;
	}, [filteredSavings, sortBy]);

	// Active cross-filter stats
	const activeFilterStats = useMemo(() => {
		if (!activeBankFilter) return null;
		return bankSlices.find((s) => s.key === activeBankFilter) || null;
	}, [activeBankFilter, bankSlices]);

	// Grouped positions for Tab 2: Holdings by Bank
	interface SavingsPositionItem extends BasePositionItem {
		bankName: string;
		accountType: string;
		interestRate: number;
		annualYield: number;
	}

	const holdingsPositions = useMemo((): SavingsPositionItem[] => {
		return savings.map((s) => ({
			id: s.id,
			name: s.accountName,
			symbol: s.categoryLabel || "CASH",
			account: s.bankName,
			accountType: s.accountType,
			quantity: 1,
			currentPrice: s.balance,
			dayChange: 0,
			value: s.balance,
			avgPrice: s.balance,
			cost: s.balance,
			pl: s.annualYield,
			plPercent: s.interestRate,
			weight: totalSavingsValue > 0 ? (s.balance / totalSavingsValue) * 100 : 0,
			bankName: s.bankName,
			interestRate: s.interestRate,
			annualYield: s.annualYield,
		}));
	}, [savings, totalSavingsValue]);

	const [holdingsGroupBy, setHoldingsGroupBy] = useState<string>("bank");
	const holdingsGroupByOptions: GroupByOption<SavingsPositionItem>[] = [
		{
			id: "bank",
			label: "Group by Bank",
			icon: Building2,
			getGroupKey: (item) => item.bankName,
			isClickableAccount: true,
		},
		{
			id: "none",
			label: "No Grouping",
			icon: List,
			getGroupKey: () => "All Savings Accounts",
		},
	];

	const handleAddSaving = async (data: SavingsFormData) => {
		if (!portfolioId) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addBankAccount({
				portfolioId,
				assetTypeID: BANK_ACCOUNT_ASSET_TYPE_ID,
				name: data.accountName,
				institution: data.bankName,
				accountType: data.accountType,
				accountNumber: data.accountNumber,
				currency: data.currency || "EUR",
				currentValue: parseFloat(data.balance) || 0,
				interestRate: data.interestRate ? parseFloat(data.interestRate) : undefined,
			});

			if (result.asset) {
				toast.success("Savings account added successfully");
				await refetch();
			} else {
				throw new Error("createBankAccountAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add savings account. Please try again.");
			throw error;
		}
	};

	const handleSelectAccount = (savingId: string) => {
		if (detailMode === "panel") {
			setSelectedSavingId(savingId);
		} else {
			onSelectSaving?.(savingId);
		}
	};

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			{/* Canonical Page Header */}
			<AssetPageHeader
				title="Savings & Deposits"
				description="Manage liquid cash reserves, high-yield accounts, interest rates, and passive yields."
				onBack={onBack}
				actions={
					<div className="flex items-center gap-2 flex-wrap">
						<div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40 text-micro font-mono text-muted-foreground">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							<span>
								{savings.length} account{savings.length !== 1 ? "s" : ""}
								{typeof weightedApy === "number" && weightedApy > 0
									? ` • ${weightedApy.toFixed(2)}% avg APY`
									: ""}
							</span>
						</div>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowTagDialog(true)}
							className="h-8 text-xs gap-1.5 border-border/50 touch-target"
							title="Tag existing bank accounts as savings"
						>
							<Tag className="h-3.5 w-3.5" />
							<span className="hidden md:inline">Tag Accounts</span>
						</Button>

						<Button
							size="sm"
							onClick={() => setShowAddForm(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Account
						</Button>
					</div>
				}
			/>

			{/* 70/30 Hero Section: Savings Growth Chart (70%) + Exposure Brief (30%) */}
			<div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
				{/* Left 70%: Savings Hero Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					<ErrorBoundary>
						<AssetHeroChart
							title="Savings & Cash Reserves"
							titleTooltip="Aggregated valuation and yield history of savings accounts and cash deposits"
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={totalSavingsValue}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={portfolioId}
							loading={scopedHistoryLoading && savings.length === 0}
							defaultBenchmark="none"
							layoutId="savingsHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>

				{/* Right 30%: Institution Split & Exposure Brief */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<SavingsExposureWidget
							totalSavingsValue={totalSavingsValue}
							slices={bankSlices}
							activeFilter={activeBankFilter}
							onSelectCategory={setActiveBankFilter}
							formatCurrency={formatCurrency}
							weightedApy={weightedApy}
							annualYield={totalAnnualYield}
							monthlyIncome={monthlyIncome}
							currencyBreakdown={currencyBreakdown}
							loading={scopedHistoryLoading && savings.length === 0}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{activeFilterStats && (
				<motion.div
					key="savings-cross-filter-banner"
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
							<span className="font-semibold text-foreground">Filtered by Institution:</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{activeFilterStats.label}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} account{activeFilterStats.count !== 1 ? "s" : ""} •{" "}
								{formatCurrency(activeFilterStats.value)} • {activeFilterStats.percent.toFixed(1)}%
								of savings)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const el = document.getElementById("savings-workspace-section");
									el?.scrollIntoView({ behavior: "smooth" });
								}}
								className="h-7 text-xs bg-background/80 hover:bg-background border-border/60 gap-1.5 cursor-pointer touch-target"
							>
								<span>Jump to Ledger</span>
								<ChevronDown className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setActiveBankFilter(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Workspace Navigation */}
			<div id="savings-workspace-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-1">
					<div
						className="relative flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Savings workspace view"
					>
						<button
							type="button"
							role="tab"
							aria-selected={activeWorkspaceTab === "ledger"}
							onClick={() => setActiveWorkspaceTab("ledger")}
							className={cn(
								"relative shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold rounded-md transition-colors duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary min-h-[36px] touch-target",
								activeWorkspaceTab === "ledger"
									? "text-foreground font-bold"
									: "text-foreground/70 hover:text-foreground border border-transparent",
							)}
						>
							{activeWorkspaceTab === "ledger" && (
								<motion.span
									layoutId="savingsActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Savings Ledger</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{filteredSavings.length}
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
									layoutId="savingsActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Holdings détaillées</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{holdingsPositions.length}
							</span>
						</button>
					</div>

					{/* Density toggle */}
					{activeWorkspaceTab === "ledger" && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleToggleDensity}
							className="h-8 text-xs border-border/50 text-muted-foreground hover:text-foreground gap-1.5 cursor-pointer touch-target hidden sm:flex"
						>
							<SlidersHorizontal className="h-3.5 w-3.5" />
							<span>{density === "compact" ? "Compact" : "Normal"}</span>
						</Button>
					)}
				</div>

				{/* Tab 1: Savings Ledger */}
				{activeWorkspaceTab === "ledger" && (
					<div className="space-y-4">
						{/* Filters toolbar */}
						<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
							<SearchInput
								placeholder="Search savings accounts, banks, livrets..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onClear={() => setSearchQuery("")}
								containerClassName="flex-1 max-w-sm"
							/>

							<div className="flex items-center gap-2 flex-wrap">
								<Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
									<SelectTrigger className="w-[140px] h-8 text-xs">
										<Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Ownership</SelectItem>
										<SelectItem value="personal">Personal</SelectItem>
										<SelectItem value="joint">Joint</SelectItem>
										<SelectItem value="company">Company</SelectItem>
									</SelectContent>
								</Select>

								<Select value={sortBy} onValueChange={setSortBy}>
									<SelectTrigger className="w-[170px] h-8 text-xs">
										<ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="balance-desc">Balance (High to Low)</SelectItem>
										<SelectItem value="balance-asc">Balance (Low to High)</SelectItem>
										<SelectItem value="rate-desc">APY Rate (High to Low)</SelectItem>
										<SelectItem value="rate-asc">APY Rate (Low to High)</SelectItem>
										<SelectItem value="yield-desc">Yield (High to Low)</SelectItem>
										<SelectItem value="name-asc">Name (A to Z)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* High Density Savings Table */}
						<div className="rounded-xl border border-border/40 overflow-hidden bg-card shadow-xs">
							<Table>
								<TableHeader>
									<TableRow className="border-border/30 hover:bg-transparent text-micro uppercase tracking-wider text-muted-foreground">
										<TableHead className="text-xs min-w-[200px]">Account & Institution</TableHead>
										<TableHead className="text-xs w-[140px]">Category</TableHead>
										<TableHead className="text-xs text-right w-[140px]">
											Interest Rate (APY)
										</TableHead>
										<TableHead className="text-xs text-right w-[140px]">
											Est. Annual Yield
										</TableHead>
										<TableHead className="text-xs text-right w-[130px]">Balance</TableHead>
										<TableHead className="text-xs text-right w-[110px] hidden md:table-cell">
											Share
										</TableHead>
										<TableHead className="text-xs text-right w-[44px]">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{sortedSavings.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className="h-40 text-center text-muted-foreground text-xs"
											>
												<PiggyBank className="h-8 w-8 mx-auto mb-2 opacity-40" />
												<p className="font-semibold text-foreground text-sm">
													No savings accounts found
												</p>
												<p className="text-muted-foreground text-xs mt-1">
													{searchQuery || activeBankFilter || ownershipFilter !== "all"
														? "Try clearing your search query or cross-filters."
														: "Start by adding a savings account or tagging existing bank accounts."}
												</p>
												{!searchQuery && !activeBankFilter && (
													<Button
														size="sm"
														onClick={() => setShowAddForm(true)}
														className="mt-3 h-8 text-xs bg-primary text-primary-foreground font-semibold"
													>
														<Plus className="mr-1.5 h-3.5 w-3.5" />
														Add Savings Account
													</Button>
												)}
											</TableCell>
										</TableRow>
									) : (
										sortedSavings.map((saving) => {
											const weight =
												totalSavingsValue > 0 ? (saving.balance / totalSavingsValue) * 100 : 0;

											return (
												<TableRow
													key={saving.id}
													className={cn(
														"border-border/20 cursor-pointer hover:bg-muted/50 transition-colors",
														density === "compact" ? "h-11" : "h-14",
													)}
													onClick={() => handleSelectAccount(saving.id)}
												>
													{/* Account & Bank */}
													<TableCell className="font-medium min-w-[200px]">
														<div className="flex items-center gap-3">
															<div
																className="h-7 w-7 rounded-lg flex items-center justify-center font-bold text-micro text-white shrink-0 shadow-xs"
																style={{ backgroundColor: saving.color }}
															>
																{saving.bankName.slice(0, 2).toUpperCase()}
															</div>
															<div className="min-w-0">
																<div className="font-semibold text-foreground truncate text-xs sm:text-sm">
																	{saving.accountName}
																</div>
																<div className="text-micro text-muted-foreground flex items-center gap-1.5">
																	<span className="font-medium text-foreground/75">
																		{saving.bankName}
																	</span>
																	<span>•</span>
																	<span className="font-mono">{saving.accountNumber}</span>
																</div>
															</div>
														</div>
													</TableCell>

													{/* Category & Ownership */}
													<TableCell className="w-[140px]">
														<div className="flex items-center gap-1.5 flex-wrap">
															<Badge
																variant="secondary"
																className="text-[10px] font-medium px-1.5 py-0 border-border/40"
															>
																{saving.categoryLabel}
															</Badge>
															{saving.ownership !== "personal" && (
																<Badge
																	variant="outline"
																	className="text-[10px] capitalize px-1.5 py-0 text-muted-foreground"
																>
																	{saving.ownership}
																</Badge>
															)}
														</div>
													</TableCell>

													{/* Interest Rate */}
													<TableCell className="text-right font-mono w-[140px]">
														{saving.hasRecordedRate ? (
															<span className="font-semibold text-foreground">
																{saving.interestRate.toFixed(2)}%
															</span>
														) : (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<span className="text-muted-foreground cursor-help">—</span>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p className="text-xs">Taux non renseigné</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</TableCell>

													{/* Annual Yield */}
													<TableCell className="text-right font-mono w-[140px]">
														<div className="flex flex-col items-end">
															{saving.annualYield > 0 ? (
																<span className="font-semibold text-gain">
																	+{formatCurrencyWithCode(saving.annualYield, saving.currency)}/yr
																</span>
															) : saving.hasRecordedRate ? (
																<span className="text-muted-foreground font-normal text-xs">
																	{formatCurrencyWithCode(0, saving.currency)}/yr
																</span>
															) : (
																<span className="text-muted-foreground">—</span>
															)}
														</div>
													</TableCell>

													{/* Balance */}
													<TableCell className="text-right font-mono font-bold text-foreground w-[130px]">
														<div className="flex flex-col items-end">
															<span>{formatCurrencyWithCode(saving.balance, saving.currency)}</span>
															{saving.currency !== defaultCurrency && (
																<span className="text-[10px] font-normal text-muted-foreground">
																	≈ {formatCurrency(saving.balance)}
																</span>
															)}
														</div>
													</TableCell>

													{/* Weight / Share */}
													<TableCell className="text-right font-mono text-muted-foreground w-[110px] hidden md:table-cell">
														<div className="flex items-center justify-end gap-2">
															<span>{weight.toFixed(1)}%</span>
															<div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
																<div
																	className="h-full rounded-full bg-primary"
																	style={{ width: `${Math.min(100, Math.max(0, weight))}%` }}
																/>
															</div>
														</div>
													</TableCell>

													{/* Actions */}
													<TableCell
														className="text-right w-[44px]"
														onClick={(e) => e.stopPropagation()}
													>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-7 w-7 text-muted-foreground hover:text-foreground touch-target"
																>
																	<MoreVertical className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem onClick={() => handleSelectAccount(saving.id)}>
																	<Eye className="h-4 w-4 mr-2" />
																	View Details
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		setSavingToEdit({
																			id: saving.id,
																			accountName: saving.accountName,
																			bankName: saving.bankName,
																			accountNumber: saving.accountNumber,
																			currency: saving.currency,
																			interestRate: saving.interestRate,
																			balance: saving.balance,
																			accountType: saving.accountType,
																		})
																	}
																>
																	<Pencil className="h-4 w-4 mr-2" />
																	Edit Account
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() => setSavingToDelete(saving)}
																	className="text-destructive focus:text-destructive"
																>
																	<Trash2 className="h-4 w-4 mr-2" />
																	Delete Account
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				)}

				{/* Tab 2: Holdings détaillées */}
				{activeWorkspaceTab === "holdings" && (
					<div className="space-y-4">
						<PositionsDataTable<SavingsPositionItem>
							positions={holdingsPositions}
							loading={scopedHistoryLoading}
							defaultGroupBy="bank"
							groupBy={holdingsGroupBy}
							onGroupByChange={setHoldingsGroupBy}
							groupByOptions={holdingsGroupByOptions}
							formatCurrency={formatCurrency}
							formatQuantity={(qty) => qty.toLocaleString()}
							onSelectAsset={(_symbol, item) => {
								handleSelectAccount(item.id);
							}}
							emptyMessage="No savings holdings found across your accounts."
						/>
					</div>
				)}
			</div>

			{/* Add Savings Form Dialog */}
			<AddSavingForm
				open={showAddForm}
				onClose={() => setShowAddForm(false)}
				onSubmit={handleAddSaving}
			/>

			{/* Tag Existing Bank Accounts Dialog */}
			<TagSavingsAccountDialog
				open={showTagDialog}
				onOpenChange={setShowTagDialog}
				manualSavingsIds={manualSavingsIds}
				onToggleManualSaving={handleToggleManualSaving}
			/>

			{/* Edit Saving Dialog */}
			{savingToEdit && (
				<EditSavingDialog
					open={Boolean(savingToEdit)}
					onOpenChange={(open) => {
						if (!open) setSavingToEdit(null);
					}}
					saving={savingToEdit}
					onSuccess={() => {
						setSavingToEdit(null);
						void refetch();
					}}
				/>
			)}

			{/* Delete Saving Dialog */}
			{savingToDelete && (
				<DeleteSavingDialog
					open={Boolean(savingToDelete)}
					onOpenChange={(open) => {
						if (!open) setSavingToDelete(null);
					}}
					savingId={savingToDelete.id}
					accountName={savingToDelete.accountName}
					onSuccess={() => {
						setSavingToDelete(null);
						if (selectedSavingId === savingToDelete.id) {
							setSelectedSavingId(null);
						}
					}}
				/>
			)}

			{/* Slide-over Saving Detail Sheet */}
			<Sheet
				open={detailMode === "panel" && Boolean(selectedSavingId)}
				onOpenChange={(open) => !open && setSelectedSavingId(null)}
			>
				<SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
					<SheetHeader className="sr-only">
						<SheetTitle>Savings Account Details</SheetTitle>
						<SheetDescription>
							Detailed account overview, interest yields, and transactions
						</SheetDescription>
					</SheetHeader>
					{selectedSavingId && (
						<SavingDetail
							savingId={selectedSavingId}
							onBack={() => setSelectedSavingId(null)}
							isPanel
						/>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
