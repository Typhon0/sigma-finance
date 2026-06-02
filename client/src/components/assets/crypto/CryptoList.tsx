import { useMutation } from "@apollo/client";
import ReactECharts from "echarts-for-react";
import {
	AlertTriangle,
	ArrowRight,
	Building2,
	CalendarDays,
	Coins,
	Edit,
	Eye,
	HardDrive,
	LayoutGrid,
	MoreVertical,
	PieChart,
	Plus,
	Trash2,
	Trophy,
	Upload,
	Wallet,
} from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UPDATE_TRANSACTION } from "@/graphql/mutations/transaction";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { AddCryptoForm } from "./AddCryptoForm";

/** Crypto holding derived from portfolio asset data */
interface CryptoHolding {
	id: string;
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
	change24h: number;
	sparklineData: number[];
	accountName: string;
	accountType: "CEX" | "Wallet";
	icon: string;
	color: string;
}

interface PortfolioHistoryPoint {
	date: Date;
	value: number;
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
}

type TimeRange = "24H" | "7D" | "1M" | "1Y" | "ALL";
type GroupByMode = "account" | "asset";
type DistributionView = "pie" | "heatmap";
type DistributionGroup = "crypto" | "account" | "type";

const TIME_RANGES: TimeRange[] = ["24H", "7D", "1M", "1Y", "ALL"];

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

function splitCurrencyParts(formattedValue: string): { main: string; cents: string } {
	const matched = formattedValue.match(/^(.*?)([.,]\d{2})$/);
	if (!matched) {
		return { main: formattedValue, cents: "" };
	}

	return {
		main: matched[1],
		cents: matched[2],
	};
}

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

function getHistoryPointCount(range: TimeRange): number {
	if (range === "24H") return 24;
	if (range === "7D") return 7;
	if (range === "1M") return 30;
	if (range === "1Y") return 52;
	return 104;
}

function buildHistoryDate(now: Date, range: TimeRange, points: number, index: number): Date {
	const date = new Date(now);
	if (range === "24H") {
		date.setHours(now.getHours() - (points - 1 - index));
		return date;
	}
	date.setDate(now.getDate() - (points - 1 - index));
	return date;
}

function resampleSeries(data: number[], targetPoints: number): number[] {
	if (targetPoints <= 0) return [];
	if (data.length === 0) return Array.from({ length: targetPoints }, () => 1);
	if (data.length === 1) return Array.from({ length: targetPoints }, () => data[0]);
	if (data.length === targetPoints) return data;

	return Array.from({ length: targetPoints }, (_, index) => {
		const position = (index / (targetPoints - 1)) * (data.length - 1);
		const lower = Math.floor(position);
		const upper = Math.min(data.length - 1, Math.ceil(position));
		const ratio = position - lower;
		const lowerValue = data[lower];
		const upperValue = data[upper];
		return lowerValue + (upperValue - lowerValue) * ratio;
	});
}

function filterHistoryByRange(
	data: PortfolioHistoryPoint[],
	range: TimeRange,
): PortfolioHistoryPoint[] {
	if (data.length === 0) return [];
	if (range === "ALL") return data;

	const now = new Date();
	const rangeStart = new Date(now);

	if (range === "24H") rangeStart.setHours(now.getHours() - 24);
	else if (range === "7D") rangeStart.setDate(now.getDate() - 7);
	else if (range === "1M") rangeStart.setMonth(now.getMonth() - 1);
	else if (range === "1Y") rangeStart.setFullYear(now.getFullYear() - 1);

	const filtered = data.filter((point) => point.date >= rangeStart);
	return filtered.length >= 2 ? filtered : data.slice(-Math.min(30, data.length));
}

