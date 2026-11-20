import { useQuery } from "@apollo/client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	Bath,
	Bed,
	Building2,
	Calendar,
	Check,
	ChevronDown,
	Coins,
	Eye,
	Filter,
	Home,
	Layers,
	List,
	MapPin,
	Maximize,
	MoreVertical,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	TrendingDown,
	TrendingUp,
	X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetHeroChart, buildPerformanceSeries } from "@/components/charts/AssetHeroChart";
import type { TimeRange } from "@/components/charts/PortfolioHeroChart";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { GET_SCOPED_PERFORMANCE_HISTORY } from "@/graphql/queries/portfolios";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { AssetPageHeader } from "../AssetPageHeader";
import { AddRealEstateForm, type AddRealEstateFormSubmitData } from "./AddRealEstateForm";
import { RealEstateDetail } from "./RealEstateDetail";
import {
	type ExposureDimension,
	type RealEstateExposureSlice,
	RealEstateExposureWidget,
} from "./RealEstateExposureWidget";

interface RealEstateListProps {
	onSelectProperty?: (propertyId: string) => void;
	detailMode?: "external" | "panel";
	onBack?: () => void;
}

type WorkspaceTab = "ledger" | "holdings";
type TableDensity = "compact" | "normal";

const TERMINAL_PALETTE = [
	"#3b82f6", // Blue
	"#10b981", // Emerald
	"#8b5cf6", // Purple
	"#f59e0b", // Amber
	"#06b6d4", // Cyan
	"#ec4899", // Pink
	"#64748b", // Slate
];

