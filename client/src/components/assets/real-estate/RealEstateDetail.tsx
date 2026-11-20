import {
	AlertTriangle,
	ArrowLeft,
	Building2,
	Check,
	Coins,
	Copy,
	Download,
	Home,
	Info,
	Landmark,
	MapPin,
	MoreVertical,
	Pencil,
	Percent,
	Receipt,
	RefreshCw,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetDetailChart, type AssetDetailChartPoint } from "@/components/charts/AssetDetailChart";
import { usePortfolio } from "@/components/PortfolioProvider";
import { PageTimeframeSelector, type TimeRange } from "@/components/shared/PageTimeframeSelector";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAssetMutations, type UpdateRealEstateInput } from "@/hooks/use-asset-mutations";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

const OWNERSHIP_STRUCTURES = [
	{ value: "Nom propre", label: "Sole Ownership (Nom propre)" },
	{ value: "SCI à l'IR", label: "Real Estate Corp - Pass-Through (SCI à l'IR)" },
	{ value: "SCI à l'IS", label: "Real Estate Corp - Corporate Tax (SCI à l'IS)" },
	{ value: "Indivision", label: "Joint Ownership (Indivision)" },
	{ value: "SARL de famille", label: "Family LLC (SARL de famille)" },
	{ value: "Démembrement", label: "Split Ownership (Démembrement)" },
	{ value: "Autre", label: "Other" },
];

function getOwnershipStructureLabel(structure?: string | null): string {
	if (!structure) return "Sole Ownership (Nom propre)";
	const match = OWNERSHIP_STRUCTURES.find((s) => s.value === structure || s.label === structure);
	return match ? match.label : structure;
}

const ENERGY_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const PROPERTY_CATEGORIES = [
	"Apartment",
	"House",
	"Building",
	"Commercial",
	"Land",
	"Parking",
	"Other",
];

interface RealEstateDetailProps {
	propertyId: string;
	onBack: () => void;
	isPanel?: boolean;
	onEditProperty?: (propertyId: string) => void;
	onDeleted?: () => void;
}