function formatHistoryLabel(point: PortfolioHistoryPoint, range: TimeRange): string {
	if (range === "24H") {
		return point.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
	}

	if (range === "1Y" || range === "ALL") {
		return point.date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
	}

	return point.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
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

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
	const width = 88;
	const height = 26;
	const points = buildSparklinePoints(data.length > 1 ? data : [0, 0], width, height);
	const path = sparklinePath(points);

	if (path.length === 0) {
		return <div className="h-[26px] w-[88px] rounded bg-muted/40" />;
	}

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			aria-label="Tendance 7 jours"
		>
			<path
				d={path}
				fill="none"
				stroke={positive ? "#10B981" : "#EF4444"}
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function AccountIcon({ type }: { type: "CEX" | "Wallet" }) {
	if (type === "Wallet") return <HardDrive className="h-4 w-4" />;
	return <Building2 className="h-4 w-4" />;
}

export function CryptoList({
	onSelectCrypto,
	onSelectAccount,
	detailMode = "external",
}: CryptoListProps) {
	const {
		assets,
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
	const [searchQuery, setSearchQuery] = useState("");
	const [hideSmallBalances, setHideSmallBalances] = useState(false);
	const [groupBy, setGroupBy] = useState<GroupByMode>("account");
	const [sortBy, setSortBy] = useState("value-desc");
	const [filterExchange, setFilterExchange] = useState("all");
	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
	const [distributionView, setDistributionView] = useState<DistributionView>("pie");
	const [distributionGroup, setDistributionGroup] = useState<DistributionGroup>("crypto");
	const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CryptoHolding | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [editTarget, setEditTarget] = useState<CryptoHolding | null>(null);
	const [editQuantity, setEditQuantity] = useState("");
	const [editAverageBuyPrice, setEditAverageBuyPrice] = useState("");
	const [isSavingEdit, setIsSavingEdit] = useState(false);
	const [editTransactionTarget, setEditTransactionTarget] = useState<{
		id: string;
		quantity: string;
		unitPriceAmount: string;
		executedAt: string;
		notes: string;
	} | null>(null);
	const { currency, formatCurrency } = useCurrency();
	const [updateTransactionMutation, { loading: isSavingTransactionEdit }] =
		useMutation(UPDATE_TRANSACTION);

	const cryptoHoldings = useMemo((): CryptoHolding[] => {
		return assets
			.filter((asset) => asset.type === "crypto")
			.map((asset) => {
				const quantity = Number.isFinite(asset.quantity) && asset.quantity > 0 ? asset.quantity : 0;
				const averageBuyPrice = Number.isFinite(asset.purchasePrice) ? asset.purchasePrice : 0;
				const currentPrice = Number.isFinite(asset.currentPrice) ? asset.currentPrice : 0;
				const value = Number.isFinite(asset.currentValue) ? asset.currentValue : 0;
				const cost = averageBuyPrice * quantity;
				const profitLoss = value - cost;
				const profitLossPercent = cost > 0 ? (profitLoss / cost) * 100 : 0;
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
			})
			.sort((a, b) => b.value - a.value);
	}, [assets]);

	const filteredHoldings = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		const rows = cryptoHoldings.filter((holding) => {
			if (hideSmallBalances && holding.value < 1) return false;
			if (filterExchange !== "all" && holding.accountName !== filterExchange) return false;
			if (!normalizedQuery) return true;

			return (
				holding.symbol.toLowerCase().includes(normalizedQuery) ||
				holding.cryptoName.toLowerCase().includes(normalizedQuery) ||
				holding.accountName.toLowerCase().includes(normalizedQuery)
			);
		});

		if (sortBy === "value-desc") rows.sort((a, b) => b.value - a.value);
		else if (sortBy === "value-asc") rows.sort((a, b) => a.value - b.value);
		else if (sortBy === "profit-desc") rows.sort((a, b) => b.profitLoss - a.profitLoss);
		else if (sortBy === "profit-asc") rows.sort((a, b) => a.profitLoss - b.profitLoss);
		else if (sortBy === "name-asc") rows.sort((a, b) => a.cryptoName.localeCompare(b.cryptoName));

		return rows;
	}, [cryptoHoldings, searchQuery, hideSmallBalances, filterExchange, sortBy]);

	const uniqueExchanges = useMemo(
		() => [...new Set(cryptoHoldings.map((holding) => holding.accountName))],
		[cryptoHoldings],
	);

	const groupedByAccount = useMemo(() => {
		const grouped: Record<string, CryptoHolding[]> = {};
		filteredHoldings.forEach((holding) => {
			if (!grouped[holding.accountName]) grouped[holding.accountName] = [];
			grouped[holding.accountName].push(holding);
		});
		return grouped;
	}, [filteredHoldings]);

	const aggregatedByAsset = useMemo(() => {
		const aggregated: Record<
			string,
			{
				cryptoId: string;
				cryptoName: string;
				symbol: string;
				quantity: number;
				value: number;
				cost: number;
				profitLoss: number;
				profitLossPercent: number;
				currentPrice: number;
				change24h: number;
				sparklineData: number[];
				icon: string;
				color: string;
				accounts: string[];
			}
		> = {};

		filteredHoldings.forEach((holding) => {
			if (!aggregated[holding.symbol]) {
				aggregated[holding.symbol] = {
					cryptoId: holding.cryptoId,
					cryptoName: holding.cryptoName,
					symbol: holding.symbol,
					quantity: 0,
					value: 0,
					cost: 0,
					profitLoss: 0,
					profitLossPercent: 0,
					currentPrice: holding.currentPrice,
					change24h: holding.change24h,
					sparklineData: holding.sparklineData,
					icon: holding.icon,
					color: holding.color,
					accounts: [],
				};
			}

			aggregated[holding.symbol].quantity += holding.quantity;
			aggregated[holding.symbol].value += holding.value;
			aggregated[holding.symbol].cost += holding.cost;
			aggregated[holding.symbol].profitLoss += holding.profitLoss;
			aggregated[holding.symbol].accounts.push(holding.accountName);
		});

		return Object.values(aggregated)
			.map((asset) => ({
				...asset,
				profitLossPercent: asset.cost > 0 ? (asset.profitLoss / asset.cost) * 100 : 0,
			}))
			.sort((a, b) => b.value - a.value);
	}, [filteredHoldings]);

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

	const selectCrypto = (holding: CryptoHolding) => {
		if (detailMode === "panel") {
			setSelectedHoldingId(holding.id);
			return;
		}
		onSelectCrypto(holding.cryptoId);
	};

	const openEditDialog = (holding: CryptoHolding) => {
		setEditTarget(holding);
		setEditQuantity(String(holding.quantity));
		setEditAverageBuyPrice(String(holding.averageBuyPrice));
	};

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
			toast.error("La quantité doit être supérieure à 0.");
			return;
		}
		if (!Number.isFinite(averageBuyPrice) || averageBuyPrice < 0) {
			toast.error("Le prix moyen doit être supérieur ou égal à 0.");
			return;
		}

		setIsSavingEdit(true);
		try {
			await updateAsset(editTarget.id, {
				portfolioId: currentPortfolio || undefined,
				quantity,
				averagePurchasePrice: averageBuyPrice,
			});
			toast.success(`${editTarget.symbol} mis à jour.`);
			closeEditDialog();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Échec de la mise à jour.";
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
			toast.success(`${deleteTarget.symbol} supprimé du portefeuille.`);
			if (selectedHoldingId === deleteTarget.id) {
				setSelectedHoldingId(null);
			}
			setDeleteTarget(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Échec de la suppression.";
			toast.error(message);
		} finally {
			setIsDeleting(false);
		}
	};

	const openTransactionEditDialog = (row: Record<string, unknown>) => {
		const id = typeof row.id === "string" ? row.id : "";
		if (!id) {
			toast.error("Transaction introuvable.");
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
			toast.error("La quantité de transaction doit être supérieure à 0.");
			return;
		}
		if (!Number.isFinite(unitPriceAmount) || unitPriceAmount <= 0) {
			toast.error("Le prix unitaire doit être supérieur à 0.");
			return;
		}

		const executedAtDate = new Date(editTransactionTarget.executedAt);
		if (Number.isNaN(executedAtDate.getTime())) {
			toast.error("Date de transaction invalide.");
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
			toast.success("Transaction mise à jour.");
			closeTransactionEditDialog();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Échec de la mise à jour de transaction.";
			toast.error(message);
		}
	};

	const computedTotalValue = cryptoHoldings.reduce((sum, holding) => sum + holding.value, 0);
	const computedTotalCost = cryptoHoldings.reduce((sum, holding) => sum + holding.cost, 0);
	const backendTotalValue =
		typeof selectedPortfolio?.analytics?.totalValue === "number" &&
		Number.isFinite(selectedPortfolio.analytics.totalValue)
			? selectedPortfolio.analytics.totalValue
			: null;
	const backendTotalCost =
		typeof selectedPortfolio?.analytics?.totalCost === "number" &&
		Number.isFinite(selectedPortfolio.analytics.totalCost)
			? selectedPortfolio.analytics.totalCost
			: null;
	const backendTotalGainLoss =
		typeof selectedPortfolio?.analytics?.totalGainLoss === "number" &&
		Number.isFinite(selectedPortfolio.analytics.totalGainLoss)
			? selectedPortfolio.analytics.totalGainLoss
			: null;
	const backendTotalGainLossPercent =
		typeof selectedPortfolio?.analytics?.totalGainLossPercent === "number" &&
		Number.isFinite(selectedPortfolio.analytics.totalGainLossPercent)
			? selectedPortfolio.analytics.totalGainLossPercent
			: null;
	const totalValue = backendTotalValue ?? computedTotalValue;
	const totalCost = backendTotalCost ?? computedTotalCost;
	const coveredValueForCost = cryptoHoldings.reduce(
		(sum, holding) => (holding.cost > 0 && holding.value > 0 ? sum + holding.value : sum),
		0,
	);
	const costCoverageRatio = computedTotalValue > 0 ? coveredValueForCost / computedTotalValue : 0;
	const hasBackendCostBasis =
		backendTotalCost !== null &&
		backendTotalGainLoss !== null &&
		backendTotalGainLossPercent !== null;
	const hasReliableCostBasis =
		hasBackendCostBasis || (computedTotalCost > 0 && costCoverageRatio >= 0.35);
	const computedLatentPnL = computedTotalValue - computedTotalCost;
	const latentPnL = hasBackendCostBasis
		? backendTotalGainLoss
		: hasReliableCostBasis
			? computedLatentPnL
			: null;
	const latentPnLPercent = hasBackendCostBasis
		? backendTotalGainLossPercent
		: hasReliableCostBasis && computedTotalCost > 0
			? (computedLatentPnL / computedTotalCost) * 100
			: null;

	const bestPerformer =
		cryptoHoldings.length > 0
			? [...cryptoHoldings].sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]
			: null;
	const realizedPnL = useMemo(() => {
		if (!Array.isArray(transactions)) return 0;

		return transactions.reduce((sum: number, transaction: { type?: string; total?: number }) => {
			if (transaction?.type === "sell" && Number.isFinite(transaction.total)) {
				return sum + Math.abs(transaction.total ?? 0);
			}
			return sum;
		}, 0);
	}, [transactions]);

	const totalValueText = useMemo(() => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(totalValue);
	}, [currency, totalValue]);
	const totalValueParts = splitCurrencyParts(totalValueText);
	const backendHistory = useMemo(() => {
		const incoming = selectedPortfolio?.analytics?.performanceHistory;
		if (!Array.isArray(incoming)) return [] as PortfolioHistoryPoint[];

		return incoming
			.map((point: { date?: string | Date; value?: number }) => {
				const date = point?.date ? new Date(point.date) : new Date("");
				const value =
					typeof point?.value === "number" && Number.isFinite(point.value) ? point.value : NaN;
				return { date, value };
			})
			.filter(
				(point) =>
					Number.isFinite(point.value) &&
					point.date instanceof Date &&
					!Number.isNaN(point.date.getTime()),
			)
			.sort((a, b) => a.date.getTime() - b.date.getTime());
	}, [selectedPortfolio?.analytics?.performanceHistory]);
	const backendHistoryForRange = useMemo(
		() => filterHistoryByRange(backendHistory, timeRange),
		[backendHistory, timeRange],
	);
	const marketBasedHistoryFallback = useMemo(() => {
		const points = getHistoryPointCount(timeRange);
		const now = new Date();
		const weightedSeries = cryptoHoldings
			.filter((holding) => holding.value > 0)
			.map((holding) => {
				const source =
					holding.sparklineData.length >= 2
						? holding.sparklineData
						: computeFallbackSparkline(holding.currentPrice, holding.change24h);
				const sampled = resampleSeries(
					source.map((value) => (Number.isFinite(value) && value > 0 ? value : 1)),
					points,
				);
				const last = sampled[sampled.length - 1] || 1;
				return {
					weight: holding.value,
					normalized: sampled.map((value) => value / last),
				};
			});

		if (weightedSeries.length === 0 || totalValue <= 0) {
			return Array.from({ length: points }, (_, index) => ({
				date: buildHistoryDate(now, timeRange, points, index),
				value: totalValue,
			}));
		}

		const totalWeight = weightedSeries.reduce((sum, row) => sum + row.weight, 0);
		const history = Array.from({ length: points }, (_, index) => {
			const blendedIndex =
				weightedSeries.reduce((sum, row) => sum + row.weight * row.normalized[index], 0) /
				totalWeight;
			return {
				date: buildHistoryDate(now, timeRange, points, index),
				value: Math.max(0, totalValue * blendedIndex),
			};
		});

		history[history.length - 1] = {
			...history[history.length - 1],
			value: totalValue,
		};
		return history;
	}, [cryptoHoldings, timeRange, totalValue]);

	const portfolioHistory = useMemo(
		() =>
			backendHistoryForRange.length >= 2 ? backendHistoryForRange : marketBasedHistoryFallback,
		[backendHistoryForRange, marketBasedHistoryFallback],
	);
	const periodStartValue = portfolioHistory[0]?.value ?? totalValue;
	const periodChange = totalValue - periodStartValue;
	const periodChangePercent = periodStartValue > 0 ? (periodChange / periodStartValue) * 100 : 0;

	const performanceChartOption = useMemo(() => {
		const labels = portfolioHistory.map((point) => formatHistoryLabel(point, timeRange));
		return {
			tooltip: {
				trigger: "axis",
				backgroundColor: "rgba(15, 23, 42, 0.95)",
				borderColor: "rgba(148, 163, 184, 0.35)",
				textStyle: { color: "#F8FAFC" },
				formatter: (params: Array<{ axisValue: string; value: number; dataIndex: number }>) => {
					const point = portfolioHistory[params[0]?.dataIndex];
					const dateLabel = point
						? point.date.toLocaleDateString("fr-FR", {
								day: "numeric",
								month: "long",
								year: "numeric",
							})
						: params[0]?.axisValue;
					const valueText = formatCurrency(params[0]?.value ?? 0);
					return `${dateLabel} - ${valueText}`;
				},
				axisPointer: {
					type: "cross",
					lineStyle: {
						color: "rgba(148, 163, 184, 0.65)",
						type: "dashed",
					},
				},
			},
			grid: {
				left: 8,
				right: 8,
				top: 12,
				bottom: 8,
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: labels,
				boundaryGap: false,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: {
					show: false,
				},
			},
			yAxis: {
				type: "value",
				scale: true,
				splitNumber: 4,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { show: false },
				splitLine: {
					lineStyle: {
						color: "rgba(148, 163, 184, 0.16)",
					},
				},
			},
			series: [
				{
					name: "Portfolio",
					type: "line",
					smooth: true,
					showSymbol: false,
					lineStyle: {
						color: "#10B981",
						width: 2.2,
					},
					areaStyle: {
						color: {
							type: "linear",
							x: 0,
							y: 0,
							x2: 0,
							y2: 1,
							colorStops: [
								{ offset: 0, color: "rgba(16, 185, 129, 0.35)" },
								{ offset: 1, color: "rgba(16, 185, 129, 0.02)" },
							],
						},
					},
					data: portfolioHistory.map((point) => point.value),
				},
			],
		};
	}, [portfolioHistory, timeRange, formatCurrency]);

	const distributionData = useMemo(() => {
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
		const grouped = new Map<string, { value: number; color: string }>();

		cryptoHoldings.forEach((holding, index) => {
			let key = holding.symbol;
			let color = holding.color;

			if (distributionGroup === "account") {
				key = holding.accountName;
				color = accountPalette[index % accountPalette.length];
			} else if (distributionGroup === "type") {
				key = holding.accountType;
				color = typeColors[holding.accountType] ?? "#94A3B8";
			}

			const existing = grouped.get(key);
			if (existing) {
				existing.value += holding.value;
				return;
			}
			grouped.set(key, { value: holding.value, color });
		});

		return [...grouped.entries()]
			.map(([label, row]) => ({
				label,
				value: row.value,
				percent: (row.value / totalValue) * 100,
				color: row.color,
			}))
			.sort((a, b) => b.value - a.value);
	}, [cryptoHoldings, distributionGroup, totalValue]);

	const distributionPieOption = useMemo(() => {
		return {
			tooltip: { trigger: "item" },
			series: [
				{
					type: "pie",
					radius: ["56%", "78%"],
					center: ["50%", "48%"],
					label: { show: false },
					labelLine: { show: false },
					itemStyle: {
						borderWidth: 2,
						borderColor: "rgba(15, 23, 42, 0.7)",
					},
					data: distributionData.map((slice) => ({
						name: slice.label,
						value: slice.value,
						itemStyle: { color: slice.color },
					})),
				},
			],
		};
	}, [distributionData]);

	const distributionHeatmapOption = useMemo(() => {
		return {
			tooltip: {
				formatter: (params: { name?: string; value?: number }) =>
					`${params.name ?? "-"}<br/>${formatCurrency(params.value ?? 0)}`,
			},
			series: [
				{
					type: "treemap",
					top: 2,
					left: 2,
					right: 2,
					bottom: 2,
					label: {
						show: true,
						formatter: (params: { name?: string; value?: number }) =>
							`${params.name ?? ""}\n${formatCurrency(params.value ?? 0)}`,
						fontSize: 11,
						color: "#F8FAFC",
					},
					breadcrumb: { show: false },
					data: distributionData.map((slice) => ({
						name: slice.label,
						value: Math.max(0, slice.value),
						itemStyle: { color: slice.color, borderColor: "rgba(15,23,42,0.7)", borderWidth: 2 },
					})),
				},
			],
		};
	}, [distributionData, formatCurrency]);

	const dryPowderValue = cryptoHoldings
		.filter((holding) => STABLE_SYMBOLS.has(holding.symbol))
		.reduce((sum, holding) => sum + holding.value, 0);
	const dryPowderPercent = totalValue > 0 ? Math.min(100, (dryPowderValue / totalValue) * 100) : 0;
	const ath = portfolioHistory.reduce((max, point) => Math.max(max, point.value), 0);
	const athDistancePercent = ath > 0 ? ((totalValue - ath) / ath) * 100 : 0;
	const inProfitCount = cryptoHoldings.filter((holding) => holding.profitLoss > 0).length;
	const hasActiveFilters =
		filterExchange !== "all" || searchQuery.trim().length > 0 || hideSmallBalances;
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
		cryptoHoldings.length > 0
			? [...cryptoHoldings].sort((a, b) => a.profitLossPercent - b.profitLossPercent)[0]
			: null;
	const today = new Date();
	const firstBuyDate = dcaBuyDates[0] ?? null;
	const anniversaryYears = firstBuyDate ? today.getFullYear() - firstBuyDate.getFullYear() : 0;
	const isFirstBuyAnniversary =
		Boolean(firstBuyDate) &&
		anniversaryYears >= 1 &&
		firstBuyDate?.getDate() === today.getDate() &&
		firstBuyDate?.getMonth() === today.getMonth();
	const allTimeReturnPercent =
		hasReliableCostBasis && totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;
	const hasBackendHistory = backendHistory.length >= 2;
	const isNewAthMilestone = useMemo(() => {
		if (!hasBackendHistory) return false;
		const values = backendHistory.map((point) => point.value);
		if (values.length < 2) return false;
		const last = values[values.length - 1];
		const previousMax = Math.max(...values.slice(0, -1));
		return Number.isFinite(last) && Number.isFinite(previousMax) && last > previousMax * 1.0001;
	}, [backendHistory, hasBackendHistory]);

	const prioritizedInsightCards = useMemo<PrioritizedInsightCard[]>(() => {
		const cards: PrioritizedInsightCard[] = [];

		cards.push({
			id: "distribution",
			priority: 100,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<CardTitle className="text-sm font-semibold tracking-tight">Distribution</CardTitle>
							<div className="flex items-center gap-2">
								<Select
									value={distributionGroup}
									onValueChange={(value) => setDistributionGroup(value as DistributionGroup)}
								>
									<SelectTrigger className="h-8 w-[140px] text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="crypto">Par crypto</SelectItem>
										<SelectItem value="account">Par compte</SelectItem>
										<SelectItem value="type">Par type</SelectItem>
									</SelectContent>
								</Select>
								<div className="inline-flex items-center gap-1 rounded-md border border-border/60 p-1">
									<Button
										size="sm"
										variant={distributionView === "pie" ? "secondary" : "ghost"}
										className="h-7 px-2"
										onClick={() => setDistributionView("pie")}
									>
										<PieChart className="h-3.5 w-3.5" />
									</Button>
									<Button
										size="sm"
										variant={distributionView === "heatmap" ? "secondary" : "ghost"}
										className="h-7 px-2"
										onClick={() => setDistributionView("heatmap")}
									>
										<LayoutGrid className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<ReactECharts
							option={
								distributionView === "pie" ? distributionPieOption : distributionHeatmapOption
							}
							style={{ height: "170px", width: "100%" }}
							opts={{ renderer: "svg" }}
						/>
						<div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							{distributionData.slice(0, 6).map((slice) => (
								<div key={slice.label} className="flex items-center gap-1.5">
									<span
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: slice.color }}
									/>
									<span className="font-medium text-foreground">{slice.label}</span>
									<span>{slice.percent.toFixed(0)}%</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			),
		});

		cards.push({
			id: "liquidity",
			priority: dryPowderPercent === 0 ? 84 : 52,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-semibold tracking-tight">
							Liquidité & Drawdown
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 pt-0 text-sm">
						{dryPowderPercent === 0 ? (
							<div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
								<p className="flex items-center gap-2 font-medium">
									<AlertTriangle className="h-4 w-4" />
									Poudre sèche épuisée
								</p>
								<p className="mt-1 text-xs text-amber-100/90">Vous êtes exposé à 100% au marché.</p>
							</div>
						) : (
							<div>
								<p className="mb-2 text-muted-foreground">Liquidité disponible (Dry Powder)</p>
								<Progress value={dryPowderPercent} className="h-2.5" />
								<p className="mt-2 font-mono text-xs text-muted-foreground">
									{formatCurrency(dryPowderValue)} en stablecoins
								</p>
							</div>
						)}
						<div className="flex items-center justify-between border-t border-border/50 pt-3">
							<span className="text-muted-foreground">Distance de l'ATH</span>
							<span
								className={cn(
									"font-mono font-semibold",
									athDistancePercent <= 0 ? "text-rose-500" : "text-emerald-500",
								)}
							>
								{athDistancePercent >= 0 ? "+" : ""}
								{athDistancePercent.toFixed(2)}%
							</span>
						</div>
					</CardContent>
				</Card>
			),
		});

		cards.push({
			id: "success-ratio",
			priority: 31,
			node: (
				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-semibold tracking-tight">Ratio de Succès</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="text-muted-foreground text-sm">Positions en profit</p>
						<p className="font-mono text-4xl font-bold tracking-tight">
							{inProfitCount} / {cryptoHoldings.length}
						</p>
						<p className="mt-2 text-xs text-muted-foreground">Basé sur le prix d'achat moyen</p>
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
							<CardTitle className="text-sm font-semibold tracking-tight">
								Impact des Frais
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-muted-foreground text-sm">Frais cumulés de trading</p>
							<p className="font-mono text-3xl font-bold">{formatCurrency(cumulativeFees)}</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{feeWeight.toFixed(2)}% de la valeur actuelle du portefeuille.
							</p>
						</CardContent>
					</Card>
				),
			});
		} else {
			const cadenceLabel =
				averageDaysBetweenBuys === null
					? "Pas assez d'historique"
					: averageDaysBetweenBuys <= 10
						? "Rythme régulier"
						: averageDaysBetweenBuys <= 21
							? "Rythme modéré"
							: "Rythme opportuniste";
			cards.push({
				id: "dca-rhythm",
				priority: 47,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">
								Rythme d'investissement (DCA)
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="font-mono text-3xl font-bold">{dcaLast30Count} achats / 30j</p>
							<p className="mt-2 text-xs text-muted-foreground">
								{averageDaysBetweenBuys === null
									? "Ajoutez plus de transactions d'achat pour mesurer la régularité."
									: `Intervalle moyen: ${averageDaysBetweenBuys.toFixed(1)} jours.`}
							</p>
							<p className="mt-1 text-xs text-foreground/80">{cadenceLabel}</p>
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
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">
								Alerte de Concentration
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-sm text-muted-foreground">
								Portefeuille concentré sur peu de lignes.
							</p>
							<p className="mt-2 font-mono text-3xl font-bold">
								{cryptoHoldings[0]?.symbol ?? "-"} {concentrationShare.toFixed(0)}%
							</p>
							<p className="mt-2 text-xs text-muted-foreground">
								La première position porte l'essentiel du risque.
							</p>
						</CardContent>
					</Card>
				),
			});
		} else {
			cards.push({
				id: "top-flop",
				priority: 58,
				node: (
					<Card className="border-border/60 bg-card/90">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight">
								Locomotives et Boulets
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-0 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Top performeur</span>
								<span className="font-mono font-semibold text-emerald-500">
									{bestPerformer
										? `${bestPerformer.symbol} (${bestPerformer.profitLossPercent >= 0 ? "+" : ""}${bestPerformer.profitLossPercent.toFixed(1)}%)`
										: "-"}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Flop</span>
								<span className="font-mono font-semibold text-rose-500">
									{worstPerformer
										? `${worstPerformer.symbol} (${worstPerformer.profitLossPercent >= 0 ? "+" : ""}${worstPerformer.profitLossPercent.toFixed(1)}%)`
										: "-"}
								</span>
							</div>
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
							<CardTitle className="text-sm font-semibold tracking-tight">PnL Réalisé</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
								<p className="text-sm text-muted-foreground">
									Vous n'avez pas encore sécurisé de profits.
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Pensez à définir vos paliers de vente.
								</p>
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
							<CardTitle className="text-sm font-semibold tracking-tight">
								Analyse des Frais
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-sm text-muted-foreground">
								Connectez Binance ou Kraken pour débloquer l'analyse de vos frais de trading.
							</p>
							<Button
								size="sm"
								className="mt-3"
								onClick={() => toast.info("Connexion exchange: bientôt disponible")}
							>
								Connecter un exchange
								<ArrowRight className="ml-2 h-4 w-4" />
							</Button>
						</CardContent>
					</Card>
				),
			});
		}

		if (isFirstBuyAnniversary) {
			cards.push({
				id: "birthday-milestone",
				priority: 96,
				node: (
					<Card className="border-emerald-500/40 bg-emerald-500/10">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight text-emerald-300">
								Milestone
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
								<CalendarDays className="h-4 w-4" />🎂 Votre portefeuille a {anniversaryYears} an
								{anniversaryYears > 1 ? "s" : ""} aujourd'hui
							</p>
							{allTimeReturnPercent !== null && (
								<p className="mt-2 font-mono text-lg font-semibold text-emerald-200">
									Résultat: {allTimeReturnPercent >= 0 ? "+" : ""}
									{allTimeReturnPercent.toFixed(2)}%
								</p>
							)}
						</CardContent>
					</Card>
				),
			});
		}

		if (isNewAthMilestone) {
			cards.push({
				id: "ath-milestone",
				priority: 92,
				node: (
					<Card className="border-amber-500/40 bg-amber-500/10">
						<CardHeader className="pb-3">
							<CardTitle className="text-sm font-semibold tracking-tight text-amber-300">
								Nouveau Record
							</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="flex items-center gap-2 text-sm font-medium text-amber-200">
								<Trophy className="h-4 w-4" />🏆 Nouveau sommet historique franchi.
							</p>
							<p className="mt-2 font-mono text-lg font-semibold text-amber-200">
								{formatCurrency(totalValue)}
							</p>
						</CardContent>
					</Card>
				),
			});
		}

		return cards.sort((a, b) => b.priority - a.priority).slice(0, 3);
	}, [
		allTimeReturnPercent,
		anniversaryYears,
		athDistancePercent,
		bestPerformer,
		concentrationShare,
		cryptoHoldings,
		cumulativeFees,
		dcaLast30Count,
		dryPowderPercent,
		dryPowderValue,
		distributionData,
		distributionGroup,
		distributionHeatmapOption,
		distributionPieOption,
		distributionView,
		formatCurrency,
		hasConnectedExchange,
		hasSellTransaction,
		inProfitCount,
		isFirstBuyAnniversary,
		isNewAthMilestone,
		averageDaysBetweenBuys,
		totalValue,
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

	if (cryptoHoldings.length === 0) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
						<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
							<span>🟢</span>
							<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
							Dernière synchro : à l'instant
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							className="h-10 px-4 border-border/60 bg-transparent"
							onClick={() => toast.info("Bientot disponible")}
						>
							<Upload className="mr-2 h-4 w-4" />
							Importer Wallet
						</Button>
						<Button
							className="h-10 px-4 bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
							onClick={() => setShowAddForm(true)}
						>
							<Plus className="mr-2 h-4 w-4" />
							Nouvelle Transaction
						</Button>
					</div>
				</div>
				<div className="py-16 text-center">
					<Coins className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
					<h2 className="mb-2 text-2xl font-bold">Aucune position crypto</h2>
					<p className="mx-auto mb-6 max-w-md text-muted-foreground">
						Ajoute une première position pour afficher performance, insights et tableau des actifs.
					</p>
					<Button onClick={() => setShowAddForm(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Ajouter une crypto
					</Button>
				</div>

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
			<div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Portfolio</h1>
					<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
						<span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
						Dernière synchro : à l'instant
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="outline"
						className="h-10 px-4 border-border/60 bg-transparent"
						onClick={() => toast.info("Bientot disponible")}
					>
						<Upload className="mr-2 h-4 w-4" />
						Importer Wallet
					</Button>
					<Button
						className="h-10 px-4 bg-white text-black hover:bg-white/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
						onClick={() => setShowAddForm(true)}
					>
						<Plus className="mr-2 h-4 w-4" />
						Nouvelle Transaction
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
				<Card className="xl:col-span-2 border-border/60 bg-gradient-to-br from-card to-secondary/10">
					<CardHeader className="space-y-4 pb-2">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div>
								<CardDescription>Performance du portefeuille</CardDescription>
								<h2 className="font-mono text-4xl font-bold tracking-tight">
									{totalValueParts.main}
									<span className="ml-0.5 text-[0.8em] font-medium text-muted-foreground">
										{totalValueParts.cents}
									</span>
								</h2>
								<p className="mt-1 font-mono text-sm text-emerald-500">
									{periodChange >= 0 ? "+" : ""}
									{formatCurrency(periodChange)} ({periodChange >= 0 ? "+" : ""}
									{periodChangePercent.toFixed(2)}%)
								</p>
							</div>
							<div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1.5">
								{TIME_RANGES.map((range) => (
									<Button
										key={range}
										variant={timeRange === range ? "secondary" : "ghost"}
										size="sm"
										className={cn(
											"h-7 rounded-md px-2.5 text-[11px]",
											timeRange === range
												? "bg-slate-300 text-slate-900 hover:bg-slate-200 dark:bg-slate-600 dark:text-slate-100"
												: "text-muted-foreground",
										)}
										onClick={() => setTimeRange(range)}
									>
										{range}
									</Button>
								))}
							</div>
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<ReactECharts
							option={performanceChartOption}
							notMerge={true}
							lazyUpdate={true}
							style={{ height: "290px", width: "100%" }}
							opts={{ renderer: "svg" }}
						/>
					</CardContent>
				</Card>

				<Card className="border-border/60 bg-card/90">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-semibold tracking-tight">
							Portfolio Summary
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 pt-0 text-sm">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Capital investi</span>
							<span className="font-mono font-semibold">
								{hasReliableCostBasis ? formatCurrency(totalCost) : "--"}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">PnL Réalisé</span>
							<span className="font-mono font-semibold text-emerald-500">
								+{formatCurrency(realizedPnL)}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">PnL Latent</span>
							{latentPnL === null || latentPnLPercent === null ? (
								<span className="font-mono text-muted-foreground">--</span>
							) : (
								<span
									className={cn(
										"font-mono font-semibold",
										latentPnL >= 0 ? "text-emerald-500" : "text-rose-500",
									)}
								>
									{latentPnL >= 0 ? "+" : ""}
									{formatCurrency(latentPnL)} ({latentPnL >= 0 ? "+" : ""}
									{latentPnLPercent.toFixed(2)}%)
								</span>
							)}
						</div>
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Meilleur performeur</span>
							<span className="font-mono font-semibold text-emerald-500">
								{bestPerformer
									? `${bestPerformer.symbol} (${bestPerformer.profitLossPercent >= 0 ? "+" : ""}${bestPerformer.profitLossPercent.toFixed(0)}%)`
									: "-"}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{prioritizedInsightCards.map((card) => (
					<div key={card.id}>{card.node}</div>
				))}
			</div>

			<Card className="border-border/60 bg-card/95">
				<CardHeader className="space-y-4">
					<div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<CardTitle>Détail des actifs crypto</CardTitle>
							<CardDescription>
								Tri, filtre compte, groupement et actions rapides par ligne.
							</CardDescription>
						</div>
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<Badge variant="secondary">{filteredHoldings.length} positions</Badge>
							<Badge variant="outline">{formatCurrency(totalValue)} total</Badge>
							{hasActiveFilters && <Badge variant="outline">Filtres actifs</Badge>}
						</div>
					</div>

					<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_170px_auto]">
						<SearchInput
							placeholder="Rechercher un actif..."
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							onClear={() => setSearchQuery("")}
							containerClassName="w-full"
							className="h-10 border-transparent bg-[#1E293B] text-slate-100 placeholder:text-slate-400 focus-visible:border-border focus-visible:ring-1 focus-visible:ring-border"
						/>
						<Select value={filterExchange} onValueChange={setFilterExchange}>
							<SelectTrigger className="h-10">
								<SelectValue placeholder="Compte" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Tous les comptes</SelectItem>
								{uniqueExchanges.map((exchange) => (
									<SelectItem key={exchange} value={exchange}>
										{exchange}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="h-10">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="value-desc">Valeur (haut)</SelectItem>
								<SelectItem value="value-asc">Valeur (bas)</SelectItem>
								<SelectItem value="profit-desc">PnL (haut)</SelectItem>
								<SelectItem value="profit-asc">PnL (bas)</SelectItem>
								<SelectItem value="name-asc">Nom (A-Z)</SelectItem>
							</SelectContent>
						</Select>
						<div className="flex items-center gap-3 rounded-lg border border-border/60 px-3">
							<Switch checked={hideSmallBalances} onCheckedChange={setHideSmallBalances} />
							<span className="text-sm text-muted-foreground">Masquer &lt; 1$</span>
						</div>
					</div>

					<div className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 p-1">
						<Button
							size="sm"
							variant={groupBy === "account" ? "secondary" : "ghost"}
							className="h-8"
							onClick={() => setGroupBy("account")}
						>
							<Wallet className="mr-2 h-4 w-4" />
							Par compte
						</Button>
						<Button
							size="sm"
							variant={groupBy === "asset" ? "secondary" : "ghost"}
							className="h-8"
							onClick={() => setGroupBy("asset")}
						>
							<Coins className="mr-2 h-4 w-4" />
							Par actif
						</Button>
					</div>
				</CardHeader>

				<CardContent className="pt-0">
					{groupBy === "account" ? (
						<Accordion type="multiple" className="space-y-3">
							{Object.entries(groupedByAccount).map(([account, holdings]) => {
								const accountValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
								const accountPnL = holdings.reduce((sum, holding) => sum + holding.profitLoss, 0);
								const accountCost = accountValue - accountPnL;
								const accountPnLPercent = accountCost > 0 ? (accountPnL / accountCost) * 100 : 0;
								const accountType = holdings[0]?.accountType ?? "CEX";

								return (
									<AccordionItem
										key={account}
										value={account}
										className="overflow-hidden rounded-lg border border-border/60"
									>
										<AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
											<div className="flex w-full items-center justify-between pr-2">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
														<AccountIcon type={accountType} />
													</div>
													<div className="text-left">
														{/* biome-ignore lint/a11y/noStaticElementInteractions: table group title supports direct navigation */}
														{/* biome-ignore lint/a11y/useKeyWithClickEvents: table group title supports direct navigation */}
														<span
															className="cursor-pointer font-medium transition-colors hover:text-primary"
															onClick={(event) => {
																event.stopPropagation();
																onSelectAccount?.(account);
															}}
														>
															{account}
														</span>
														<p className="text-xs text-muted-foreground">
															{holdings.length} actif{holdings.length > 1 ? "s" : ""}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="font-mono">{formatCurrency(accountValue)}</p>
													<p
														className={cn(
															"font-mono text-sm",
															accountPnL >= 0 ? "text-emerald-500" : "text-rose-500",
														)}
													>
														{accountPnL >= 0 ? "+" : ""}
														{formatCurrency(accountPnL)} ({accountPnLPercent >= 0 ? "+" : ""}
														{accountPnLPercent.toFixed(2)}%)
													</p>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent className="border-t border-border/50 p-0">
											<div className="overflow-x-auto">
												<Table>
													<TableHeader>
														<TableRow className="hover:bg-transparent border-border/50">
															<TableHead className="h-11 text-left text-[12px] uppercase tracking-wider text-muted-foreground">
																Actif
															</TableHead>
															<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
																Prix
															</TableHead>
															<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
																Solde
															</TableHead>
															<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
																24H %
															</TableHead>
															<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
																Valeur Totale
															</TableHead>
															<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
																Tendance 7J
															</TableHead>
															<TableHead className="h-11 w-[56px]" />
														</TableRow>
													</TableHeader>
													<TableBody>
														{holdings.map((holding) => (
															<TableRow
																key={holding.id}
																className="h-16 cursor-pointer border-border/40 transition-colors hover:bg-[#1E293B]/55"
																onClick={() => selectCrypto(holding)}
															>
																<TableCell>
																	<div className="flex items-center gap-3">
																		<div
																			className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
																			style={{
																				backgroundColor: `${holding.color}1F`,
																				color: holding.color,
																			}}
																		>
																			{holding.icon}
																		</div>
																		<div className="leading-tight">
																			<p className="text-sm font-semibold">{holding.symbol}</p>
																			<p className="text-xs text-muted-foreground">
																				{holding.cryptoName}
																			</p>
																		</div>
																	</div>
																</TableCell>
																<TableCell className="text-right font-mono text-sm">
																	{formatCurrency(holding.currentPrice)}
																</TableCell>
																<TableCell className="text-right font-mono text-sm text-muted-foreground">
																	{holding.quantity.toLocaleString("en-US", {
																		maximumFractionDigits: 6,
																	})}
																</TableCell>
																<TableCell
																	className={cn(
																		"text-right font-mono text-sm",
																		holding.change24h >= 0 ? "text-emerald-500" : "text-rose-500",
																	)}
																>
																	{holding.change24h >= 0 ? "+" : ""}
																	{holding.change24h.toFixed(2)}%
																</TableCell>
																<TableCell className="text-right font-mono text-sm font-semibold">
																	{formatCurrency(holding.value)}
																</TableCell>
																<TableCell className="text-right">
																	<div className="ml-auto flex w-[90px] justify-end">
																		<Sparkline
																			data={holding.sparklineData.slice(-7)}
																			positive={
																				holding.sparklineData[holding.sparklineData.length - 1] >=
																				holding.sparklineData[0]
																			}
																		/>
																	</div>
																</TableCell>
																<TableCell className="text-right">
																	<DropdownMenu>
																		<DropdownMenuTrigger
																			asChild
																			onClick={(event) => event.stopPropagation()}
																		>
																			<Button variant="ghost" size="icon">
																				<MoreVertical className="h-4 w-4" />
																			</Button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent align="end">
																			<DropdownMenuItem
																				onClick={(event) => {
																					event.stopPropagation();
																					selectCrypto(holding);
																				}}
																			>
																				<Eye className="mr-2 h-4 w-4" />
																				Voir détail
																			</DropdownMenuItem>
																			<DropdownMenuItem
																				onClick={(event) => {
																					event.stopPropagation();
																					openEditDialog(holding);
																				}}
																			>
																				<Edit className="mr-2 h-4 w-4" />
																				Modifier
																			</DropdownMenuItem>
																			<DropdownMenuSeparator />
																			<DropdownMenuItem
																				className="text-destructive"
																				onClick={(event) => {
																					event.stopPropagation();
																					setDeleteTarget(holding);
																				}}
																			>
																				<Trash2 className="mr-2 h-4 w-4" />
																				Supprimer
																			</DropdownMenuItem>
																		</DropdownMenuContent>
																	</DropdownMenu>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</AccordionContent>
									</AccordionItem>
								);
							})}
						</Accordion>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent border-border/50">
										<TableHead className="h-11 text-left text-[12px] uppercase tracking-wider text-muted-foreground">
											Actif
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											Prix
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											Solde Total
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											24H %
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											Valeur Totale
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											Tendance 7J
										</TableHead>
										<TableHead className="h-11 text-right text-[12px] uppercase tracking-wider text-muted-foreground">
											Comptes
										</TableHead>
										<TableHead className="h-11 w-[56px]" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{aggregatedByAsset.map((asset) => (
										<TableRow
											key={asset.symbol}
											className="h-16 cursor-pointer border-border/40 transition-colors hover:bg-[#1E293B]/55"
											onClick={() => {
												const holding = filteredHoldings.find(
													(item) => item.symbol === asset.symbol,
												);
												if (!holding) return;
												selectCrypto(holding);
											}}
										>
											<TableCell>
												<div className="flex items-center gap-3">
													<div
														className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
														style={{ backgroundColor: `${asset.color}1F`, color: asset.color }}
													>
														{asset.icon}
													</div>
													<div className="leading-tight">
														<p className="text-sm font-semibold">{asset.symbol}</p>
														<p className="text-xs text-muted-foreground">{asset.cryptoName}</p>
													</div>
												</div>
											</TableCell>
											<TableCell className="text-right font-mono text-sm">
												{formatCurrency(asset.currentPrice)}
											</TableCell>
											<TableCell className="text-right font-mono text-sm text-muted-foreground">
												{asset.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })}
											</TableCell>
											<TableCell
												className={cn(
													"text-right font-mono text-sm",
													asset.change24h >= 0 ? "text-emerald-500" : "text-rose-500",
												)}
											>
												{asset.change24h >= 0 ? "+" : ""}
												{asset.change24h.toFixed(2)}%
											</TableCell>
											<TableCell className="text-right font-mono text-sm font-semibold">
												{formatCurrency(asset.value)}
											</TableCell>
											<TableCell className="text-right">
												<div className="ml-auto flex w-[90px] justify-end">
													<Sparkline
														data={asset.sparklineData.slice(-7)}
														positive={
															asset.sparklineData[asset.sparklineData.length - 1] >=
															asset.sparklineData[0]
														}
													/>
												</div>
											</TableCell>
											<TableCell className="text-right">
												<Badge variant="outline">{asset.accounts.length}</Badge>
											</TableCell>
											<TableCell className="text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
														<Button variant="ghost" size="icon">
															<MoreVertical className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={(event) => {
																event.stopPropagation();
																const holding = filteredHoldings.find(
																	(item) => item.symbol === asset.symbol,
																);
																if (!holding) return;
																selectCrypto(holding);
															}}
														>
															<Eye className="mr-2 h-4 w-4" />
															Voir détail
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={(event) => {
																event.stopPropagation();
																toast.info(
																	"Passe en vue 'Par compte' pour modifier une position précise.",
																);
															}}
														>
															<Edit className="mr-2 h-4 w-4" />
															Modifier
														</DropdownMenuItem>
														<DropdownMenuItem
															className="text-destructive"
															onClick={(event) => {
																event.stopPropagation();
																toast.info(
																	"Passe en vue 'Par compte' pour supprimer une position précise.",
																);
															}}
														>
															<Trash2 className="mr-2 h-4 w-4" />
															Supprimer
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem onClick={(event) => event.stopPropagation()}>
															<Wallet className="mr-2 h-4 w-4" />
															Voir comptes
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

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
			<ConfirmationDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !isDeleting) setDeleteTarget(null);
				}}
				title="Supprimer la position ?"
				description={
					deleteTarget
						? `Retirer ${deleteTarget.symbol} (${deleteTarget.cryptoName}) de votre portefeuille. Cette action est irréversible.`
						: "Cette action est irréversible."
				}
				confirmText={isDeleting ? "Suppression..." : "Supprimer"}
				cancelText="Annuler"
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
						<DialogTitle>Modifier la position</DialogTitle>
						<DialogDescription>
							{editTarget ? `${editTarget.symbol} · ${editTarget.cryptoName}` : ""}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label htmlFor="edit-quantity">Quantité</Label>
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
							<Label htmlFor="edit-average-buy-price">Prix d'achat moyen</Label>
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
							Annuler
						</Button>
						<Button onClick={() => void handleSaveEdit()} disabled={isSavingEdit}>
							{isSavingEdit ? "Enregistrement..." : "Enregistrer"}
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
						<DialogTitle>Modifier la transaction</DialogTitle>
						<DialogDescription>Mets à jour cette opération individuellement.</DialogDescription>
					</DialogHeader>
					{editTransactionTarget && (
						<div className="space-y-4 py-2">
							<div className="space-y-2">
								<Label htmlFor="tx-edit-quantity">Quantité</Label>
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
								<Label htmlFor="tx-edit-unit-price">Prix unitaire</Label>
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
								<Label htmlFor="tx-edit-date">Date d'exécution</Label>
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
								<Label htmlFor="tx-edit-notes">Note</Label>
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
							Annuler
						</Button>
						<Button
							onClick={() => void handleSaveTransactionEdit()}
							disabled={isSavingTransactionEdit}
						>
							{isSavingTransactionEdit ? "Enregistrement..." : "Enregistrer"}
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
							<SheetHeader className="sticky top-0 z-20 border-b border-border/60 bg-background px-6 py-4">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-center gap-3">
										<div
											className="flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold"
											style={{
												backgroundColor: `${selectedHolding.color}1F`,
												color: selectedHolding.color,
											}}
										>
											{selectedHolding.icon}
										</div>
										<div>
											<SheetTitle className="text-left text-base">
												{selectedHolding.symbol} {selectedHolding.cryptoName}
											</SheetTitle>
											<p className="text-xs text-muted-foreground">{selectedHolding.accountName}</p>
										</div>
									</div>
									<div className="text-right">
										<p className="font-mono text-lg font-semibold">
											{formatCurrency(selectedHolding.currentPrice)}
										</p>
										<p
											className={cn(
												"font-mono text-xs",
												selectedHolding.change24h >= 0 ? "text-emerald-500" : "text-rose-500",
											)}
										>
											{selectedHolding.change24h >= 0 ? "+" : ""}
											{selectedHolding.change24h.toFixed(2)}%
										</p>
									</div>
								</div>
							</SheetHeader>

							<div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
								<Tabs defaultValue="position" className="space-y-4">
									<TabsList className="grid w-full grid-cols-3">
										<TabsTrigger value="position">Ma Position</TabsTrigger>
										<TabsTrigger value="transactions">Transactions</TabsTrigger>
										<TabsTrigger value="token">Infos du Token</TabsTrigger>
									</TabsList>

									<TabsContent value="position" className="space-y-4">
										<Card className="border-border/60 bg-card/90">
											<CardContent className="space-y-3 pt-6">
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted-foreground">Solde</span>
													<span className="font-mono font-semibold">
														{selectedHolding.quantity.toLocaleString("en-US", {
															maximumFractionDigits: 6,
														})}{" "}
														{selectedHolding.symbol}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted-foreground">Valeur actuelle</span>
													<span className="font-mono font-semibold">
														{formatCurrency(selectedHolding.value)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted-foreground">Prix d'achat moyen</span>
													<span className="font-mono">
														{formatCurrency(selectedHolding.averageBuyPrice)}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-sm text-muted-foreground">PnL latent</span>
													<span
														className={cn(
															"font-mono font-semibold",
															selectedHolding.profitLoss >= 0
																? "text-emerald-500"
																: "text-rose-500",
														)}
													>
														{selectedHolding.profitLoss >= 0 ? "+" : ""}
														{formatCurrency(selectedHolding.profitLoss)} (
														{selectedHolding.profitLossPercent >= 0 ? "+" : ""}
														{selectedHolding.profitLossPercent.toFixed(2)}%)
													</span>
												</div>
											</CardContent>
										</Card>
										<Card className="border-border/60 bg-card/90">
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Performance de la position</CardTitle>
											</CardHeader>
											<CardContent className="pt-0">
												<div className="flex justify-center py-2">
													<Sparkline
														data={selectedHolding.sparklineData}
														positive={selectedHolding.change24h >= 0}
													/>
												</div>
											</CardContent>
										</Card>
									</TabsContent>

									<TabsContent value="transactions">
										<Card className="border-border/60 bg-card/90">
											<CardHeader className="pb-2">
												<CardTitle className="text-sm">Historique des transactions</CardTitle>
											</CardHeader>
											<CardContent className="pt-0">
												{selectedHoldingTransactions.length === 0 ? (
													<p className="text-sm text-muted-foreground">
														Aucune transaction liée détectée pour cet actif.
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
																			).toLocaleDateString("fr-FR")}
																		</span>
																		<Badge variant="outline" className="uppercase">
																			{typeLabel}
																		</Badge>
																	</div>
																	<div className="mt-2 grid grid-cols-2 gap-2 text-sm">
																		<div>
																			<p className="text-xs text-muted-foreground">Quantité</p>
																			<p className="font-mono">
																				{Number.isFinite(quantity)
																					? quantity.toLocaleString("en-US")
																					: "--"}
																			</p>
																		</div>
																		<div>
																			<p className="text-xs text-muted-foreground">Prix unitaire</p>
																			<p className="font-mono">
																				{Number.isFinite(unitPrice)
																					? formatCurrency(unitPrice)
																					: "--"}
																			</p>
																		</div>
																		<div className="col-span-2">
																			<p className="text-xs text-muted-foreground">Montant total</p>
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
																			Modifier
																		</Button>
																	</div>
																</div>
															);
														})}
													</div>
												)}
											</CardContent>
										</Card>
									</TabsContent>

									<TabsContent value="token">
										<Card className="border-border/60 bg-card/90">
											<CardContent className="space-y-3 pt-6 text-sm">
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Rang Market Cap</span>
													<span className="font-mono">-</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">ATH observé (local)</span>
													<span className="font-mono">
														{formatCurrency(Math.max(...selectedHolding.sparklineData))}
													</span>
												</div>
												<div className="flex items-center justify-between">
													<span className="text-muted-foreground">Distance ATH</span>
													<span className="font-mono text-rose-500">
														{(() => {
															const localAth = Math.max(...selectedHolding.sparklineData);
															if (!Number.isFinite(localAth) || localAth <= 0) return "--";
															const distance =
																((selectedHolding.currentPrice - localAth) / localAth) * 100;
															return `${distance >= 0 ? "+" : ""}${distance.toFixed(2)}%`;
														})()}
													</span>
												</div>
												<div className="pt-1">
													<a
														href={`https://www.coingecko.com/en/coins/${selectedHolding.symbol.toLowerCase()}`}
														target="_blank"
														rel="noreferrer"
														className="text-sm text-primary hover:underline"
													>
														Voir sur CoinGecko
													</a>
												</div>
											</CardContent>
										</Card>
									</TabsContent>
								</Tabs>
							</div>
						</div>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