export function RealEstateList({
	onSelectProperty,
	detailMode = "panel",
	onBack,
}: RealEstateListProps) {
	const shouldReduceMotion = useReducedMotion();
	const {
		assets,
		addRealEstate,
		deleteAsset,
		currentPortfolio,
		selectedPortfolio,
		refetch,
		getPortfolioValue,
	} = usePortfolio();
	const { formatCurrency } = useCurrency();

	const portfolioId =
		typeof currentPortfolio === "string"
			? currentPortfolio
			: selectedPortfolio?.id || currentPortfolio?.id;

	// Component UI States
	const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
	const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("ledger");
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const [propertyToDelete, setPropertyToDelete] = useState<{ id: string; name: string } | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = useState(false);

	// Table Density
	const [density, setDensity] = useState<TableDensity>(() => {
		try {
			const saved = localStorage.getItem("sf_real_estate_table_density");
			return saved === "normal" ? "normal" : "compact";
		} catch {
			return "compact";
		}
	});

	const handleToggleDensity = () => {
		const next = density === "compact" ? "normal" : "compact";
		setDensity(next);
		try {
			localStorage.setItem("sf_real_estate_table_density", next);
		} catch {
			// ignore storage errors
		}
	};

	// Filters & Search
	const [searchTerm, setSearchTerm] = useState("");
	const [filterType, setFilterType] = useState<string>("all");
	const [sortBy, setSortBy] = useState<"value" | "gain" | "surface" | "name">("value");
	const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

	// Cross-filter from Exposure Widget
	const [activeExposureFilter, setActiveExposureFilter] = useState<string | null>(null);
	const [exposureDimension, setExposureDimension] = useState<ExposureDimension>("type");

	// Scoped Performance History query for HeroChart
	const { data: scopedHistoryData, loading: scopedHistoryLoading } = useQuery(
		GET_SCOPED_PERFORMANCE_HISTORY,
		{
			variables: {
				portfolioID: portfolioId,
				assetTypes: ["REAL_ESTATE"],
			},
			skip: !portfolioId,
			fetchPolicy: "cache-and-network",
			nextFetchPolicy: "cache-first",
		},
	);

	// All real estate assets
	const realEstateAssets = useMemo(() => {
		return assets.filter((asset) => asset.type === "real_estate");
	}, [assets]);

	// All loans for linked debt lookup
	const loans = useMemo(() => {
		return assets.filter((asset) => asset.type === "loan");
	}, [assets]);

	// Map of real estate asset id -> linked loan
	const propertyLoanMap = useMemo(() => {
		const map = new Map<string, (typeof loans)[0]>();
		for (const prop of realEstateAssets) {
			if (prop.linkedLoanId) {
				const loan = loans.find((l) => l.id === prop.linkedLoanId);
				if (loan) map.set(prop.id, loan);
			} else {
				const loan = loans.find((l) => (l as unknown as { linkedAssetIDs?: string[] }).linkedAssetIDs?.includes(prop.id));
				if (loan) map.set(prop.id, loan);
			}
		}
		return map;
	}, [realEstateAssets, loans]);

	// Valuation Mode: "gross" vs "net"
	const [valuationMode, setValuationMode] = useState<"gross" | "net">("gross");

	// Total values (prorated by ownership %)
	const totalGrossValue = useMemo(() => {
		return realEstateAssets.reduce((sum, a) => {
			const pct = typeof a.ownershipPercentage === "number" ? a.ownershipPercentage : 100;
			return sum + (a.currentValue || 0) * (pct / 100);
		}, 0);
	}, [realEstateAssets]);

	const totalDebt = useMemo(() => {
		return realEstateAssets.reduce((sum, a) => {
			const loan = propertyLoanMap.get(a.id);
			return sum + (loan ? (loan.remainingBalance ?? loan.loanAmount ?? 0) : 0);
		}, 0);
	}, [realEstateAssets, propertyLoanMap]);

	const totalNetEquity = Math.max(0, totalGrossValue - totalDebt);
	const totalLTV = totalGrossValue > 0 && totalDebt > 0 ? (totalDebt / totalGrossValue) * 100 : 0;
	const displayedHeroValue = valuationMode === "gross" ? totalGrossValue : totalNetEquity;
	const totalValue = totalGrossValue; // Fallback canonical alias

	const totalCost = useMemo(() => {
		return realEstateAssets.reduce((sum, a) => {
			const pct = typeof a.ownershipPercentage === "number" ? a.ownershipPercentage : 100;
			return sum + (a.purchasePrice || a.currentValue || 0) * (pct / 100);
		}, 0);
	}, [realEstateAssets]);

	const totalPortfolioValue = useMemo(() => {
		if (typeof getPortfolioValue === "function") {
			const val = getPortfolioValue();
			if (typeof val === "number" && val > 0) return val;
		}
		return assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
	}, [getPortfolioValue, assets]);

	const totalSurface = useMemo(() => {
		return realEstateAssets.reduce((sum, a) => sum + (a.surfaceArea || 0), 0);
	}, [realEstateAssets]);

	// Performance series for HeroChart
	const performanceData = useMemo(() => {
		const history = scopedHistoryData?.scopedPerformanceHistory ?? [];
		return buildPerformanceSeries(history, displayedHeroValue);
	}, [scopedHistoryData, displayedHeroValue]);

	// Chart holdings for HeroChart
	const chartHoldings = useMemo(() => {
		const denom = displayedHeroValue;
		return realEstateAssets.map((a) => {
			const pct = typeof a.ownershipPercentage === "number" ? a.ownershipPercentage : 100;
			const gross = (a.currentValue || 0) * (pct / 100);
			const loan = propertyLoanMap.get(a.id);
			const debt = loan ? (loan.remainingBalance ?? loan.loanAmount ?? 0) : 0;
			const val = valuationMode === "gross" ? gross : Math.max(0, gross - debt);

			return {
				symbol: a.symbol || a.name.slice(0, 4).toUpperCase(),
				name: a.name,
				weight: denom > 0 ? (val / denom) * 100 : 0,
				totalValue: val,
			};
		});
	}, [realEstateAssets, valuationMode, displayedHeroValue, propertyLoanMap]);

	// Compute Exposure Slices: By Type
	const typeSlices = useMemo((): RealEstateExposureSlice[] => {
		if (realEstateAssets.length === 0) return [];
		const map: Record<string, { count: number; value: number; surfaceArea: number }> = {};

		for (const a of realEstateAssets) {
			const typeKey = a.propertyType || "Residential";
			if (!map[typeKey]) {
				map[typeKey] = { count: 0, value: 0, surfaceArea: 0 };
			}
			map[typeKey].count += 1;
			map[typeKey].value += a.currentValue || 0;
			map[typeKey].surfaceArea += a.surfaceArea || 0;
		}

		return Object.entries(map)
			.map(([key, data], idx) => ({
				key,
				label: key,
				color: TERMINAL_PALETTE[idx % TERMINAL_PALETTE.length],
				count: data.count,
				value: data.value,
				percent: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
				surfaceArea: data.surfaceArea,
			}))
			.sort((a, b) => b.value - a.value);
	}, [realEstateAssets, totalValue]);

	// Compute Exposure Slices: By Location (City)
	const locationSlices = useMemo((): RealEstateExposureSlice[] => {
		if (realEstateAssets.length === 0) return [];
		const map: Record<string, { count: number; value: number; surfaceArea: number }> = {};

		for (const a of realEstateAssets) {
			const cityKey = a.city || "Unspecified Location";
			if (!map[cityKey]) {
				map[cityKey] = { count: 0, value: 0, surfaceArea: 0 };
			}
			map[cityKey].count += 1;
			map[cityKey].value += a.currentValue || 0;
			map[cityKey].surfaceArea += a.surfaceArea || 0;
		}

		return Object.entries(map)
			.map(([key, data], idx) => ({
				key,
				label: key,
				color: TERMINAL_PALETTE[(idx + 2) % TERMINAL_PALETTE.length],
				count: data.count,
				value: data.value,
				percent: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
				surfaceArea: data.surfaceArea,
			}))
			.sort((a, b) => b.value - a.value);
	}, [realEstateAssets, totalValue]);

	// Handle cross-filter selection
	const handleSelectExposureSlice = useCallback(
		(key: string | null, dimension: ExposureDimension) => {
			setActiveExposureFilter(key);
			setExposureDimension(dimension);
		},
		[],
	);

	// Filtered & Sorted Properties
	const filteredProperties = useMemo(() => {
		return realEstateAssets
			.filter((property) => {
				// Text search
				if (searchTerm.trim()) {
					const term = searchTerm.toLowerCase();
					const matchName = property.name?.toLowerCase().includes(term);
					const matchAddress = property.address?.toLowerCase().includes(term);
					const matchCity = property.city?.toLowerCase().includes(term);
					if (!matchName && !matchAddress && !matchCity) return false;
				}

				// Dropdown property type filter
				if (filterType !== "all" && property.propertyType !== filterType) {
					return false;
				}

				// Cross-filter from Exposure Widget
				if (activeExposureFilter) {
					if (exposureDimension === "type") {
						const type = property.propertyType || "Residential";
						if (type !== activeExposureFilter) return false;
					} else if (exposureDimension === "location") {
						const city = property.city || "Unspecified Location";
						if (city !== activeExposureFilter) return false;
					}
				}

				return true;
			})
			.sort((a, b) => {
				switch (sortBy) {
					case "value":
						return (b.currentValue || 0) - (a.currentValue || 0);
					case "gain": {
						const gainA = (a.currentValue || 0) - (a.purchasePrice || 0);
						const gainB = (b.currentValue || 0) - (b.purchasePrice || 0);
						return gainB - gainA;
					}
					case "surface":
						return (b.surfaceArea || 0) - (a.surfaceArea || 0);
					case "name":
						return (a.name || "").localeCompare(b.name || "");
					default:
						return 0;
				}
			});
	}, [realEstateAssets, searchTerm, filterType, activeExposureFilter, exposureDimension, sortBy]);

	// Active cross-filter stats
	const activeFilterStats = useMemo(() => {
		if (!activeExposureFilter) return null;
		const pool = exposureDimension === "type" ? typeSlices : locationSlices;
		return pool.find((s) => s.key === activeExposureFilter) || null;
	}, [activeExposureFilter, exposureDimension, typeSlices, locationSlices]);

	// Available property types for the select dropdown
	const availableTypes = useMemo(() => {
		const types = new Set<string>();
		for (const a of realEstateAssets) {
			if (a.propertyType) types.add(a.propertyType);
		}
		return Array.from(types).sort();
	}, [realEstateAssets]);

	const handleOpenDetail = (id: string) => {
		if (detailMode === "panel") {
			setSelectedPropertyId(id);
		} else {
			onSelectProperty?.(id);
		}
	};

	const handleAddProperty = async (formData: AddRealEstateFormSubmitData) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const currentVal =
				parseFloat(formData.currentValuation) || parseFloat(formData.purchasePrice) || 0;
			const purchaseVal = parseFloat(formData.purchasePrice) || currentVal;
			const surface = parseFloat(formData.surface || "") || undefined;
			const landSurface = parseFloat(formData.landSurface || "") || undefined;
			const year = formData.yearBuilt ? parseInt(formData.yearBuilt, 10) : undefined;
			const rooms = formData.rooms ? parseInt(formData.rooms, 10) : undefined;
			const beds = formData.bedrooms ? parseInt(formData.bedrooms, 10) : undefined;
			const baths = formData.bathrooms ? parseFloat(formData.bathrooms) : undefined;
			const floor = formData.floor ? parseInt(formData.floor, 10) : undefined;
			const totalFloors = formData.totalFloors ? parseInt(formData.totalFloors, 10) : undefined;
			const garages = formData.garages ? parseInt(formData.garages, 10) : undefined;
			const parkingSpaces = formData.parkingSpaces ? parseInt(formData.parkingSpaces, 10) : undefined;
			const agencyFees = parseFloat(formData.agencyFees || "") || undefined;
			const notaryFees = parseFloat(formData.notaryFees || "") || undefined;
			const renovationFees = parseFloat(formData.renovationFees || "") || undefined;
			const furnishingCosts = parseFloat(formData.furnishingCosts || "") || undefined;
			const monthlyRent = parseFloat(formData.monthlyRent || "") || undefined;
			const utilityCosts = parseFloat(formData.utilityCosts || "") || undefined;
			const yearlyMiscCosts = parseFloat(formData.yearlyMiscCosts || "") || undefined;

			const result = await addRealEstate({
				name: formData.name || formData.type || "Property",
				assetTypeID: "4", // Real Estate asset type ID
				propertyType: formData.type || "House",
				address: formData.address || "",
				city: formData.city || "",
				state: formData.state || undefined,
				country: formData.country || "France",
				zipCode: formData.postalCode || undefined,
				squareFeet: surface ? Math.round(surface) : undefined,
				yearBuilt: !isNaN(year as number) ? year : undefined,
				bedrooms: !isNaN(beds as number) ? beds : undefined,
				bathrooms: !isNaN(baths as number) ? baths : undefined,
				currentValue: currentVal,
				purchasePrice: purchaseVal,
				purchaseDate: formData.purchaseDate || undefined,

				category: formData.category || undefined,
				landSurface,
				rooms: !isNaN(rooms as number) ? rooms : undefined,
				floor: !isNaN(floor as number) ? floor : undefined,
				totalFloors: !isNaN(totalFloors as number) ? totalFloors : undefined,
				garages: !isNaN(garages as number) ? garages : undefined,
				parkingSpaces: !isNaN(parkingSpaces as number) ? parkingSpaces : undefined,
				energyLabel: formData.energyLabel || undefined,
				condition: formData.condition || undefined,
				agencyFees,
				notaryFees,
				renovationFees,
				furnishingCosts,
				rentalType: formData.rentalType || undefined,
				rentalPeriod: formData.rentalPeriod || undefined,
				monthlyRent,
				utilityCosts,
				yearlyMiscCosts,
				hasGarden: formData.hasGarden,
				hasBalcony: formData.hasBalcony,
				hasLift: formData.hasLift,
				hasPool: formData.hasPool,
				hasSauna: formData.hasSauna,
				isFurnished: formData.isFurnished,
				isNewConstruction: formData.isNewConstruction,
				kitchenQuality: formData.kitchenQuality || undefined,
				kitchenCondition: formData.kitchenCondition || undefined,
				bathroomQuality: formData.bathroomQuality || undefined,
				bathroomCondition: formData.bathroomCondition || undefined,
				flooringQuality: formData.flooringQuality || undefined,
				flooringCondition: formData.flooringCondition || undefined,
				windowsQuality: formData.windowsQuality || undefined,
				windowsCondition: formData.windowsCondition || undefined,
				generalQuality: formData.generalQuality || undefined,
				generalCondition: formData.generalCondition || undefined,
				linkedLoanId: formData.linkedLoanId,
				ownershipPercentage: formData.ownershipPercentage ? parseFloat(formData.ownershipPercentage) : undefined,
				ownershipStructure: formData.ownershipStructure,

				// BAN & Auto-Valuation
				addressLabel: formData.addressLabel,
				cityCode: formData.cityCode,
				banId: formData.banId,
				latitude: formData.latitude,
				longitude: formData.longitude,
				hasOutdoor: formData.hasOutdoor,
				isGroundFloor: formData.isGroundFloor,
				valuationMode: formData.valuationMode,
				manualValue: formData.manualValue ? parseFloat(formData.manualValue) : undefined,
			});

			if (result.asset) {
				toast.success("Property added successfully!");
				setIsAddFormOpen(false);
				await refetch();
			} else {
				throw new Error("createRealEstateAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add property. Please try again.");
			throw error;
		}
	};

	const handleDeleteConfirm = async () => {
		if (!propertyToDelete) return;
		setIsDeleting(true);
		try {
			if (typeof deleteAsset === "function") {
				await deleteAsset(propertyToDelete.id, currentPortfolio || undefined);
				toast.success(`Property "${propertyToDelete.name}" removed`);
				setPropertyToDelete(null);
				if (selectedPropertyId === propertyToDelete.id) {
					setSelectedPropertyId(null);
				}
				await refetch();
			} else {
				throw new Error("deleteAsset handler unavailable");
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to delete property";
			toast.error(msg);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="animate-in fade-in flex h-full flex-col space-y-6 duration-500">
			{/* Canonical Page Header */}
			<AssetPageHeader
				title="Real Estate"
				description="Manage property investments, physical assets, valuations, and portfolio exposure."
				onBack={onBack}
				actions={
					<div className="flex items-center gap-2 flex-wrap">
						{realEstateAssets.length > 0 && (
							<div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/40 text-micro font-mono text-muted-foreground">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								<span>
									{realEstateAssets.length} {realEstateAssets.length === 1 ? "property" : "properties"}
									{totalSurface > 0 ? ` • ${totalSurface.toLocaleString()} m²` : ""}
								</span>
							</div>
						)}

						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="h-8 text-xs border-0 bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs touch-target"
						>
							<Plus className="mr-1.5 h-3.5 w-3.5" />
							Add Property
						</Button>
					</div>
				}
			/>

			{/* 70/30 Hero Section: AssetHeroChart (70%) + RealEstateExposureWidget (30%) */}
			<div className="grid grid-cols-1 gap-6 border-b border-border/30 pb-6 lg:grid-cols-10">
				{/* Left 70%: Real Estate Valuation Hero Chart */}
				<div className="lg:col-span-7 pr-0 lg:pr-6 flex flex-col justify-between">
					{totalDebt > 0 && (
						<div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-border/20 text-xs">
							<div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-muted border border-border/40">
								<button
									type="button"
									onClick={() => setValuationMode("gross")}
									className={cn(
										"px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
										valuationMode === "gross"
											? "bg-background text-foreground shadow-xs border border-border/60"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									Valeur Brute ({formatCurrency(totalGrossValue)})
								</button>
								<button
									type="button"
									onClick={() => setValuationMode("net")}
									className={cn(
										"px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer",
										valuationMode === "net"
											? "bg-background text-foreground shadow-xs border border-border/60"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									Valeur Nette ({formatCurrency(totalNetEquity)})
								</button>
							</div>

							<div className="flex items-center gap-2 font-mono text-micro text-muted-foreground">
								<span>Dette: <strong className="text-foreground">{formatCurrency(totalDebt)}</strong></span>
								<span>•</span>
								<span>LTV: <strong className={cn(totalLTV > 75 ? "text-rose-500" : totalLTV > 50 ? "text-amber-500" : "text-emerald-500")}>{totalLTV.toFixed(1)}%</strong></span>
							</div>
						</div>
					)}

					<ErrorBoundary>
						<AssetHeroChart
							title={valuationMode === "gross" ? "Real Estate Portfolio Valuation" : "Real Estate Net Equity"}
							titleTooltip={valuationMode === "gross" ? "Aggregated asset valuation of physical properties (prorated by ownership %)" : "Net equity after deducting linked mortgage debts"}
							data={performanceData}
							holdings={chartHoldings}
							totalEquity={displayedHeroValue}
							formatCurrency={formatCurrency}
							timeRange={timeRange}
							onTimeRangeChange={setTimeRange}
							portfolioID={portfolioId}
							loading={scopedHistoryLoading && realEstateAssets.length === 0}
							defaultBenchmark="none"
							layoutId="realEstateHeroRangePillActive"
						/>
					</ErrorBoundary>
				</div>

				{/* Right 30%: Real Estate Exposure & Split */}
				<div className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-border/30 pt-6 lg:pt-0 pl-0 lg:pl-6 flex flex-col justify-between">
					<ErrorBoundary>
						<RealEstateExposureWidget
							totalRealEstateValue={totalValue}
							totalCost={totalCost}
							totalPortfolioValue={totalPortfolioValue}
							totalSurface={totalSurface}
							typeSlices={typeSlices}
							locationSlices={locationSlices}
							activeFilter={activeExposureFilter}
							activeDimension={exposureDimension}
							onSelectSlice={handleSelectExposureSlice}
							formatCurrency={formatCurrency}
							loading={scopedHistoryLoading && realEstateAssets.length === 0}
						/>
					</ErrorBoundary>
				</div>
			</div>

			{/* In-Viewport Active Cross-Filter Banner */}
			{activeFilterStats && (
				<motion.div
					key="real-estate-cross-filter-banner"
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
							<span className="font-semibold text-foreground">
								Filtered by {exposureDimension === "type" ? "Type" : "City"}:
							</span>
							<span className="font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-micro">
								{activeFilterStats.label}
							</span>
							<span className="text-muted-foreground text-micro sm:text-xs">
								({activeFilterStats.count} {activeFilterStats.count !== 1 ? "properties" : "property"}{" "}
								• {formatCurrency(activeFilterStats.value)} •{" "}
								{activeFilterStats.percent.toFixed(1)}% of real estate)
							</span>
						</div>
						<div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const el = document.getElementById("real-estate-workspace-section");
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
								onClick={() => setActiveExposureFilter(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Clear</span>
							</Button>
						</div>
					</div>
				</motion.div>
			)}

			{/* Segmented Workspace Navigation (2 Tabs) */}
			<div id="real-estate-workspace-section" className="flex flex-col space-y-4">
				<div className="flex items-center justify-between border-b border-border/20 pb-3 mt-1 flex-wrap gap-2">
					{/* Tab switcher */}
					<div
						className="relative flex max-w-full overflow-x-auto p-0.5 rounded-lg bg-muted border border-border/40"
						role="tablist"
						aria-label="Real estate workspace view"
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
									layoutId="realEstateActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Real Estate Ledger</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{filteredProperties.length}
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
									layoutId="realEstateActiveTabIndicator"
									className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
									transition={
										shouldReduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 500, damping: 38 }
									}
								/>
							)}
							<span className="relative z-10">Holdings & Specifications</span>
							<span className="relative z-10 text-micro font-mono px-1.5 py-0.5 rounded-full bg-secondary/80 text-foreground/80 font-normal">
								{realEstateAssets.length}
							</span>
						</button>
					</div>

					{/* Workspace Toolbar Controls */}
					<div className="flex items-center gap-2">
						{activeWorkspaceTab === "ledger" && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleToggleDensity}
								className="h-8 text-xs gap-1.5 border-border/50 hidden sm:flex touch-target"
								title="Toggle table row height"
							>
								<SlidersHorizontal className="h-3.5 w-3.5" />
								<span>{density === "compact" ? "Compact" : "Normal"}</span>
							</Button>
						)}
					</div>
				</div>

				{/* Empty State when zero real estate assets */}
				{realEstateAssets.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border/60 p-10 text-center space-y-3 bg-card/30 my-4">
						<div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
							<Building2 className="h-5 w-5" />
						</div>
						<h3 className="font-semibold text-foreground text-sm">No Real Estate Properties</h3>
						<p className="text-xs text-muted-foreground max-w-md mx-auto">
							Track real estate acquisitions, physical valuations, surface metrics (m²), and net worth
							exposure in this portfolio.
						</p>
						<Button
							size="sm"
							onClick={() => setIsAddFormOpen(true)}
							className="mt-2 text-xs gap-1.5"
						>
							<Plus className="h-3.5 w-3.5" />
							Add First Property
						</Button>
					</div>
				) : (
					<div>
						{/* Tab 1: Real Estate Ledger */}
						{activeWorkspaceTab === "ledger" && (
							<div className="space-y-3">
								{/* Search & Type Filter Toolbar */}
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
									<div className="flex items-center gap-2 flex-1 max-w-md">
										<SearchInput
											placeholder="Search property, address, city..."
											value={searchTerm}
											onChange={(e) => setSearchTerm(e.target.value)}
											className="h-8 text-xs w-full"
										/>
									</div>

									<div className="flex items-center gap-2 shrink-0">
										<Select value={filterType} onValueChange={setFilterType}>
											<SelectTrigger className="h-8 text-xs w-[140px] border-border/60">
												<SelectValue placeholder="All Types" />
											</SelectTrigger>
											<SelectContent className="text-xs">
												<SelectItem value="all">All Types</SelectItem>
												{availableTypes.map((type) => (
													<SelectItem key={type} value={type}>
														{type}
													</SelectItem>
												))}
											</SelectContent>
										</Select>

										<Select
											value={sortBy}
											onValueChange={(v) =>
												setSortBy(v as "value" | "gain" | "surface" | "name")
											}
										>
											<SelectTrigger className="h-8 text-xs w-[130px] border-border/60">
												<SelectValue placeholder="Sort by" />
											</SelectTrigger>
											<SelectContent className="text-xs">
												<SelectItem value="value">By Valuation</SelectItem>
												<SelectItem value="gain">By P&L Return</SelectItem>
												<SelectItem value="surface">By Surface</SelectItem>
												<SelectItem value="name">By Name</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

								{/* High-Density Ledger Table */}
								<div className="rounded-xl border border-border/60 bg-card overflow-hidden">
									<Table>
										<TableHeader className="bg-muted/40">
											<TableRow className="hover:bg-transparent border-border/40 text-micro">
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground w-[220px]">
													Property & Address
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground w-[110px]">
													Type
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground text-right w-[110px]">
													Surface & €/m²
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground text-right w-[130px] hidden md:table-cell">
													Purchase Cost
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground text-right w-[130px]">
													Current Value
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground text-right w-[130px]">
													Unrealized Return
												</TableHead>
												<TableHead className="font-bold uppercase tracking-wider text-muted-foreground text-right w-[90px] hidden lg:table-cell">
													Weight
												</TableHead>
												<TableHead className="w-[44px] text-right" />
											</TableRow>
										</TableHeader>
										<TableBody>
											{filteredProperties.length === 0 ? (
												<TableRow>
													<TableCell
														colSpan={8}
														className="h-28 text-center text-xs text-muted-foreground"
													>
														No properties match the active search and filter criteria.
													</TableCell>
												</TableRow>
											) : (
												filteredProperties.map((prop) => {
													const ownershipPct = typeof prop.ownershipPercentage === "number" ? prop.ownershipPercentage : 100;
													const grossVal = (prop.currentValue || 0) * (ownershipPct / 100);
													const linkedLoan = propertyLoanMap.get(prop.id);
													const loanDebt = linkedLoan ? (linkedLoan.remainingBalance ?? linkedLoan.loanAmount ?? 0) : 0;
													const netEquity = Math.max(0, grossVal - loanDebt);
													const propLtv = grossVal > 0 && loanDebt > 0 ? (loanDebt / grossVal) * 100 : 0;
													const val = valuationMode === "gross" ? grossVal : netEquity;

													const cost = (prop.purchasePrice || prop.currentValue || 0) * (ownershipPct / 100);
													const pnl = grossVal - cost;
													const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
													const weight = totalValue > 0 ? (val / totalValue) * 100 : 0;
													const surface = prop.surfaceArea;
													const priceM2 =
														surface && surface > 0 ? Math.round(grossVal / surface) : null;
													const isCompact = density === "compact";

													return (
														<TableRow
															key={prop.id}
															onClick={() => handleOpenDetail(prop.id)}
															className={cn(
																"cursor-pointer hover:bg-muted/50 border-border/30 transition-colors",
																isCompact ? "h-11" : "h-14",
															)}
														>
															{/* Property Name & Address */}
															<TableCell className={cn("font-medium", isCompact ? "py-1.5" : "py-2.5")}>
																<div className="flex items-center gap-2.5">
																	<div className="h-7 w-7 rounded-md bg-secondary/80 flex items-center justify-center text-primary shrink-0">
																		<Home className="h-3.5 w-3.5" />
																	</div>
																	<div className="min-w-0">
																		<div className="flex items-center gap-1.5">
																			<p className="font-semibold text-xs text-foreground truncate max-w-[170px]">
																				{prop.name}
																			</p>
																			{ownershipPct < 100 && (
																				<span className="text-[10px] font-mono px-1 rounded bg-muted/60 text-muted-foreground border border-border/40 shrink-0">
																					{ownershipPct}%
																				</span>
																			)}
																		</div>
																		<p className="text-micro text-muted-foreground truncate max-w-[190px]">
																			{prop.city
																				? `${prop.city}${prop.country ? `, ${prop.country}` : ""}`
																				: prop.address || "No address"}
																		</p>
																	</div>
																</div>
															</TableCell>

															{/* Property Type Badge */}
															<TableCell className={isCompact ? "py-1.5" : "py-2.5"}>
																<Badge
																	variant="secondary"
																	className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 rounded-sm"
																>
																	{prop.propertyType || "Residential"}
																</Badge>
															</TableCell>

															{/* Surface & Price/m² */}
															<TableCell className={cn("text-right font-mono", isCompact ? "py-1.5" : "py-2.5")}>
																<div className="text-xs font-semibold">
																	{surface ? `${surface} m²` : "—"}
																</div>
																<div className="text-micro text-muted-foreground">
																	{priceM2 !== null ? `${formatCurrency(priceM2)}/m²` : "—"}
																</div>
															</TableCell>

															{/* Purchase Cost & Date */}
															<TableCell className={cn("text-right font-mono hidden md:table-cell", isCompact ? "py-1.5" : "py-2.5")}>
																<div className="text-xs text-muted-foreground">
																	{cost > 0 ? formatCurrency(cost) : "—"}
																</div>
																<div className="text-micro text-muted-foreground">
																	{prop.purchaseDate
																		? new Date(prop.purchaseDate).toLocaleDateString()
																		: "—"}
																</div>
															</TableCell>

															{/* Current Valuation / Net Equity */}
															<TableCell className={cn("text-right font-mono", isCompact ? "py-1.5" : "py-2.5")}>
																<div className="flex items-center justify-end gap-1.5">
																	<span className="text-xs font-bold text-foreground">
																		{formatCurrency(val)}
																	</span>
																	{prop.valuationConfidence && (
																		<span
																			className={cn(
																				"h-2 w-2 rounded-full shrink-0",
																				prop.valuationConfidence === "HIGH" && "bg-emerald-500",
																				prop.valuationConfidence === "MEDIUM" && "bg-sky-500",
																				prop.valuationConfidence === "LOW" && "bg-amber-500",
																				prop.valuationConfidence === "UNAVAILABLE" && "bg-muted-foreground",
																			)}
																			title={`Estimation: ${prop.valuationConfidence} (${prop.estimationMethod || "Auto"})`}
																		/>
																	)}
																</div>
																{loanDebt > 0 && (
																	<div className="text-micro text-muted-foreground">
																		Dette: {formatCurrency(loanDebt)} ({propLtv.toFixed(0)}%)
																	</div>
																)}
															</TableCell>

															{/* Unrealized Return */}
															<TableCell className={cn("text-right font-mono", isCompact ? "py-1.5" : "py-2.5")}>
																<div
																	className={cn(
																		"text-xs font-semibold flex items-center justify-end gap-1",
																		pnl >= 0 ? "text-gain" : "text-loss",
																	)}
																>
																	{pnl >= 0 ? (
																		<TrendArrowUp className="h-3 w-3 inline text-gain" />
																	) : (
																		<TrendArrowDown className="h-3 w-3 inline text-loss" />
																	)}
																	<span>
																		{pnl >= 0 ? "+" : ""}
																		{formatCurrency(pnl)}
																	</span>
																</div>
																<div
																	className={cn(
																		"text-micro font-medium",
																		pnl >= 0 ? "text-gain" : "text-loss",
																	)}
																>
																	{cost > 0
																		? `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`
																		: "—"}
																</div>
															</TableCell>

															{/* Weight */}
															<TableCell className={cn("text-right font-mono text-xs hidden lg:table-cell text-muted-foreground", isCompact ? "py-1.5" : "py-2.5")}>
																{weight.toFixed(1)}%
															</TableCell>

															{/* Action Menu */}
															<TableCell
																className={cn("text-right", isCompact ? "py-1.5" : "py-2.5")}
																onClick={(e) => e.stopPropagation()}
															>
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-7 w-7 text-muted-foreground hover:text-foreground touch-target"
																			aria-label="Property actions"
																		>
																			<MoreVertical className="h-3.5 w-3.5" />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end" className="text-xs">
																		<DropdownMenuItem onClick={() => handleOpenDetail(prop.id)}>
																			<Eye className="h-3.5 w-3.5 mr-2" />
																			View Details
																		</DropdownMenuItem>
																		<DropdownMenuSeparator />
																		<DropdownMenuItem
																			onClick={() =>
																				setPropertyToDelete({ id: prop.id, name: prop.name })
																			}
																			className="text-destructive focus:text-destructive"
																		>
																			<Trash2 className="h-3.5 w-3.5 mr-2" />
																			Delete Property
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

						{/* Tab 2: Holdings & Specifications (Property Dossiers) */}
						{activeWorkspaceTab === "holdings" && (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{filteredProperties.map((prop) => {
									const val = prop.currentValue || 0;
									const cost = prop.purchasePrice || val;
									const pnl = val - cost;
									const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
									const surface = prop.surfaceArea;
									const priceM2 =
										surface && surface > 0 ? Math.round(val / surface) : null;
									const loanInfo = propertyLoanMap[prop.id];
									const ownPct = prop.ownershipPercentage ?? 100;
									const displayedVal =
										valuationMode === "net" && loanInfo ? val - loanInfo.debt : val;

									return (
										<div
											key={prop.id}
											onClick={() => handleOpenDetail(prop.id)}
											className="p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-all cursor-pointer space-y-3.5 touch-target"
										>
											{/* Dossier Header */}
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="flex items-center gap-1.5 flex-wrap">
														<span className="font-bold text-sm text-foreground truncate max-w-[200px]">
															{prop.name}
														</span>
														<Badge
															variant="secondary"
															className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 rounded-sm"
														>
															{prop.propertyType || "Residential"}
														</Badge>
														{ownPct < 100 && (
															<Badge
																variant="outline"
																className="text-[10px] font-mono px-1 py-0 h-4 border-primary/30 text-primary"
															>
																{ownPct}%
															</Badge>
														)}
														{loanInfo && (
															<Badge
																variant="outline"
																className="text-[10px] font-mono px-1 py-0 h-4 border-border/60 text-muted-foreground"
															>
																LTV {loanInfo.ltv.toFixed(0)}%
															</Badge>
														)}
													</div>
													<p className="text-micro text-muted-foreground flex items-center gap-1 mt-1 truncate">
														<MapPin className="h-3 w-3 shrink-0" />
														<span>
															{[prop.address, prop.city, prop.country]
																.filter(Boolean)
																.join(", ") || "No address specified"}
														</span>
													</p>
												</div>

												<div className="text-right font-mono shrink-0">
													<div className="flex items-center justify-end gap-1.5 font-bold text-sm text-foreground">
														<span>{formatCurrency(displayedVal)}</span>
														{prop.valuationConfidence && (
															<span
																className={cn(
																	"h-2 w-2 rounded-full shrink-0",
																	prop.valuationConfidence === "HIGH" && "bg-emerald-500",
																	prop.valuationConfidence === "MEDIUM" && "bg-sky-500",
																	prop.valuationConfidence === "LOW" && "bg-amber-500",
																	prop.valuationConfidence === "UNAVAILABLE" && "bg-muted-foreground",
																)}
																title={`Estimation: ${prop.valuationConfidence} (${prop.estimationMethod || "Auto"})`}
															/>
														)}
													</div>
													{valuationMode === "net" && loanInfo && (
														<div className="text-[10px] text-muted-foreground">
															Net (Brut: {formatCurrency(val)})
														</div>
													)}
													<div
														className={cn(
															"text-micro font-semibold",
															pnl >= 0 ? "text-gain" : "text-loss",
														)}
													>
														{pnl >= 0 ? "+" : ""}
														{pnlPct.toFixed(1)}%
													</div>
												</div>
											</div>

											{/* Specifications Grid */}
											<div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/30 text-micro">
												<div>
													<span className="text-muted-foreground block text-[10px] uppercase font-bold">
														Surface
													</span>
													<span className="font-mono font-semibold text-foreground">
														{surface ? `${surface} m²` : "—"}
													</span>
												</div>
												<div>
													<span className="text-muted-foreground block text-[10px] uppercase font-bold">
														Price / m²
													</span>
													<span className="font-mono font-semibold text-foreground">
														{priceM2 !== null ? `${formatCurrency(priceM2)}` : "—"}
													</span>
												</div>
												<div>
													<span className="text-muted-foreground block text-[10px] uppercase font-bold">
														Built Year
													</span>
													<span className="font-mono font-semibold text-foreground">
														{prop.yearBuilt ? String(prop.yearBuilt) : "—"}
													</span>
												</div>
											</div>

											{/* Footer Specs & Action */}
											<div className="flex items-center justify-between pt-1 text-micro text-muted-foreground border-t border-border/20">
												<div className="flex items-center gap-3">
													{prop.bedrooms ? (
														<span className="flex items-center gap-1 font-mono">
															<Bed className="h-3 w-3" /> {prop.bedrooms} bed
														</span>
													) : null}
													{prop.bathrooms ? (
														<span className="flex items-center gap-1 font-mono">
															<Bath className="h-3 w-3" /> {prop.bathrooms} bath
														</span>
													) : null}
												</div>

												<Button
													variant="ghost"
													size="sm"
													className="h-6 text-micro px-2 gap-1 text-primary hover:text-primary font-semibold"
													onClick={(e) => {
														e.stopPropagation();
														handleOpenDetail(prop.id);
													}}
												>
													<span>Inspect</span>
													<Eye className="h-3 w-3" />
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Add Property Form Modal */}
			<AddRealEstateForm
				open={isAddFormOpen}
				onClose={() => setIsAddFormOpen(false)}
				onSubmit={handleAddProperty}
			/>

			{/* Slide-over Sheet for Property Details */}
			<Sheet
				open={Boolean(selectedPropertyId)}
				onOpenChange={(open) => !open && setSelectedPropertyId(null)}
			>
				<SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
					<SheetHeader className="sr-only">
						<SheetTitle>Property Dossier</SheetTitle>
						<SheetDescription>
							Specifications, valuation metrics, and trajectory for the selected real estate asset
						</SheetDescription>
					</SheetHeader>
					{selectedPropertyId && (
						<RealEstateDetail
							propertyId={selectedPropertyId}
							onBack={() => setSelectedPropertyId(null)}
							isPanel={true}
							onDeleted={() => {
								void refetch();
							}}
						/>
					)}
				</SheetContent>
			</Sheet>

			{/* Delete Property Confirmation Dialog */}
			<Dialog
				open={Boolean(propertyToDelete)}
				onOpenChange={(open) => !open && setPropertyToDelete(null)}
			>
				<DialogContent className="max-w-md bg-card border border-border/60">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<Trash2 className="h-5 w-5" />
							Delete Property
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground pt-1">
							Are you sure you want to remove <strong>{propertyToDelete?.name}</strong> from your
							portfolio? This will permanently delete the asset and its valuation records.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0 pt-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPropertyToDelete(null)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? "Deleting..." : "Confirm Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