export function RealEstateDetail({
	propertyId,
	onBack,
	isPanel = false,
	onEditProperty,
	onDeleted,
}: RealEstateDetailProps) {
	const { assets, deleteAsset, currentPortfolio, refetch } = usePortfolio();
	const { updateRealEstate, refreshRealEstateValuation } = useAssetMutations();
	const { formatCurrency } = useCurrency();
	const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [hasCopiedAddress, setHasCopiedAddress] = useState(false);
	const [isRefreshingValuation, setIsRefreshingValuation] = useState(false);
	const [manualValuationInput, setManualValuationInput] = useState<string>("");
	const [isSavingManualVal, setIsSavingManualVal] = useState(false);

	// Inline editing state
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const property = assets.find((a) => a.id === propertyId && a.type === "real_estate");

	const handleRefreshValuation = async () => {
		if (!property) return;
		setIsRefreshingValuation(true);
		try {
			const res = await refreshRealEstateValuation(property.id);
			if (res) {
				toast.success("Valuation updated successfully!");
				await refetch();
			}
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Failed to refresh valuation";
			toast.error(message);
		} finally {
			setIsRefreshingValuation(false);
		}
	};

	const handleToggleValuationMode = async (mode: "AUTO" | "MANUAL") => {
		if (!property) return;
		try {
			await updateRealEstate(property.id, {
				valuationMode: mode,
				manualValue:
					mode === "MANUAL"
						? parseFloat(manualValuationInput) || property.currentValue || 0
						: undefined,
			});
			toast.success(
				`Mode de valorisation passé en ${mode === "AUTO" ? "Automatique" : "Manuel"}`,
			);
			await refetch();
		} catch {
			toast.error("Échec de la modification du mode");
		}
	};

	const handleSaveManualValuation = async () => {
		if (!property) return;
		const val = parseFloat(manualValuationInput);
		if (isNaN(val) || val <= 0) {
			toast.error("Veuillez saisir un montant valide");
			return;
		}
		setIsSavingManualVal(true);
		try {
			await updateRealEstate(property.id, {
				valuationMode: "MANUAL",
				manualValue: val,
				currentValue: val,
			});
			toast.success("Valeur manuelle enregistrée");
			await refetch();
		} catch {
			toast.error("Erreur lors de l'enregistrement");
		} finally {
			setIsSavingManualVal(false);
		}
	};

	// Available loans in portfolio
	const loanAssets = useMemo(() => assets.filter((a) => a.type === "loan"), [assets]);

	// Matched loan (linkedLoanId or two-way linkedAssetIDs)
	const linkedLoan = useMemo(() => {
		if (!property) return null;
		return (
			loanAssets.find(
				(l) =>
					l.id === property.linkedLoanId ||
					(Array.isArray(l.linkedAssetIDs) && l.linkedAssetIDs.includes(property.id)),
			) || null
		);
	}, [property, loanAssets]);

	// Effective acquisition date (fallback to linked loan startDate)
	const effectivePurchaseDate = property?.purchaseDate || linkedLoan?.startDate || null;
	const isAcquisitionDateDerived = !property?.purchaseDate && !!linkedLoan?.startDate;

	// Editable form state
	const [editName, setEditName] = useState("");
	const [editCurrentValue, setEditCurrentValue] = useState<string>("");
	const [editPurchasePrice, setEditPurchasePrice] = useState<string>("");
	const [editPurchaseDate, setEditPurchaseDate] = useState<string>("");
	const [editNotaryFees, setEditNotaryFees] = useState<string>("");
	const [editRenovationFees, setEditRenovationFees] = useState<string>("");
	const [editAgencyFees, setEditAgencyFees] = useState<string>("");
	const [editFurnishingCosts, setEditFurnishingCosts] = useState<string>("");
	const [editOwnershipPercentage, setEditOwnershipPercentage] = useState<string>("100");
	const [editOwnershipStructure, setEditOwnershipStructure] = useState<string>("Nom propre");
	const [editLinkedLoanId, setEditLinkedLoanId] = useState<string>("none");
	const [editMonthlyRent, setEditMonthlyRent] = useState<string>("");
	const [editUtilityCosts, setEditUtilityCosts] = useState<string>("");
	const [editYearlyMiscCosts, setEditYearlyMiscCosts] = useState<string>("");
	const [editCategory, setEditCategory] = useState<string>("");
	const [editSurface, setEditSurface] = useState<string>("");
	const [editLandSurface, setEditLandSurface] = useState<string>("");
	const [editRooms, setEditRooms] = useState<string>("");
	const [editBedrooms, setEditBedrooms] = useState<string>("");
	const [editBathrooms, setEditBathrooms] = useState<string>("");
	const [editGarages, setEditGarages] = useState<string>("");
	const [editParkingSpaces, setEditParkingSpaces] = useState<string>("");
	const [editYearBuilt, setEditYearBuilt] = useState<string>("");
	const [editFloor, setEditFloor] = useState<string>("");
	const [editTotalFloors, setEditTotalFloors] = useState<string>("");
	const [editEnergyLabel, setEditEnergyLabel] = useState<string>("none");

	const handleStartEditing = () => {
		if (!property) return;
		setEditName(property.name || "");
		setEditCurrentValue(property.currentValue ? String(property.currentValue) : "");
		setEditPurchasePrice(property.purchasePrice ? String(property.purchasePrice) : "");
		setEditPurchaseDate(
			property.purchaseDate
				? new Date(property.purchaseDate).toISOString().split("T")[0]
				: linkedLoan?.startDate
					? new Date(linkedLoan.startDate).toISOString().split("T")[0]
					: "",
		);
		setEditNotaryFees(property.notaryFees ? String(property.notaryFees) : "");
		setEditRenovationFees(property.renovationFees ? String(property.renovationFees) : "");
		setEditAgencyFees(property.agencyFees ? String(property.agencyFees) : "");
		setEditFurnishingCosts(property.furnishingCosts ? String(property.furnishingCosts) : "");
		setEditOwnershipPercentage(
			property.ownershipPercentage !== undefined ? String(property.ownershipPercentage) : "100",
		);
		setEditOwnershipStructure(property.ownershipStructure || "Nom propre");
		setEditLinkedLoanId(property.linkedLoanId || linkedLoan?.id || "none");
		setEditMonthlyRent(property.monthlyRent ? String(property.monthlyRent) : "");
		setEditUtilityCosts(property.utilityCosts ? String(property.utilityCosts) : "");
		setEditYearlyMiscCosts(property.yearlyMiscCosts ? String(property.yearlyMiscCosts) : "");
		setEditCategory(property.category || property.propertyType || "Apartment");
		setEditSurface(property.surfaceArea ? String(property.surfaceArea) : "");
		setEditLandSurface(property.landSurface ? String(property.landSurface) : "");
		setEditRooms(property.rooms ? String(property.rooms) : "");
		setEditBedrooms(property.bedrooms ? String(property.bedrooms) : "");
		setEditBathrooms(property.bathrooms ? String(property.bathrooms) : "");
		setEditGarages(property.garages ? String(property.garages) : "");
		setEditParkingSpaces(property.parkingSpaces ? String(property.parkingSpaces) : "");
		setEditYearBuilt(property.yearBuilt ? String(property.yearBuilt) : "");
		setEditFloor(property.floor !== undefined ? String(property.floor) : "");
		setEditTotalFloors(property.totalFloors !== undefined ? String(property.totalFloors) : "");
		setEditEnergyLabel(property.energyLabel || "none");
		setIsEditing(true);
	};

	const handleCancelEditing = () => {
		setIsEditing(false);
	};

	const handleSaveEditing = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!property) return;
		setIsSaving(true);
		try {
			const numVal = parseFloat(editCurrentValue);
			const numCost = parseFloat(editPurchasePrice);
			const numOwnPct = parseFloat(editOwnershipPercentage);
			const numNotary = parseFloat(editNotaryFees);
			const numRenovation = parseFloat(editRenovationFees);
			const numAgency = parseFloat(editAgencyFees);
			const numFurnishing = parseFloat(editFurnishingCosts);
			const parsedPurchaseDate = editPurchaseDate
				? new Date(editPurchaseDate).toISOString()
				: undefined;
			const numRent = parseFloat(editMonthlyRent);
			const numUtilities = parseFloat(editUtilityCosts);
			const numYearlyMisc = parseFloat(editYearlyMiscCosts);
			const numSurface = parseFloat(editSurface);
			const numLand = parseFloat(editLandSurface);
			const numRooms = parseInt(editRooms, 10);
			const numBed = parseInt(editBedrooms, 10);
			const numBath = parseInt(editBathrooms, 10);
			const numGarages = parseInt(editGarages, 10);
			const numParking = parseInt(editParkingSpaces, 10);
			const numYear = parseInt(editYearBuilt, 10);
			const numFloor = parseInt(editFloor, 10);
			const numTotalFloors = parseInt(editTotalFloors, 10);

			const payload: UpdateRealEstateInput = {
				name: editName.trim() || property.name,
				category: editCategory || undefined,
				currentValue: !Number.isNaN(numVal) && numVal >= 0 ? numVal : property.currentValue,
				purchasePrice: !Number.isNaN(numCost) && numCost >= 0 ? numCost : property.purchasePrice,
				purchaseDate: parsedPurchaseDate,
				agencyFees: !Number.isNaN(numAgency) && numAgency >= 0 ? numAgency : undefined,
				notaryFees: !Number.isNaN(numNotary) && numNotary >= 0 ? numNotary : undefined,
				renovationFees:
					!Number.isNaN(numRenovation) && numRenovation >= 0 ? numRenovation : undefined,
				furnishingCosts:
					!Number.isNaN(numFurnishing) && numFurnishing >= 0 ? numFurnishing : undefined,
				ownershipPercentage:
					!Number.isNaN(numOwnPct) && numOwnPct >= 0 && numOwnPct <= 100 ? numOwnPct : 100,
				ownershipStructure: editOwnershipStructure || undefined,
				linkedLoanId: editLinkedLoanId !== "none" ? editLinkedLoanId : undefined,
				monthlyRent: !Number.isNaN(numRent) && numRent >= 0 ? numRent : undefined,
				utilityCosts: !Number.isNaN(numUtilities) && numUtilities >= 0 ? numUtilities : undefined,
				yearlyMiscCosts:
					!Number.isNaN(numYearlyMisc) && numYearlyMisc >= 0 ? numYearlyMisc : undefined,
				squareFeet: !Number.isNaN(numSurface) && numSurface > 0 ? numSurface : undefined,
				landSurface: !Number.isNaN(numLand) && numLand > 0 ? numLand : undefined,
				rooms: !Number.isNaN(numRooms) && numRooms > 0 ? numRooms : undefined,
				bedrooms: !Number.isNaN(numBed) && numBed >= 0 ? numBed : undefined,
				bathrooms: !Number.isNaN(numBath) && numBath >= 0 ? numBath : undefined,
				garages: !Number.isNaN(numGarages) && numGarages >= 0 ? numGarages : undefined,
				parkingSpaces: !Number.isNaN(numParking) && numParking >= 0 ? numParking : undefined,
				yearBuilt: !Number.isNaN(numYear) && numYear > 1500 ? numYear : undefined,
				floor: !Number.isNaN(numFloor) ? numFloor : undefined,
				totalFloors: !Number.isNaN(numTotalFloors) && numTotalFloors >= 0 ? numTotalFloors : undefined,
				energyLabel: editEnergyLabel !== "none" ? editEnergyLabel : undefined,
			};

			await updateRealEstate(property.id, payload);
			void refetch?.();
			toast.success("Property specifications updated successfully");
			setIsEditing(false);
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to update property";
			toast.error(msg);
		} finally {
			setIsSaving(false);
		}
	};

	// Honest performance trajectory from purchaseDate -> today (ZERO Math.random)
	const chartData = useMemo(() => {
		if (!property) return [];
		const currentVal = property.currentValue || 0;
		const purchaseVal = property.purchasePrice || currentVal;

		let days: number;
		if (timeRange === "1D") days = 1;
		else if (timeRange === "7D") days = 7;
		else if (timeRange === "1M") days = 30;
		else if (timeRange === "3M") days = 90;
		else if (timeRange === "YTD") {
			const now = new Date();
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			days = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)));
		} else if (timeRange === "1Y") days = 365;
		else {
			// ALL: span from effectivePurchaseDate or default 2 years
			if (effectivePurchaseDate) {
				const pDate = new Date(effectivePurchaseDate);
				if (!Number.isNaN(pDate.getTime())) {
					days = Math.max(
						30,
						Math.floor((Date.now() - pDate.getTime()) / (1000 * 60 * 60 * 24)),
					);
				} else {
					days = 730;
				}
			} else {
				days = 730;
			}
		}

		// Cap days to 100 points for crisp terminal chart rendering
		const step = Math.max(1, Math.floor(days / 60));
		const data: AssetDetailChartPoint[] = [];
		const valueDelta = currentVal - purchaseVal;

		for (let i = days; i >= 0; i -= step) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			const progress = days > 0 ? (days - i) / days : 1;
			const interpolatedValue = Math.round(purchaseVal + valueDelta * progress);

			data.push({
				date: date.toISOString().split("T")[0],
				close: interpolatedValue,
			});
		}

		// Ensure today is the last point
		const todayStr = new Date().toISOString().split("T")[0];
		if (data.length === 0 || data[data.length - 1].date !== todayStr) {
			data.push({
				date: todayStr,
				close: Math.round(currentVal),
			});
		}

		return data;
	}, [property, timeRange, effectivePurchaseDate]);

	if (!property) {
		return (
			<div className="flex items-center justify-center h-full p-8">
				<div className="text-center space-y-4">
					<p className="text-sm text-muted-foreground">Property asset not found in portfolio.</p>
					<Button size="sm" variant="outline" onClick={onBack} className="touch-target">
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Real Estate
					</Button>
				</div>
			</div>
		);
	}

	const currentValue = property.currentValue || 0;
	const purchasePrice = property.purchasePrice || 0;
	const ownershipPercentage = property.ownershipPercentage ?? 100;
	const ownershipRate = ownershipPercentage / 100;
	const proratedValuation = currentValue * ownershipRate;
	const proratedPurchaseCost = purchasePrice * ownershipRate;

	const unrealizedPnl = currentValue - purchasePrice;
	const unrealizedPnlPercent =
		purchasePrice > 0 ? (unrealizedPnl / purchasePrice) * 100 : 0;

	const surfaceArea = property.surfaceArea; // in m²
	const pricePerM2 =
		surfaceArea && surfaceArea > 0 ? Math.round(currentValue / surfaceArea) : null;
	const purchasePricePerM2 =
		surfaceArea && surfaceArea > 0 && purchasePrice > 0
			? Math.round(purchasePrice / surfaceArea)
			: null;

	const propertyType = property.propertyType || "Residential";
	const address = property.address || property.name;
	const city = property.city || "";
	const country = property.country || "";
	const locationLabel = [city, country].filter(Boolean).join(", ");

	// Financial breakdown & all-in basis
	const agencyFees = property.agencyFees ?? 0;
	const notaryFees = property.notaryFees ?? 0;
	const renovationFees = property.renovationFees ?? 0;
	const furnishingCosts = property.furnishingCosts ?? 0;
	const hasAcquisitionCosts =
		agencyFees > 0 || notaryFees > 0 || renovationFees > 0 || furnishingCosts > 0;
	const allInCost =
		purchasePrice + agencyFees + notaryFees + renovationFees + furnishingCosts;
	const netAllInReturn = allInCost > 0 ? currentValue - allInCost : 0;
	const netAllInReturnPercent = allInCost > 0 ? (netAllInReturn / allInCost) * 100 : 0;

	// Debt & LTV metrics
	const remainingDebt = linkedLoan?.remainingBalance ?? 0;
	const monthlyLoanPayment = linkedLoan?.monthlyPayment ?? 0;
	const proratedDebt = remainingDebt * ownershipRate;
	const netEquity = proratedValuation - proratedDebt;
	const ltv = currentValue > 0 ? (remainingDebt / currentValue) * 100 : 0;

	// Rental data & real Net-Net cashflow
	const monthlyRent = property.monthlyRent ?? 0;
	const utilityCosts = property.utilityCosts ?? 0;
	const yearlyMiscCosts = property.yearlyMiscCosts ?? 0;
	const hasRentalIncome = monthlyRent > 0;
	const annualGrossRentalYield =
		hasRentalIncome && (allInCost > 0 ? allInCost : purchasePrice) > 0
			? ((monthlyRent * 12) / (allInCost > 0 ? allInCost : purchasePrice)) * 100
			: null;

	const netNetMonthlyCashflow = hasRentalIncome
		? monthlyRent - utilityCosts - yearlyMiscCosts / 12 - monthlyLoanPayment
		: null;

	const amenitiesList = [
		{ label: "Garden", active: !!property.hasGarden },
		{ label: "Balcony / Terrace", active: !!property.hasBalcony },
		{ label: "Elevator", active: !!property.hasLift },
		{ label: "Swimming Pool", active: !!property.hasPool },
		{ label: "Sauna / Spa", active: !!property.hasSauna },
		{ label: "Furnished", active: !!property.isFurnished },
		{ label: "New Construction (VEFA)", active: !!property.isNewConstruction },
	].filter((a) => a.active);

	const hasConditionRatings =
		!!property.condition ||
		!!property.generalQuality ||
		!!property.kitchenQuality ||
		!!property.bathroomQuality ||
		!!property.flooringQuality ||
		!!property.windowsQuality;

	const handleCopyAddress = () => {
		const fullAddress = `${address}${locationLabel ? `, ${locationLabel}` : ""}`;
		void navigator.clipboard.writeText(fullAddress);
		setHasCopiedAddress(true);
		toast.success("Address copied to clipboard");
		setTimeout(() => setHasCopiedAddress(false), 2000);
	};

	const handleExportJSON = () => {
		const payload = {
			id: property.id,
			name: property.name,
			type: propertyType,
			category: property.category ?? null,
			ownershipPercentage,
			ownershipStructure: property.ownershipStructure ?? null,
			linkedLoanId: property.linkedLoanId ?? null,
			address,
			city,
			state: property.state,
			country,
			zipCode: property.zipCode,
			surfaceAreaM2: surfaceArea ?? null,
			landSurfaceM2: property.landSurface ?? null,
			yearBuilt: property.yearBuilt ?? null,
			floor: property.floor ?? null,
			totalFloors: property.totalFloors ?? null,
			rooms: property.rooms ?? null,
			bedrooms: property.bedrooms ?? null,
			bathrooms: property.bathrooms ?? null,
			garages: property.garages ?? null,
			parkingSpaces: property.parkingSpaces ?? null,
			energyLabel: property.energyLabel ?? null,
			valuation: currentValue,
			proratedValuation,
			purchasePrice,
			proratedPurchaseCost,
			remainingDebt,
			netEquity,
			ltvPercent: ltv,
			agencyFees: property.agencyFees ?? null,
			notaryFees: property.notaryFees ?? null,
			renovationFees: property.renovationFees ?? null,
			furnishingCosts: property.furnishingCosts ?? null,
			allInCostBasis: allInCost,
			purchaseDate: property.purchaseDate ?? null,
			unrealizedPnl,
			unrealizedPnlPercent,
			rental: hasRentalIncome
				? {
						type: property.rentalType ?? null,
						period: property.rentalPeriod ?? null,
						monthlyRent,
						utilityCosts,
						yearlyMiscCosts,
						grossYieldPercent: annualGrossRentalYield,
						netNetMonthlyCashflow,
					}
				: null,
			exportedAt: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `property_${property.id}_${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("Property specifications exported");
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			if (typeof deleteAsset === "function") {
				await deleteAsset(property.id, currentPortfolio || undefined);
				toast.success("Property deleted successfully");
				setIsDeleteDialogOpen(false);
				onDeleted?.();
				onBack();
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
		<div className="h-full flex flex-col bg-background text-foreground">
			{/* Slide-over Header */}
			<div className="border-b border-border/40 px-5 py-4 bg-card/60 backdrop-blur-xs sticky top-0 z-10">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3 min-w-0">
						<Button
							variant="ghost"
							size="icon"
							onClick={onBack}
							className="h-8 w-8 shrink-0 touch-target mt-0.5"
							aria-label="Back"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<h2 className="text-base sm:text-lg font-bold tracking-tight truncate">
									{property.name}
								</h2>
								<Badge
									variant="outline"
									className="text-[10px] uppercase font-mono px-1.5 py-0 h-4 border-primary/30 text-primary font-semibold"
								>
									{property.category || propertyType}
								</Badge>
								{ownershipPercentage < 100 && (
									<Badge
										variant="secondary"
										className="text-[10px] font-mono px-1.5 py-0 h-4 text-muted-foreground"
									>
										Share {ownershipPercentage}%
									</Badge>
								)}
							</div>

							<div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
								<MapPin className="h-3 w-3 shrink-0" />
								<span className="truncate max-w-[260px]">{address}</span>
								{locationLabel && (
									<>
										<span>•</span>
										<span>{locationLabel}</span>
									</>
								)}
								<button
									type="button"
									onClick={handleCopyAddress}
									className="inline-flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors ml-1"
									title="Copy full address"
								>
									{hasCopiedAddress ? (
										<Check className="h-3 w-3 text-gain" />
									) : (
										<Copy className="h-3 w-3" />
									)}
								</button>
							</div>
						</div>
					</div>

					{/* Header Actions */}
					<div className="flex items-center gap-1.5 shrink-0">
						{isEditing ? (
							<Button
								variant="outline"
								size="sm"
								onClick={handleCancelEditing}
								className="h-8 text-xs gap-1.5 touch-target"
							>
								<X className="h-3.5 w-3.5" />
								<span>Cancel</span>
							</Button>
						) : (
							<Button
								variant="outline"
								size="sm"
								onClick={handleStartEditing}
								className="h-8 text-xs gap-1.5 touch-target"
							>
								<Pencil className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">Edit</span>
							</Button>
						)}

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-muted-foreground hover:text-foreground touch-target"
									aria-label="More options"
								>
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="text-xs">
								<DropdownMenuItem onClick={handleExportJSON}>
									<Download className="h-3.5 w-3.5 mr-2" />
									Export JSON Dossier
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => setIsDeleteDialogOpen(true)}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="h-3.5 w-3.5 mr-2" />
									Delete Property
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>

			{/* Scrollable Content */}
			<ScrollArea className="flex-1">
				{isEditing ? (
					<form onSubmit={handleSaveEditing} className="p-5 space-y-6">
						<div className="flex items-center justify-between border-b border-border/40 pb-3">
							<div>
								<h3 className="text-sm font-bold tracking-tight">Edit Property Specifications</h3>
								<p className="text-xs text-muted-foreground">
									Update valuation, ownership share, linked liabilities, acquisition costs, and architectural specifications
								</p>
							</div>
							<Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary">
								Direct Edit
							</Badge>
						</div>

						{/* Section 1: Identification & Structure Juridique */}
						<div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Building2 className="h-3.5 w-3.5 text-primary" />
								Identity & Ownership
							</h4>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div className="space-y-1.5 sm:col-span-2">
									<Label className="text-xs">Property Name</Label>
									<Input
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										placeholder="e.g. Haussmannian Apartment, Paris 9th"
										className="h-8 text-xs font-medium"
										required
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Ownership Share (%)</Label>
									<div className="relative">
										<Input
											type="number"
											min="1"
											max="100"
											step="0.1"
											value={editOwnershipPercentage}
											onChange={(e) => setEditOwnershipPercentage(e.target.value)}
											className="h-8 text-xs font-mono pr-7"
										/>
										<Percent className="absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
									</div>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Ownership Structure</Label>
									<Select
										value={editOwnershipStructure}
										onValueChange={setEditOwnershipStructure}
									>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="Select" />
										</SelectTrigger>
										<SelectContent>
											{OWNERSHIP_STRUCTURES.map((struct) => (
												<SelectItem key={struct.value} value={struct.value} className="text-xs">
													{struct.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1.5 sm:col-span-2">
									<Label className="text-xs">Linked Bank Mortgage (Associated Liability)</Label>
									<Select
										value={editLinkedLoanId}
										onValueChange={setEditLinkedLoanId}
									>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="No linked mortgage" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none" className="text-xs">
												No linked mortgage
											</SelectItem>
											{loanAssets.map((loan) => (
												<SelectItem key={loan.id} value={loan.id} className="text-xs">
													{loan.name} {loan.lender ? `(${loan.lender})` : ""} — Balance: {formatCurrency(loan.remainingBalance || 0)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						{/* Section 2: Acquisition & Cost Basis */}
						<div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Receipt className="h-3.5 w-3.5 text-primary" />
								Acquisition & Cost Basis
							</h4>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
								<div className="space-y-1.5">
									<Label className="text-xs">Acquisition Date</Label>
									<Input
										type="date"
										value={editPurchaseDate}
										onChange={(e) => setEditPurchaseDate(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Purchase Price (€)</Label>
									<Input
										type="number"
										min="0"
										step="1000"
										value={editPurchasePrice}
										onChange={(e) => setEditPurchasePrice(e.target.value)}
										placeholder="e.g. 185000"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Notary & Legal Fees (€)</Label>
									<Input
										type="number"
										min="0"
										step="100"
										value={editNotaryFees}
										onChange={(e) => setEditNotaryFees(e.target.value)}
										placeholder="e.g. 14200"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Renovation Works (€)</Label>
									<Input
										type="number"
										min="0"
										step="500"
										value={editRenovationFees}
										onChange={(e) => setEditRenovationFees(e.target.value)}
										placeholder="e.g. 30000"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Agency Fees (€)</Label>
									<Input
										type="number"
										min="0"
										step="500"
										value={editAgencyFees}
										onChange={(e) => setEditAgencyFees(e.target.value)}
										placeholder="e.g. 8000"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Furnishing & Equipment (€)</Label>
									<Input
										type="number"
										min="0"
										step="500"
										value={editFurnishingCosts}
										onChange={(e) => setEditFurnishingCosts(e.target.value)}
										placeholder="e.g. 5000"
										className="h-8 text-xs font-mono"
									/>
								</div>
							</div>
						</div>

						{/* Section 3: Valuation */}
						<div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Coins className="h-3.5 w-3.5 text-primary" />
								Valuation
							</h4>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
								<div className="space-y-1.5">
									<Label className="text-xs">Current Valuation (€)</Label>
									<Input
										type="number"
										min="0"
										step="1000"
										value={editCurrentValue}
										onChange={(e) => setEditCurrentValue(e.target.value)}
										className="h-8 text-xs font-mono font-bold"
										required
									/>
								</div>
							</div>
						</div>

						{/* Section 4: Rental Operations & Expenses */}
						<div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Coins className="h-3.5 w-3.5 text-gain" />
								Rental Operations & Expenses
							</h4>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
								<div className="space-y-1.5">
									<Label className="text-xs">Monthly Rent excl. charges (€/mo)</Label>
									<Input
										type="number"
										min="0"
										step="50"
										value={editMonthlyRent}
										onChange={(e) => setEditMonthlyRent(e.target.value)}
										placeholder="e.g. 1250"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">HOA / Maintenance (€/mo)</Label>
									<Input
										type="number"
										min="0"
										step="10"
										value={editUtilityCosts}
										onChange={(e) => setEditUtilityCosts(e.target.value)}
										placeholder="e.g. 120"
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Property Tax (€/yr)</Label>
									<Input
										type="number"
										min="0"
										step="50"
										value={editYearlyMiscCosts}
										onChange={(e) => setEditYearlyMiscCosts(e.target.value)}
										placeholder="e.g. 950"
										className="h-8 text-xs font-mono"
									/>
								</div>
							</div>
						</div>

						{/* Section 5: Architectural Specifications */}
						<div className="space-y-4 p-4 rounded-xl border border-border/50 bg-card">
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Home className="h-3.5 w-3.5 text-primary" />
								Architectural Specifications
							</h4>

							<div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
								<div className="space-y-1.5">
									<Label className="text-xs">Category</Label>
									<Select value={editCategory} onValueChange={setEditCategory}>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="Category" />
										</SelectTrigger>
										<SelectContent>
											{PROPERTY_CATEGORIES.map((cat) => (
												<SelectItem key={cat} value={cat} className="text-xs">
													{cat}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Living Area (m²)</Label>
									<Input
										type="number"
										min="0"
										step="0.5"
										value={editSurface}
										onChange={(e) => setEditSurface(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Land Area (m²)</Label>
									<Input
										type="number"
										min="0"
										step="1"
										value={editLandSurface}
										onChange={(e) => setEditLandSurface(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Total Rooms</Label>
									<Input
										type="number"
										min="0"
										value={editRooms}
										onChange={(e) => setEditRooms(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Bedrooms</Label>
									<Input
										type="number"
										min="0"
										value={editBedrooms}
										onChange={(e) => setEditBedrooms(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Bathrooms</Label>
									<Input
										type="number"
										min="0"
										value={editBathrooms}
										onChange={(e) => setEditBathrooms(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Year Built</Label>
									<Input
										type="number"
										min="1700"
										max="2030"
										value={editYearBuilt}
										onChange={(e) => setEditYearBuilt(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">Floor</Label>
									<Input
										type="number"
										value={editFloor}
										onChange={(e) => setEditFloor(e.target.value)}
										className="h-8 text-xs font-mono"
									/>
								</div>

								<div className="space-y-1.5">
									<Label className="text-xs">EPC / Energy Rating</Label>
									<Select value={editEnergyLabel} onValueChange={setEditEnergyLabel}>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue placeholder="Not specified" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none" className="text-xs">
												Not specified
											</SelectItem>
											{ENERGY_LABELS.map((label) => (
												<SelectItem key={label} value={label} className="text-xs font-bold font-mono">
													Class {label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>

						{/* Bottom Save & Cancel buttons */}
						<div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleCancelEditing}
								disabled={isSaving}
								className="h-9 px-4 text-xs"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="sm"
								disabled={isSaving}
								className="h-9 px-4 text-xs gap-1.5 font-semibold"
							>
								<Save className="h-3.5 w-3.5" />
								{isSaving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</form>
				) : (
					<div className="p-5 space-y-6">
						{/* Financial & Capital Docket */}
						<div className="space-y-3">
							{/* Primary Financial Telemetry: Value, Equity, Return, Density */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-1">
								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground block">
										Current Value
									</span>
									<p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground">
										{formatCurrency(currentValue)}
									</p>
									<span className="text-xs text-muted-foreground block truncate">
										{ownershipPercentage < 100
											? `Share: ${formatCurrency(proratedValuation)} (${ownershipPercentage}%)`
											: "Portfolio Valuation"}
									</span>
								</div>

								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground block">
										Purchase Cost
									</span>
									<p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground">
										{purchasePrice > 0 ? formatCurrency(purchasePrice) : "—"}
									</p>
									<span className="text-xs text-muted-foreground truncate block">
										{effectivePurchaseDate
											? `Acquired ${new Date(effectivePurchaseDate).toLocaleDateString()}${isAcquisitionDateDerived ? " (from loan)" : ""}`
											: "Initial cost"}
									</span>
								</div>

								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground block">
										Capital Return
									</span>
									<div className="flex items-center gap-1.5">
										{unrealizedPnl >= 0 ? (
											<TrendArrowUp className="h-4 w-4 text-gain shrink-0" />
										) : (
											<TrendArrowDown className="h-4 w-4 text-loss shrink-0" />
										)}
										<p
											className={cn(
												"text-lg sm:text-xl font-bold font-mono tracking-tight",
												unrealizedPnl >= 0 ? "text-gain" : "text-loss",
											)}
										>
											{unrealizedPnl >= 0 ? "+" : ""}
											{formatCurrency(unrealizedPnl)}
										</p>
									</div>
									<span className="text-xs text-muted-foreground block truncate">
										{purchasePrice > 0
											? `${unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnlPercent.toFixed(1)}%`
											: "—"}
										{hasAcquisitionCosts && allInCost > 0 && ` (All-in: ${netAllInReturn >= 0 ? "+" : ""}${netAllInReturnPercent.toFixed(1)}%)`}
									</span>
								</div>

								<div className="space-y-0.5">
									<span className="text-xs font-medium text-muted-foreground block">
										Price / m²
									</span>
									<p className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground">
										{pricePerM2 !== null ? `${formatCurrency(pricePerM2)}/m²` : "—"}
									</p>
									<span className="text-xs text-muted-foreground block truncate">
										{surfaceArea ? `${surfaceArea} m²` : "—"}
										{property.marketRentPerM2 ? ` · Rent: ${Math.round(property.marketRentPerM2 * (surfaceArea || 1))} €/mo` : ""}
									</span>
								</div>
							</div>

							{/* Integrated Valuation Bar: Source, Confidence Range, Auto/Manual, Refresh */}
							<div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 text-xs">
								<div className="flex items-center gap-2 flex-wrap">
									<Badge
										variant="outline"
										className={cn(
											"text-micro font-semibold uppercase font-mono px-1.5 py-0 h-4.5",
											property.valuationMode === "MANUAL"
												? "bg-warning/10 text-warning border-warning/30"
												: "bg-gain/10 text-gain border-gain/30",
										)}
									>
										{property.valuationMode === "MANUAL" ? "Manual Mode" : "Auto Mode (Free)"}
									</Badge>

									{property.valuationConfidence && (
										<Badge
											variant="outline"
											className={cn(
												"text-micro font-semibold uppercase font-mono px-1.5 py-0 h-4.5",
												property.valuationConfidence === "HIGH" && "bg-gain/10 text-gain border-gain/30",
												property.valuationConfidence === "MEDIUM" && "bg-info/10 text-info border-info/30",
												property.valuationConfidence === "LOW" && "bg-warning/10 text-warning border-warning/30",
												property.valuationConfidence === "UNAVAILABLE" && "bg-muted text-muted-foreground",
											)}
										>
											{property.valuationConfidence === "HIGH" && "High Confidence"}
											{property.valuationConfidence === "MEDIUM" && "Medium Confidence"}
											{property.valuationConfidence === "LOW" && "Sparse Area"}
											{property.valuationConfidence === "UNAVAILABLE" && "Unavailable"}
										</Badge>
									)}

									<span className="text-xs text-muted-foreground">
										{property.valuationMode === "MANUAL"
											? "User manual fixed value"
											: property.estimationMethod === "DVF_COMPARABLES"
												? `DVF+ comparables (${property.comparablesCount ?? 0} sales)`
												: property.estimationMethod === "INSEE_INDEX"
													? "Notaires-INSEE quarterly index"
													: "Acquisition cost"}
									</span>

									{property.estimatedMin && property.estimatedMax && (
										<span className="text-xs font-mono text-muted-foreground">
											({formatCurrency(property.estimatedMin)} – {formatCurrency(property.estimatedMax)})
										</span>
									)}
								</div>

								<div className="flex items-center gap-1.5 ml-auto">
									<div className="flex items-center bg-background p-0.5 rounded border border-border/40 text-[11px]">
										<button
											type="button"
											onClick={() => handleToggleValuationMode("AUTO")}
											className={cn(
												"px-2 py-0.5 rounded font-medium transition-colors",
												property.valuationMode !== "MANUAL"
													? "bg-muted text-foreground font-semibold shadow-2xs"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											Auto
										</button>
										<button
											type="button"
											onClick={() => handleToggleValuationMode("MANUAL")}
											className={cn(
												"px-2 py-0.5 rounded font-medium transition-colors",
												property.valuationMode === "MANUAL"
													? "bg-muted text-foreground font-semibold shadow-2xs"
													: "text-muted-foreground hover:text-foreground",
											)}
										>
											Manual
										</button>
									</div>

									<Button
										type="button"
										size="sm"
										variant="ghost"
										disabled={isRefreshingValuation}
										onClick={handleRefreshValuation}
										className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground touch-target"
										title="Refresh valuation with latest INSEE/DVF data"
									>
										<RefreshCw
											className={cn(
												"h-3 w-3",
												isRefreshingValuation && "animate-spin text-primary",
											)}
										/>
										<span>Refresh</span>
									</Button>
								</div>
							</div>

							{/* Manual override input bar if in manual mode */}
							{property.valuationMode === "MANUAL" && (
								<div className="p-2.5 rounded-lg bg-warning/5 border border-warning/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
									<div className="flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-warning shrink-0" />
										<span className="text-xs text-warning">
											Manual mode: automatic index updates are disabled. Enter your custom valuation:
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Input
											type="number"
											step="any"
											placeholder={String(property.manualValue || currentValue)}
											value={manualValuationInput}
											onChange={(e) => setManualValuationInput(e.target.value)}
											className="h-7 w-32 text-xs font-mono"
										/>
										<Button
											type="button"
											size="sm"
											disabled={isSavingManualVal}
											onClick={handleSaveManualValuation}
											className="h-7 px-3 text-xs"
										>
											Save
										</Button>
									</div>
								</div>
							)}
						</div>

						{/* Bank Financing & LTV Ratio (Integrated ledger) */}
						{(linkedLoan || hasRentalIncome) && (
							<div className="border-t border-border/40 pt-4 space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Landmark className="h-4 w-4 text-primary" />
										<h3 className="text-sm font-semibold tracking-tight text-foreground">
											Bank Financing & LTV Ratio
										</h3>
									</div>
									{linkedLoan && (
										<Badge
											variant="outline"
											className={cn(
												"text-[10px] font-mono font-semibold px-1.5 py-0 h-4.5",
												ltv <= 60
													? "border-gain/40 text-gain bg-gain/5"
													: ltv <= 80
														? "border-warning/40 text-warning bg-warning/5"
														: "border-loss/40 text-loss bg-loss/5",
											)}
										>
											LTV {ltv.toFixed(0)}% • {ltv <= 60 ? "Safe" : ltv <= 80 ? "Moderate" : "High Leverage"}
										</Badge>
									)}
								</div>

								{linkedLoan && (
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
										<div>
											<span className="text-xs text-muted-foreground block">Lender</span>
											<span className="text-sm font-medium mt-0.5 block truncate">
												{linkedLoan.lender || linkedLoan.name}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Remaining Debt</span>
											<span className="text-sm font-mono font-bold mt-0.5 block">
												{formatCurrency(remainingDebt)}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Monthly Payment</span>
											<span className="text-sm font-mono font-medium mt-0.5 block">
												{monthlyLoanPayment > 0 ? `${formatCurrency(monthlyLoanPayment)}/mo` : "—"}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Net Acquired Equity</span>
											<span className="text-sm font-mono font-bold mt-0.5 block text-gain">
												{formatCurrency(netEquity)}
											</span>
										</div>
									</div>
								)}

								{hasRentalIncome && (
									<div className="pt-2 flex items-center justify-between flex-wrap gap-2 text-xs">
										<div className="flex items-center gap-2 text-muted-foreground text-xs flex-wrap">
											<span className="font-semibold text-foreground">Rental: {formatCurrency(monthlyRent)}/mo</span>
											<span>•</span>
											<span>Charges: {formatCurrency(utilityCosts)}/mo</span>
											<span>•</span>
											<span>Taxes: {formatCurrency(Math.round(yearlyMiscCosts / 12))}/mo</span>
											{annualGrossRentalYield !== null && (
												<>
													<span>•</span>
													<span>Yield: {annualGrossRentalYield.toFixed(2)}%</span>
												</>
											)}
										</div>

										{netNetMonthlyCashflow !== null && (
											<div
												className={cn(
													"inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold",
													netNetMonthlyCashflow >= 0
														? "bg-gain/10 text-gain border border-gain/20"
														: "bg-warning/10 text-warning border border-warning/20",
												)}
											>
												{netNetMonthlyCashflow >= 0 ? (
													<>
														<span>Net Cashflow :</span>
														<span>+{formatCurrency(netNetMonthlyCashflow)} / mo</span>
													</>
												) : (
													<>
														<span>Net Savings Effort :</span>
														<span>-{formatCurrency(Math.abs(netNetMonthlyCashflow))} / mo</span>
													</>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{/* Valuation Trajectory Chart */}
						<div className="border-t border-border/40 pt-4 space-y-2">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-sm font-semibold tracking-tight text-foreground">
										Valuation Trajectory
									</h3>
									<p className="text-xs text-muted-foreground mt-0.5">
										Honest linear appreciation between acquisition and current recorded value
									</p>
								</div>
								<PageTimeframeSelector
									value={timeRange}
									onChange={setTimeRange}
									ranges={["1M", "3M", "YTD", "1Y", "ALL"]}
								/>
							</div>

							<div className="pt-1">
								<AssetDetailChart
									data={chartData}
									symbol={property.symbol || "Property"}
									initialChartType="area"
									showIndicators={false}
									showTypeSelector={false}
									height={160}
									timeRange={timeRange}
								/>
							</div>
						</div>

						{/* Consolidated Technical Specifications & Dossier */}
						<div className="border-t border-border/40 pt-4 space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold tracking-tight text-foreground">
									Property Specifications
								</h3>
								{property.energyLabel && (
									<div className="flex items-center gap-1.5">
										<span className="text-xs text-muted-foreground">DPE:</span>
										<span className="px-2 py-0.5 rounded text-micro font-bold bg-foreground text-background font-mono">
											{property.energyLabel}
										</span>
									</div>
								)}
							</div>

							{/* Acquisition Breakdown sub-ledger if recorded */}
							{hasAcquisitionCosts && (
								<div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-xs font-semibold text-muted-foreground">
											Acquisition Breakdown & Cost Basis
										</span>
										<span className="text-xs font-mono font-semibold text-foreground">
											All-in: {formatCurrency(allInCost)}
										</span>
									</div>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-0.5">
										<div>
											<span className="text-xs text-muted-foreground block">Agency</span>
											<span className="text-sm font-mono font-medium block">
												{agencyFees > 0 ? formatCurrency(agencyFees) : "—"}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Notary</span>
											<span className="text-sm font-mono font-medium block">
												{notaryFees > 0 ? formatCurrency(notaryFees) : "—"}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Works</span>
											<span className="text-sm font-mono font-medium block">
												{renovationFees > 0 ? formatCurrency(renovationFees) : "—"}
											</span>
										</div>
										<div>
											<span className="text-xs text-muted-foreground block">Furnishing</span>
											<span className="text-sm font-mono font-medium block">
												{furnishingCosts > 0 ? formatCurrency(furnishingCosts) : "—"}
											</span>
										</div>
									</div>
								</div>
							)}

							{/* Specifications Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3.5 gap-x-4">
								<div>
									<span className="text-xs text-muted-foreground block">Property Category</span>
									<span className="text-sm font-medium mt-0.5 block">{property.category || propertyType}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Ownership & Structure</span>
									<span className="text-sm font-medium mt-0.5 block">
										{getOwnershipStructureLabel(property.ownershipStructure)} ({ownershipPercentage}%)
									</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Living Area</span>
									<span className="text-sm font-medium mt-0.5 block">{surfaceArea ? `${surfaceArea} m²` : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Land Area</span>
									<span className="text-sm font-medium mt-0.5 block">{property.landSurface ? `${property.landSurface} m²` : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Purchase Price / m²</span>
									<span className="text-sm font-medium font-mono mt-0.5 block">
										{purchasePricePerM2 !== null ? `${formatCurrency(purchasePricePerM2)} / m²` : "—"}
									</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Year Built</span>
									<span className="text-sm font-medium mt-0.5 block">{property.yearBuilt ? String(property.yearBuilt) : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Floor / Total Floors</span>
									<span className="text-sm font-medium mt-0.5 block">
										{property.floor !== undefined ? `${property.floor} / ${property.totalFloors ?? "—"}` : "—"}
									</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Total Rooms</span>
									<span className="text-sm font-medium mt-0.5 block">{property.rooms ? String(property.rooms) : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Bedrooms</span>
									<span className="text-sm font-medium mt-0.5 block">{property.bedrooms ? String(property.bedrooms) : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Bathrooms</span>
									<span className="text-sm font-medium mt-0.5 block">{property.bathrooms ? String(property.bathrooms) : "—"}</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Parking & Garages</span>
									<span className="text-sm font-medium mt-0.5 block">
										{property.garages || property.parkingSpaces
											? `${property.garages ?? 0} garage(s), ${property.parkingSpaces ?? 0} pkg`
											: "—"}
									</span>
								</div>

								<div>
									<span className="text-xs text-muted-foreground block">Acquisition Date</span>
									<div className="mt-0.5 text-sm font-medium">
										{effectivePurchaseDate ? (
											<div className="flex items-center gap-1.5">
												<span>{new Date(effectivePurchaseDate).toLocaleDateString()}</span>
												{isAcquisitionDateDerived && (
													<span className="text-xs text-muted-foreground font-normal">
														(from loan)
													</span>
												)}
											</div>
										) : (
											"—"
										)}
									</div>
								</div>

								<div className="col-span-2 sm:col-span-3 pt-1 border-t border-border/30">
									<span className="text-xs text-muted-foreground block">Location & Jurisdiction</span>
									<div className="flex items-center gap-1.5 mt-0.5 text-sm font-medium">
										<MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
										<span>
											{[address, city, property.state, country, property.zipCode]
												.filter(Boolean)
												.join(", ")}
										</span>
									</div>
								</div>
							</div>

							{/* Integrated Amenities & Finishes */}
							{(amenitiesList.length > 0 || hasConditionRatings) && (
								<div className="pt-3 border-t border-border/30 space-y-3">
									{amenitiesList.length > 0 && (
										<div className="space-y-1.5">
											<span className="text-xs font-semibold text-muted-foreground block">
												Amenities
											</span>
											<div className="flex flex-wrap gap-1.5">
												{amenitiesList.map((item) => (
													<span
														key={item.label}
														className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/40 border border-border/40 text-xs font-medium text-foreground"
													>
														<Check className="h-3 w-3 text-primary" />
														{item.label}
													</span>
												))}
											</div>
										</div>
									)}

									{hasConditionRatings && (
										<div className="space-y-1.5">
											<span className="text-xs font-semibold text-muted-foreground block">
												Condition & Finishes
											</span>
											<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
												{property.condition && (
													<div>
														<span className="text-xs text-muted-foreground block">Overall</span>
														<span className="text-sm font-medium mt-0.5 block">{property.condition}</span>
													</div>
												)}
												{property.generalQuality && (
													<div>
														<span className="text-xs text-muted-foreground block">Quality</span>
														<span className="text-sm font-medium mt-0.5 block">{property.generalQuality}</span>
													</div>
												)}
												{property.kitchenQuality && (
													<div>
														<span className="text-xs text-muted-foreground block">Kitchen</span>
														<span className="text-sm font-medium mt-0.5 block">{property.kitchenQuality}</span>
													</div>
												)}
												{property.bathroomQuality && (
													<div>
														<span className="text-xs text-muted-foreground block">Bathroom</span>
														<span className="text-sm font-medium mt-0.5 block">{property.bathroomQuality}</span>
													</div>
												)}
												{property.flooringQuality && (
													<div>
														<span className="text-xs text-muted-foreground block">Flooring</span>
														<span className="text-sm font-medium mt-0.5 block">{property.flooringQuality}</span>
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				)}
			</ScrollArea>

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent className="max-w-md bg-card border border-border/60">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="h-5 w-5" />
							Delete Property
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground pt-1">
							Are you sure you want to remove <strong>{property.name}</strong> from your portfolio?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0 pt-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setIsDeleteDialogOpen(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDelete}
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
