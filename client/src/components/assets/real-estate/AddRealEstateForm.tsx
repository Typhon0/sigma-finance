import { motion, useReducedMotion } from "framer-motion";
import {
	Bath,
	Bed,
	Building2,
	Calendar,
	Car,
	Coins,
	FileText,
	Home,
	Info,
	Layers,
	MapPin,
	Maximize,
	Plus,
	ShieldCheck,
	Sparkles,
	Trees,
	Waves,
	X,
	Zap,
	AlertCircle,
	CheckCircle2,
	TrendingUp,
} from "lucide-react";
import { useLazyQuery } from "@apollo/client";
import { ESTIMATE_REAL_ESTATE, FETCH_ADEME_DPE } from "@/graphql/queries/real-estate";
import { AddressAutocomplete, type AddressData } from "./AddressAutocomplete";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export interface AddRealEstateFormSubmitData {
	name: string;
	type: string;
	address: string;
	city: string;
	state?: string;
	postalCode?: string;
	country: string;
	surface?: string;
	currentValuation: string;
	purchasePrice: string;
	purchaseDate?: string;
	yearBuilt?: string;
	bedrooms?: string;
	bathrooms?: string;
	monthlyRent?: string;

	category?: string;
	landSurface?: string;
	rooms?: string;
	floor?: string;
	totalFloors?: string;
	garages?: string;
	parkingSpaces?: string;
	energyLabel?: string;
	condition?: string;
	agencyFees?: string;
	notaryFees?: string;
	renovationFees?: string;
	furnishingCosts?: string;
	rentalType?: string;
	rentalPeriod?: string;
	utilityCosts?: string;
	yearlyMiscCosts?: string;
	hasGarden?: boolean;
	hasBalcony?: boolean;
	hasLift?: boolean;
	hasPool?: boolean;
	hasSauna?: boolean;
	isFurnished?: boolean;
	isNewConstruction?: boolean;
	kitchenQuality?: string;
	kitchenCondition?: string;
	bathroomQuality?: string;
	bathroomCondition?: string;
	flooringQuality?: string;
	flooringCondition?: string;
	windowsQuality?: string;
	windowsCondition?: string;
	generalQuality?: string;
	generalCondition?: string;

	linkedLoanId?: string;
	ownershipPercentage?: string;
	ownershipStructure?: string;

	// BAN & Auto-Valuation
	addressLabel?: string;
	cityCode?: string;
	banId?: string;
	latitude?: number;
	longitude?: number;
	hasOutdoor?: boolean;
	isGroundFloor?: boolean;
	valuationMode?: "AUTO" | "MANUAL";
	manualValue?: string;
}

interface AddRealEstateFormProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (data: AddRealEstateFormSubmitData) => Promise<void> | void;
}

type FormTab = "identity" | "financials" | "specifications" | "amenities" | "rental";

const PROPERTY_TYPES = [
	{ value: "House", label: "House / Villa" },
	{ value: "Apartment", label: "Apartment / Condo" },
	{ value: "Building", label: "Multi-Family / Building" },
	{ value: "Commercial", label: "Commercial / Retail" },
	{ value: "Office", label: "Office Space" },
	{ value: "Land", label: "Land / Plot" },
	{ value: "Parking", label: "Parking / Garage" },
	{ value: "Other", label: "Other Real Estate" },
];

const PROPERTY_CATEGORIES = [
	{ value: "Residential", label: "Residential" },
	{ value: "Commercial", label: "Commercial" },
	{ value: "Industrial", label: "Industrial / Logistics" },
	{ value: "Land", label: "Land / Development" },
	{ value: "Special", label: "Special Asset / Other" },
];

const ENERGY_LABELS = ["A", "B", "C", "D", "E", "F", "G"];

const CONDITION_OPTIONS = [
	{ value: "New", label: "Brand New / Mint" },
	{ value: "Excellent", label: "Excellent Condition" },
	{ value: "Good", label: "Good / Maintained" },
	{ value: "Fair", label: "Fair / Refresh needed" },
	{ value: "To Renovate", label: "Renovation Needed" },
	{ value: "Heavy Renovation", label: "Full Rehabilitation" },
];

const QUALITY_OPTIONS = [
	{ value: "Luxury", label: "Luxury / High-End" },
	{ value: "High", label: "Superior Quality" },
	{ value: "Standard", label: "Standard / Good" },
	{ value: "Basic", label: "Basic / Economy" },
];

const RENTAL_TYPES = [
	{ value: "None", label: "None (Owner Occupied / Vacant)" },
	{ value: "Unfurnished", label: "Long-term Unfurnished" },
	{ value: "Furnished", label: "Long-term Furnished" },
	{ value: "Short-term", label: "Short-term / Seasonal (Airbnb)" },
	{ value: "Commercial", label: "Commercial Lease" },
];

const OWNERSHIP_STRUCTURES = [
	{ value: "Nom propre", label: "Nom propre (Pleine propriété)" },
	{ value: "Indivision", label: "Indivision" },
	{ value: "SCI à l'IR", label: "SCI à l'IR" },
	{ value: "SCI à l'IS", label: "SCI à l'IS" },
	{ value: "SARL de famille", label: "SARL de famille" },
	{ value: "Nue-propriété", label: "Démembrement (Nue-propriété)" },
	{ value: "Usufruit", label: "Démembrement (Usufruit)" },
];

export function AddRealEstateForm({ open, onClose, onSubmit }: AddRealEstateFormProps) {
	const shouldReduceMotion = useReducedMotion();
	const { formatCurrency } = useCurrency();
	const { assets } = usePortfolio();
	const availableLoans = useMemo(
		() => assets.filter((a) => a.type === "loan"),
		[assets],
	);

	const [activeTab, setActiveTab] = useState<FormTab>("identity");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 1. Identity & Location & Structure
	const [name, setName] = useState("");
	const [category, setCategory] = useState("Residential");
	const [propertyType, setPropertyType] = useState("House");
	const [address, setAddress] = useState("");
	const [city, setCity] = useState("");
	const [stateProvince, setStateProvince] = useState("");
	const [postalCode, setPostalCode] = useState("");
	const [country, setCountry] = useState("France");

	// BAN & Auto-Valuation State
	const [addressLabel, setAddressLabel] = useState("");
	const [cityCode, setCityCode] = useState("");
	const [banId, setBanId] = useState("");
	const [latitude, setLatitude] = useState<number | undefined>(undefined);
	const [longitude, setLongitude] = useState<number | undefined>(undefined);
	const [valuationMode, setValuationMode] = useState<"AUTO" | "MANUAL">("AUTO");
	const [manualValue, setManualValue] = useState("");
	const [detectedDpe, setDetectedDpe] = useState<{
		rating: string;
		surfaceM2?: number;
		diagnosticDate?: string;
	} | null>(null);

	// Queries
	const [fetchDpe, { loading: isDpeLoading }] = useLazyQuery(FETCH_ADEME_DPE, {
		fetchPolicy: "network-only",
		onCompleted: (data) => {
			if (data?.fetchADEMEDpe) {
				setDetectedDpe({
					rating: data.fetchADEMEDpe.rating,
					surfaceM2: data.fetchADEMEDpe.surfaceM2 || undefined,
					diagnosticDate: data.fetchADEMEDpe.diagnosticDate || undefined,
				});
			} else {
				setDetectedDpe(null);
			}
		},
	});

	const [estimateRealEstate, { data: estimationData, loading: isEstimating }] = useLazyQuery(
		ESTIMATE_REAL_ESTATE,
		{ fetchPolicy: "network-only" },
	);

	const [ownershipPercentage, setOwnershipPercentage] = useState("100");
	const [ownershipStructure, setOwnershipStructure] = useState("Nom propre");
	const [linkedLoanId, setLinkedLoanId] = useState("none");

	// 2. Financials & Costs
	const [purchasePrice, setPurchasePrice] = useState("");
	const [currentValuation, setCurrentValuation] = useState("");
	const [purchaseDate, setPurchaseDate] = useState<Date | undefined>(undefined);
	const [agencyFees, setAgencyFees] = useState("");
	const [notaryFees, setNotaryFees] = useState("");
	const [renovationFees, setRenovationFees] = useState("");
	const [furnishingCosts, setFurnishingCosts] = useState("");

	// 3. Specs & Layout
	const [surface, setSurface] = useState("");
	const [landSurface, setLandSurface] = useState("");
	const [yearBuilt, setYearBuilt] = useState("");
	const [floor, setFloor] = useState("");
	const [totalFloors, setTotalFloors] = useState("");
	const [rooms, setRooms] = useState("");
	const [bedrooms, setBedrooms] = useState("");
	const [bathrooms, setBathrooms] = useState("");
	const [garages, setGarages] = useState("");
	const [parkingSpaces, setParkingSpaces] = useState("");
	const [energyLabel, setEnergyLabel] = useState<string>("");

	// 4. Amenities & Quality
	const [hasGarden, setHasGarden] = useState(false);
	const [hasBalcony, setHasBalcony] = useState(false);
	const [hasLift, setHasLift] = useState(false);
	const [hasPool, setHasPool] = useState(false);
	const [hasSauna, setHasSauna] = useState(false);
	const [isFurnished, setIsFurnished] = useState(false);
	const [isNewConstruction, setIsNewConstruction] = useState(false);

	const [condition, setCondition] = useState("");
	const [generalQuality, setGeneralQuality] = useState("");
	const [kitchenQuality, setKitchenQuality] = useState("");
	const [kitchenCondition, setKitchenCondition] = useState("");
	const [bathroomQuality, setBathroomQuality] = useState("");
	const [bathroomCondition, setBathroomCondition] = useState("");
	const [flooringQuality, setFlooringQuality] = useState("");
	const [flooringCondition, setFlooringCondition] = useState("");
	const [windowsQuality, setWindowsQuality] = useState("");
	const [windowsCondition, setWindowsCondition] = useState("");

	// 5. Rental Stream
	const [rentalType, setRentalType] = useState("None");
	const [rentalPeriod, setRentalPeriod] = useState("Monthly");
	const [monthlyRent, setMonthlyRent] = useState("");
	const [utilityCosts, setUtilityCosts] = useState("");
	const [yearlyMiscCosts, setYearlyMiscCosts] = useState("");

	// Live telemetry calculations
	const numSurface = parseFloat(surface) || 0;
	const numPurchase = parseFloat(purchasePrice) || 0;
	const numValuation = parseFloat(currentValuation) || numPurchase;
	const numAgency = parseFloat(agencyFees) || 0;
	const numNotary = parseFloat(notaryFees) || 0;
	const numReno = parseFloat(renovationFees) || 0;
	const numFurnish = parseFloat(furnishingCosts) || 0;
	const allInCost = numPurchase + numAgency + numNotary + numReno + numFurnish;

	const livePricePerM2 =
		numSurface > 0 && numValuation > 0 ? Math.round(numValuation / numSurface) : null;
	const livePnl = numValuation - (allInCost > 0 ? allInCost : numPurchase);
	const livePnlPercent =
		(allInCost > 0 ? allInCost : numPurchase) > 0
			? (livePnl / (allInCost > 0 ? allInCost : numPurchase)) * 100
			: 0;

	const numRent = parseFloat(monthlyRent) || 0;
	const numUtility = parseFloat(utilityCosts) || 0;
	const numYearlyMisc = parseFloat(yearlyMiscCosts) || 0;
	const grossYield =
		numRent > 0 && numValuation > 0 ? ((numRent * 12) / numValuation) * 100 : null;
	const netMonthlyCashflow =
		numRent > 0 ? numRent - numUtility - numYearlyMisc / 12 : null;

	const handleAddressSelected = (data: AddressData) => {
		setAddress(data.address);
		setCity(data.city);
		setPostalCode(data.zipCode);
		setCountry(data.country || "France");
		setAddressLabel(data.addressLabel);
		setCityCode(data.cityCode);
		setBanId(data.banId);
		setLatitude(data.latitude);
		setLongitude(data.longitude);

		if (data.banId && numSurface > 0) {
			fetchDpe({
				variables: {
					banId: data.banId,
					surfaceM2: numSurface,
					propertyType,
				},
			});
		}
	};

	// Query ADEME DPE when surface is updated and banId is known
	useEffect(() => {
		if (banId && numSurface > 0) {
			fetchDpe({
				variables: {
					banId,
					surfaceM2: numSurface,
					propertyType,
				},
			});
		}
	}, [banId, numSurface, propertyType, fetchDpe]);

	// Estimate real estate on the fly
	useEffect(() => {
		if (numSurface > 0 && (cityCode || (latitude && longitude) || address)) {
			const timeout = setTimeout(() => {
				estimateRealEstate({
					variables: {
						input: {
							propertyType,
							surfaceM2: numSurface,
							latitude: latitude ?? undefined,
							longitude: longitude ?? undefined,
							cityCode: cityCode || undefined,
							address: address || undefined,
							city: city || undefined,
							postcode: postalCode || undefined,
							banId: banId || undefined,
							energyLabel: energyLabel || undefined,
							condition: condition || undefined,
							purchasePrice: numPurchase > 0 ? numPurchase : undefined,
							purchaseDate: purchaseDate ? purchaseDate.toISOString() : undefined,
							isGroundFloor: floor === "0" || propertyType === "House",
							hasOutdoor: hasGarden || hasBalcony,
							roomsCount: parseInt(rooms, 10) || undefined,
						},
					},
				});
			}, 350);
			return () => clearTimeout(timeout);
		}
	}, [
		cityCode,
		latitude,
		longitude,
		address,
		city,
		postalCode,
		banId,
		propertyType,
		numSurface,
		energyLabel,
		condition,
		numPurchase,
		purchaseDate,
		floor,
		hasGarden,
		hasBalcony,
		rooms,
		estimateRealEstate,
	]);

	// Auto-fill valuation if in AUTO mode
	const liveEstimation = estimationData?.estimateRealEstate;
	useEffect(() => {
		if (valuationMode === "AUTO" && liveEstimation?.estimatedValue) {
			setCurrentValuation(Math.round(liveEstimation.estimatedValue).toString());
		}
	}, [valuationMode, liveEstimation]);

	const resetForm = () => {
		setName("");
		setCategory("Residential");
		setPropertyType("House");
		setAddress("");
		setCity("");
		setStateProvince("");
		setPostalCode("");
		setCountry("France");
		setPurchasePrice("");
		setCurrentValuation("");
		setPurchaseDate(undefined);
		setAgencyFees("");
		setNotaryFees("");
		setRenovationFees("");
		setFurnishingCosts("");
		setSurface("");
		setLandSurface("");
		setYearBuilt("");
		setFloor("");
		setTotalFloors("");
		setRooms("");
		setBedrooms("");
		setBathrooms("");
		setGarages("");
		setParkingSpaces("");
		setEnergyLabel("");
		setHasGarden(false);
		setHasBalcony(false);
		setHasLift(false);
		setHasPool(false);
		setHasSauna(false);
		setIsFurnished(false);
		setIsNewConstruction(false);
		setCondition("");
		setGeneralQuality("");
		setKitchenQuality("");
		setKitchenCondition("");
		setBathroomQuality("");
		setBathroomCondition("");
		setFlooringQuality("");
		setFlooringCondition("");
		setWindowsQuality("");
		setWindowsCondition("");
		setRentalType("None");
		setRentalPeriod("Monthly");
		setMonthlyRent("");
		setUtilityCosts("");
		setYearlyMiscCosts("");
		setOwnershipPercentage("100");
		setOwnershipStructure("Nom propre");
		setLinkedLoanId("none");
		setAddressLabel("");
		setCityCode("");
		setBanId("");
		setLatitude(undefined);
		setLongitude(undefined);
		setValuationMode("AUTO");
		setManualValue("");
		setDetectedDpe(null);
		setActiveTab("identity");
	};

	const handleDialogClose = () => {
		resetForm();
		onClose();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!name.trim()) {
			toast.error("Please enter a property name (e.g. 'Villa Cap Ferret')");
			setActiveTab("identity");
			return;
		}

		if (!city.trim()) {
			toast.error("Please enter the city where the property is located");
			setActiveTab("identity");
			return;
		}

		const valStr = currentValuation.trim() || purchasePrice.trim() || "0";
		const priceStr = purchasePrice.trim() || currentValuation.trim() || "0";

		setIsSubmitting(true);
		try {
			await onSubmit({
				name: name.trim(),
				category: category.trim() || undefined,
				type: propertyType,
				address: address.trim(),
				city: city.trim(),
				state: stateProvince.trim() || undefined,
				postalCode: postalCode.trim() || undefined,
				country: country.trim() || "France",
				surface: surface.trim() || undefined,
				landSurface: landSurface.trim() || undefined,
				currentValuation: valStr,
				purchasePrice: priceStr,
				purchaseDate: purchaseDate ? purchaseDate.toISOString() : undefined,
				agencyFees: agencyFees.trim() || undefined,
				notaryFees: notaryFees.trim() || undefined,
				renovationFees: renovationFees.trim() || undefined,
				furnishingCosts: furnishingCosts.trim() || undefined,
				yearBuilt: yearBuilt.trim() || undefined,
				floor: floor.trim() || undefined,
				totalFloors: totalFloors.trim() || undefined,
				rooms: rooms.trim() || undefined,
				bedrooms: bedrooms.trim() || undefined,
				bathrooms: bathrooms.trim() || undefined,
				garages: garages.trim() || undefined,
				parkingSpaces: parkingSpaces.trim() || undefined,
				energyLabel: energyLabel.trim() || undefined,
				hasGarden,
				hasBalcony,
				hasLift,
				hasPool,
				hasSauna,
				isFurnished,
				isNewConstruction,
				condition: condition.trim() || undefined,
				generalQuality: generalQuality.trim() || undefined,
				kitchenQuality: kitchenQuality.trim() || undefined,
				kitchenCondition: kitchenCondition.trim() || undefined,
				bathroomQuality: bathroomQuality.trim() || undefined,
				bathroomCondition: bathroomCondition.trim() || undefined,
				flooringQuality: flooringQuality.trim() || undefined,
				flooringCondition: flooringCondition.trim() || undefined,
				windowsQuality: windowsQuality.trim() || undefined,
				windowsCondition: windowsCondition.trim() || undefined,
				rentalType: rentalType.trim() || undefined,
				rentalPeriod: rentalPeriod.trim() || undefined,
				monthlyRent: monthlyRent.trim() || undefined,
				utilityCosts: utilityCosts.trim() || undefined,
				yearlyMiscCosts: yearlyMiscCosts.trim() || undefined,
				linkedLoanId: linkedLoanId && linkedLoanId !== "none" ? linkedLoanId : undefined,
				ownershipPercentage: ownershipPercentage.trim() || "100",
				ownershipStructure: ownershipStructure.trim() || "Nom propre",

				// BAN & Auto-Valuation
				addressLabel: addressLabel || undefined,
				cityCode: cityCode || undefined,
				banId: banId || undefined,
				latitude,
				longitude,
				hasOutdoor: hasGarden || hasBalcony,
				isGroundFloor: floor === "0" || propertyType === "House",
				valuationMode,
				manualValue: valuationMode === "MANUAL" ? (manualValue || currentValuation) : undefined,
			});

			resetForm();
		} catch (err) {
			// error handled in parent
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDialogClose()}>
			<DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden bg-card border border-border/60 shadow-xl max-h-[90vh] flex flex-col">
				{/* Dialog Header */}
				<DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
					<div className="flex items-center gap-2.5">
						<div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
							<Building2 className="h-4 w-4" />
						</div>
						<div>
							<DialogTitle className="text-base font-bold text-foreground">
								Add Real Estate Property
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground mt-0.5">
								Complete acquisition, technical characteristics, DPE, amenities, and rental stream.
							</DialogDescription>
						</div>
					</div>

					{/* 5-Tab Segmented Navigator */}
					<div
						className="relative flex p-0.5 rounded-lg bg-muted border border-border/40 mt-3.5 text-xs font-semibold overflow-x-auto no-scrollbar"
						role="tablist"
						aria-label="Add property steps"
					>
						{[
							{ id: "identity", label: "1. Identity" },
							{ id: "financials", label: "2. Financials" },
							{ id: "specifications", label: "3. Specs" },
							{ id: "amenities", label: "4. Quality" },
							{ id: "rental", label: "5. Rental" },
						].map((tab) => (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={activeTab === tab.id}
								onClick={() => setActiveTab(tab.id as FormTab)}
								className={cn(
									"relative flex-1 py-1.5 px-2 rounded-md transition-colors cursor-pointer text-center touch-target min-h-[30px] whitespace-nowrap",
									activeTab === tab.id
										? "text-foreground font-bold"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{activeTab === tab.id && (
									<motion.span
										layoutId="addRealEstateActiveTab"
										className="absolute inset-0 rounded-md bg-background border border-border/60 shadow-xs"
										transition={
											shouldReduceMotion
												? { duration: 0 }
												: { type: "spring", stiffness: 500, damping: 38 }
										}
									/>
								)}
								<span className="relative z-10">{tab.label}</span>
							</button>
						))}
					</div>
				</DialogHeader>

				{/* Form Body with Smooth Overflow Scrolling */}
				<form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
					<div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
						{/* ============================================================== */}
						{/* TAB 1: IDENTITY & LOCATION                                     */}
						{/* ============================================================== */}
						{activeTab === "identity" && (
							<div className="space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
									<div className="space-y-1.5 sm:col-span-2">
										<Label htmlFor="prop-name" className="text-xs font-semibold">
											Property Designation <span className="text-destructive">*</span>
										</Label>
										<Input
											id="prop-name"
											placeholder="e.g. Villa Cap Ferret, Appartement Haussmann..."
											value={name}
											onChange={(e) => setName(e.target.value)}
											className="h-9 text-xs"
											autoFocus
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-category" className="text-xs font-semibold">
											Asset Category
										</Label>
										<Select value={category} onValueChange={setCategory}>
											<SelectTrigger id="prop-category" className="h-9 text-xs">
												<SelectValue placeholder="Select category" />
											</SelectTrigger>
											<SelectContent>
												{PROPERTY_CATEGORIES.map((cat) => (
													<SelectItem key={cat.value} value={cat.value} className="text-xs">
														{cat.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-type" className="text-xs font-semibold">
											Property Type
										</Label>
										<Select value={propertyType} onValueChange={setPropertyType}>
											<SelectTrigger id="prop-type" className="h-9 text-xs">
												<SelectValue placeholder="Select property type" />
											</SelectTrigger>
											<SelectContent>
												{PROPERTY_TYPES.map((type) => (
													<SelectItem key={type.value} value={type.value} className="text-xs">
														{type.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5 sm:col-span-2">
										<Label htmlFor="prop-address" className="text-xs font-semibold">
											Adresse (Autocomplétion BAN Géoplateforme)
										</Label>
										<AddressAutocomplete
											value={address}
											onChange={handleAddressSelected}
											onRawChange={(val) => setAddress(val)}
											placeholder="ex. 14 Boulevard Saint-Germain, 75005 Paris..."
										/>
										{addressLabel && (
											<span className="text-micro text-muted-foreground flex items-center gap-1 mt-1">
												<CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
												Normalisée : <strong className="font-medium text-foreground">{addressLabel}</strong>
												{cityCode && ` (INSEE: ${cityCode})`}
											</span>
										)}
									</div>

									{detectedDpe && (
										<div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs sm:col-span-2">
											<div className="flex items-center gap-2">
												<Zap className="h-4 w-4 text-emerald-500 shrink-0" />
												<span>
													Diagnostic ADEME officiel trouvé : Classe{" "}
													<strong className="font-bold underline text-foreground">{detectedDpe.rating}</strong>
													{detectedDpe.surfaceM2 ? ` (${detectedDpe.surfaceM2} m²)` : ""}
												</span>
											</div>
											<Button
												type="button"
												size="sm"
												variant="outline"
												className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700 border-none"
												onClick={() => {
													setEnergyLabel(detectedDpe.rating);
													toast.success(`DPE ${detectedDpe.rating} appliqué !`);
												}}
											>
												Appliquer
											</Button>
										</div>
									)}

									<div className="space-y-1.5">
										<Label htmlFor="prop-city" className="text-xs font-semibold">
											City <span className="text-destructive">*</span>
										</Label>
										<Input
											id="prop-city"
											placeholder="e.g. Paris, Bordeaux, Lyon..."
											value={city}
											onChange={(e) => setCity(e.target.value)}
											className="h-9 text-xs"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-postal" className="text-xs font-semibold">
											Postal / Zip Code
										</Label>
										<Input
											id="prop-postal"
											placeholder="e.g. 75005"
											value={postalCode}
											onChange={(e) => setPostalCode(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-state" className="text-xs font-semibold">
											State / Region / Province
										</Label>
										<Input
											id="prop-state"
											placeholder="e.g. Île-de-France, Nouvelle-Aquitaine..."
											value={stateProvince}
											onChange={(e) => setStateProvince(e.target.value)}
											className="h-9 text-xs"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-country" className="text-xs font-semibold">
											Country
										</Label>
										<Input
											id="prop-country"
											placeholder="e.g. France"
											value={country}
											onChange={(e) => setCountry(e.target.value)}
											className="h-9 text-xs"
										/>
									</div>

									{/* Ownership & Debt Structure */}
									<div className="pt-2 border-t border-border/40 sm:col-span-2">
										<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-2">
											Détention & Financement
										</span>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-ownership-mode" className="text-xs font-semibold">
											Structure de détention
										</Label>
										<Select value={ownershipStructure} onValueChange={setOwnershipStructure}>
											<SelectTrigger id="prop-ownership-mode" className="h-9 text-xs">
												<SelectValue placeholder="Mode de détention" />
											</SelectTrigger>
											<SelectContent>
												{OWNERSHIP_STRUCTURES.map((st) => (
													<SelectItem key={st.value} value={st.value} className="text-xs">
														{st.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-ownership-pct" className="text-xs font-semibold">
											Quote-part de détention (%)
										</Label>
										<Input
											id="prop-ownership-pct"
											type="number"
											step="any"
											placeholder="100"
											value={ownershipPercentage}
											onChange={(e) => setOwnershipPercentage(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5 sm:col-span-2">
										<Label htmlFor="prop-linked-loan" className="text-xs font-semibold flex items-center justify-between">
											<span>Crédit immobilier adossé</span>
											<span className="text-micro font-normal text-muted-foreground">Source: module Loans</span>
										</Label>
										<Select value={linkedLoanId} onValueChange={setLinkedLoanId}>
											<SelectTrigger id="prop-linked-loan" className="h-9 text-xs">
												<SelectValue placeholder="Sélectionner un crédit" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none" className="text-xs font-medium text-muted-foreground">
													Aucun crédit adossé
												</SelectItem>
												{availableLoans.map((l) => (
													<SelectItem key={l.id} value={l.id} className="text-xs">
														{l.name} {l.lender ? `(${l.lender})` : ""} — {formatCurrency(l.remainingBalance ?? l.loanAmount ?? 0)} restant {l.monthlyPayment ? `(${formatCurrency(l.monthlyPayment)}/m)` : ""}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* Quick Financial Values for immediate submission */}
									<div className="pt-2 border-t border-border/40 sm:col-span-2">
										<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground block mb-2">
											Valorisation Initiale (Saisie Rapide)
										</span>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-quick-purchase" className="text-xs font-semibold">
											Prix d'acquisition net
										</Label>
										<Input
											id="prop-quick-purchase"
											type="number"
											step="any"
											placeholder="e.g. 450000"
											value={purchasePrice}
											onChange={(e) => setPurchasePrice(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-quick-val" className="text-xs font-semibold">
											Valorisation actuelle
										</Label>
										<Input
											id="prop-quick-val"
											type="number"
											step="any"
											placeholder="e.g. 495000"
											value={currentValuation}
											onChange={(e) => setCurrentValuation(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>
								</div>
							</div>
						)}

						{/* ============================================================== */}
						{/* TAB 2: FINANCIALS & ACQUISITION COSTS                           */}
						{/* ============================================================== */}
						{activeTab === "financials" && (
							<div className="space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
									<div className="space-y-1.5">
										<Label htmlFor="prop-purchase" className="text-xs font-semibold">
											Net Purchase Price <span className="text-destructive">*</span>
										</Label>
										<Input
											id="prop-purchase"
											type="number"
											step="any"
											placeholder="e.g. 450000"
											value={purchasePrice}
											onChange={(e) => setPurchasePrice(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-valuation" className="text-xs font-semibold">
											Current Valuation
										</Label>
										<Input
											id="prop-valuation"
											type="number"
											step="any"
											placeholder="e.g. 495000"
											value={currentValuation}
											onChange={(e) => {
												setCurrentValuation(e.target.value);
												if (valuationMode === "MANUAL") setManualValue(e.target.value);
											}}
											className="h-9 text-xs font-mono"
										/>
									</div>

									{/* Valuation Mode & Live Estimation Section */}
									<div className="pt-2 border-t border-border/40 sm:col-span-2 space-y-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5">
												<Sparkles className="h-4 w-4 text-primary" />
												<Label className="text-xs font-semibold">Mode d'estimation</Label>
											</div>
											<div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/40">
												<button
													type="button"
													onClick={() => setValuationMode("AUTO")}
													className={cn(
														"px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
														valuationMode === "AUTO"
															? "bg-card text-foreground shadow-sm"
															: "text-muted-foreground hover:text-foreground"
													)}
												>
													Auto (DVF+ / INSEE)
												</button>
												<button
													type="button"
													onClick={() => setValuationMode("MANUAL")}
													className={cn(
														"px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
														valuationMode === "MANUAL"
															? "bg-card text-foreground shadow-sm"
															: "text-muted-foreground hover:text-foreground"
													)}
												>
													Manuel
												</button>
											</div>
										</div>

										{valuationMode === "AUTO" ? (
											<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
												<div className="flex items-start justify-between">
													<div>
														<span className="text-micro font-bold uppercase tracking-wider text-muted-foreground">
															Estimation automatique (Temps Réel)
														</span>
														<div className="flex items-baseline gap-2 mt-0.5">
															<span className="text-2xl font-bold font-mono tracking-tight text-foreground">
																{liveEstimation?.estimatedValue
																	? formatCurrency(liveEstimation.estimatedValue)
																	: isEstimating
																	? "Calcul en cours..."
																	: numPurchase > 0
																	? formatCurrency(numPurchase)
																	: "En attente d'adresse..."}
															</span>
															{liveEstimation?.confidence && (
																<Badge
																	variant="outline"
																	className={cn(
																		"text-micro font-semibold uppercase",
																		liveEstimation.confidence === "HIGH" &&
																			"bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
																		liveEstimation.confidence === "MEDIUM" &&
																			"bg-sky-500/10 text-sky-600 border-sky-500/30",
																		liveEstimation.confidence === "LOW" &&
																			"bg-amber-500/10 text-amber-600 border-amber-500/30",
																		liveEstimation.confidence === "UNAVAILABLE" &&
																			"bg-muted text-muted-foreground"
																	)}
																>
																	{liveEstimation.confidence === "HIGH" && "Confiance Haute"}
																	{liveEstimation.confidence === "MEDIUM" && "Confiance Moyenne"}
																	{liveEstimation.confidence === "LOW" && "Zone peu dense"}
																	{liveEstimation.confidence === "UNAVAILABLE" && "Non estimable"}
																</Badge>
															)}
														</div>
													</div>
													{liveEstimation?.method && (
														<Badge variant="secondary" className="text-micro">
															{liveEstimation.method === "DVF_COMPARABLES" && "DVF+ Notaires"}
															{liveEstimation.method === "INSEE_INDEX" && "Notaires-INSEE"}
															{liveEstimation.method === "ACQUISITION_COST" && "Coût d'achat"}
														</Badge>
													)}
												</div>

												{liveEstimation?.estimatedMin && liveEstimation?.estimatedMax && (
													<div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10 text-xs">
														<div>
															<span className="text-micro text-muted-foreground block">Fourchette basse / haute</span>
															<span className="font-mono font-medium">
																{formatCurrency(liveEstimation.estimatedMin)} – {formatCurrency(liveEstimation.estimatedMax)}
															</span>
														</div>
														<div>
															<span className="text-micro text-muted-foreground block">Prix au m² estimé</span>
															<span className="font-mono font-medium">
																{liveEstimation.estimatedPricePerM2
																	? `${Math.round(liveEstimation.estimatedPricePerM2)} €/m²`
																	: "–"}
																{liveEstimation.comparablesCount > 0 && (
																	<span className="text-micro text-muted-foreground ml-1">
																		({liveEstimation.comparablesCount} ventes)
																	</span>
																)}
															</span>
														</div>
													</div>
												)}

												{liveEstimation?.rentalMarket && (
													<div className="pt-2 border-t border-primary/10 flex items-center justify-between text-xs">
														<div className="flex items-center gap-1.5 text-muted-foreground">
															<Home className="h-3.5 w-3.5 text-primary" />
															<span>Carte des loyers (ANIL 2025) :</span>
														</div>
														<div className="flex items-center gap-3 font-mono font-medium">
															{liveEstimation.rentalMarket.estimatedMonthlyRent && (
																<span>~{Math.round(liveEstimation.rentalMarket.estimatedMonthlyRent)} €/mois</span>
															)}
															{liveEstimation.rentalMarket.estimatedGrossYield && (
																<span className="text-emerald-600 dark:text-emerald-400">
																	Rendement: {liveEstimation.rentalMarket.estimatedGrossYield.toFixed(2)} %
																</span>
															)}
														</div>
													</div>
												)}
											</div>
										) : null}
									</div>

									<div className="space-y-1.5 sm:col-span-2">
										<Label className="text-xs font-semibold">Acquisition Date</Label>
										<DatePicker
											date={purchaseDate}
											onChange={setPurchaseDate}
											placeholder="Select purchase date"
											className="w-full h-9 text-xs"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-agency" className="text-xs font-semibold">
											Agency Fees (Frais d'agence)
										</Label>
										<Input
											id="prop-agency"
											type="number"
											step="any"
											placeholder="e.g. 18000"
											value={agencyFees}
											onChange={(e) => setAgencyFees(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-notary" className="text-xs font-semibold">
											Notary Fees (Frais de notaire)
										</Label>
										<Input
											id="prop-notary"
											type="number"
											step="any"
											placeholder="e.g. 32000"
											value={notaryFees}
											onChange={(e) => setNotaryFees(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-reno" className="text-xs font-semibold">
											Renovation Work (Travaux)
										</Label>
										<Input
											id="prop-reno"
											type="number"
											step="any"
											placeholder="e.g. 45000"
											value={renovationFees}
											onChange={(e) => setRenovationFees(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-furnishing" className="text-xs font-semibold">
											Furnishing & Equipment (Mobilier)
										</Label>
										<Input
											id="prop-furnishing"
											type="number"
											step="any"
											placeholder="e.g. 15000"
											value={furnishingCosts}
											onChange={(e) => setFurnishingCosts(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>
								</div>

								{/* Live Financial Telemetry Card */}
								<div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 grid grid-cols-2 gap-3 text-xs">
									<div>
										<span className="text-micro uppercase font-bold text-muted-foreground block">
											All-in Acquisition Cost
										</span>
										<span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
											{allInCost > 0 ? formatCurrency(allInCost) : "—"}
										</span>
										<span className="text-micro text-muted-foreground">
											Purchase + Agency + Notary + Works
										</span>
									</div>
									<div className="text-right">
										<span className="text-micro uppercase font-bold text-muted-foreground block">
											Unrealized Net P&L
										</span>
										<span
											className={cn(
												"text-sm font-bold font-mono mt-0.5 block",
												livePnl >= 0 ? "text-emerald-500" : "text-rose-500",
											)}
										>
											{livePnl >= 0 ? "+" : ""}
											{formatCurrency(livePnl)}{" "}
											<span className="text-micro font-normal">
												({livePnlPercent >= 0 ? "+" : ""}
												{livePnlPercent.toFixed(1)}%)
											</span>
										</span>
										<span className="text-micro text-muted-foreground">
											Current value vs All-in basis
										</span>
									</div>
								</div>
							</div>
						)}

						{/* ============================================================== */}
						{/* TAB 3: SPECIFICATIONS & LAYOUT                                 */}
						{/* ============================================================== */}
						{activeTab === "specifications" && (
							<div className="space-y-4">
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
									<div className="space-y-1.5">
										<Label htmlFor="prop-surface" className="text-xs font-semibold">
											Living Area (m²)
										</Label>
										<Input
											id="prop-surface"
											type="number"
											step="any"
											placeholder="e.g. 95"
											value={surface}
											onChange={(e) => setSurface(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-land" className="text-xs font-semibold">
											Land Area (m²)
										</Label>
										<Input
											id="prop-land"
											type="number"
											step="any"
											placeholder="e.g. 450"
											value={landSurface}
											onChange={(e) => setLandSurface(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-year" className="text-xs font-semibold">
											Year Built
										</Label>
										<Input
											id="prop-year"
											type="number"
											placeholder="e.g. 1998, 2022..."
											value={yearBuilt}
											onChange={(e) => setYearBuilt(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-floor" className="text-xs font-semibold">
											Floor
										</Label>
										<Input
											id="prop-floor"
											type="number"
											placeholder="e.g. 3"
											value={floor}
											onChange={(e) => setFloor(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-totalfloors" className="text-xs font-semibold">
											Total Building Floors
										</Label>
										<Input
											id="prop-totalfloors"
											type="number"
											placeholder="e.g. 6"
											value={totalFloors}
											onChange={(e) => setTotalFloors(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-rooms" className="text-xs font-semibold">
											Total Rooms (Pièces)
										</Label>
										<Input
											id="prop-rooms"
											type="number"
											placeholder="e.g. 4"
											value={rooms}
											onChange={(e) => setRooms(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-bedrooms" className="text-xs font-semibold">
											Bedrooms
										</Label>
										<Input
											id="prop-bedrooms"
											type="number"
											placeholder="e.g. 2"
											value={bedrooms}
											onChange={(e) => setBedrooms(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-bathrooms" className="text-xs font-semibold">
											Bathrooms
										</Label>
										<Input
											id="prop-bathrooms"
											type="number"
											step="0.5"
											placeholder="e.g. 1.5"
											value={bathrooms}
											onChange={(e) => setBathrooms(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-garages" className="text-xs font-semibold">
											Closed Garages
										</Label>
										<Input
											id="prop-garages"
											type="number"
											placeholder="e.g. 1"
											value={garages}
											onChange={(e) => setGarages(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-parkings" className="text-xs font-semibold">
											Parking Spaces
										</Label>
										<Input
											id="prop-parkings"
											type="number"
											placeholder="e.g. 1"
											value={parkingSpaces}
											onChange={(e) => setParkingSpaces(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5 col-span-2">
										<Label className="text-xs font-semibold">Energy Label (DPE)</Label>
										<div className="flex items-center gap-1.5 pt-1">
											{ENERGY_LABELS.map((label) => (
												<button
													key={label}
													type="button"
													onClick={() => setEnergyLabel(energyLabel === label ? "" : label)}
													className={cn(
														"flex-1 h-8 rounded text-xs font-bold transition-all border",
														energyLabel === label
															? "bg-foreground text-background border-foreground shadow-xs scale-105"
															: "bg-muted/40 hover:bg-muted text-muted-foreground border-border/50",
													)}
												>
													{label}
												</button>
											))}
										</div>
									</div>
								</div>

								{/* Live Price/m² telemetry */}
								{livePricePerM2 !== null && (
									<div className="p-3 rounded-lg border border-border/50 bg-muted/20 flex items-center justify-between text-xs">
										<span className="text-muted-foreground">Computed valuation rate:</span>
										<span className="font-mono font-bold text-foreground">
											{formatCurrency(livePricePerM2)} / m²
										</span>
									</div>
								)}
							</div>
						)}

						{/* ============================================================== */}
						{/* TAB 4: AMENITIES & QUALITY                                     */}
						{/* ============================================================== */}
						{activeTab === "amenities" && (
							<div className="space-y-4">
								<div>
									<Label className="text-xs font-semibold block mb-2">
										Property Equipment & Amenities
									</Label>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
										{[
											{ id: "garden", label: "Garden", val: hasGarden, set: setHasGarden },
											{ id: "balcony", label: "Balcony / Terrace", val: hasBalcony, set: setHasBalcony },
											{ id: "lift", label: "Elevator / Lift", val: hasLift, set: setHasLift },
											{ id: "pool", label: "Swimming Pool", val: hasPool, set: setHasPool },
											{ id: "sauna", label: "Sauna / Spa", val: hasSauna, set: setHasSauna },
											{ id: "furnished", label: "Furnished", val: isFurnished, set: setIsFurnished },
											{ id: "newconst", label: "New Construction (VEFA)", val: isNewConstruction, set: setIsNewConstruction },
										].map((item) => (
											<label
												key={item.id}
												className={cn(
													"flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors",
													item.val
														? "bg-primary/10 border-primary/40 text-foreground font-semibold"
														: "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40",
												)}
											>
												<Checkbox
													checked={item.val}
													onCheckedChange={(checked) => item.set(!!checked)}
												/>
												<span>{item.label}</span>
											</label>
										))}
									</div>
								</div>

								<div className="pt-2 border-t border-border/40">
									<Label className="text-xs font-semibold block mb-2.5">
										Construction Condition & Finishes
									</Label>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
										<div className="space-y-1.5">
											<Label htmlFor="prop-cond" className="text-micro uppercase font-bold text-muted-foreground">
												Overall Condition
											</Label>
											<Select value={condition} onValueChange={setCondition}>
												<SelectTrigger id="prop-cond" className="h-9 text-xs">
													<SelectValue placeholder="Select condition" />
												</SelectTrigger>
												<SelectContent>
													{CONDITION_OPTIONS.map((c) => (
														<SelectItem key={c.value} value={c.value} className="text-xs">
															{c.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor="prop-qual" className="text-micro uppercase font-bold text-muted-foreground">
												General Finish Quality
											</Label>
											<Select value={generalQuality} onValueChange={setGeneralQuality}>
												<SelectTrigger id="prop-qual" className="h-9 text-xs">
													<SelectValue placeholder="Select quality level" />
												</SelectTrigger>
												<SelectContent>
													{QUALITY_OPTIONS.map((q) => (
														<SelectItem key={q.value} value={q.value} className="text-xs">
															{q.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor="prop-kitchen-qual" className="text-micro uppercase font-bold text-muted-foreground">
												Kitchen Quality
											</Label>
											<Select value={kitchenQuality} onValueChange={setKitchenQuality}>
												<SelectTrigger id="prop-kitchen-qual" className="h-9 text-xs">
													<SelectValue placeholder="Standard, Custom, Luxury..." />
												</SelectTrigger>
												<SelectContent>
													{QUALITY_OPTIONS.map((q) => (
														<SelectItem key={q.value} value={q.value} className="text-xs">
															{q.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor="prop-bath-qual" className="text-micro uppercase font-bold text-muted-foreground">
												Bathroom Quality
											</Label>
											<Select value={bathroomQuality} onValueChange={setBathroomQuality}>
												<SelectTrigger id="prop-bath-qual" className="h-9 text-xs">
													<SelectValue placeholder="Standard, Italian Shower, Luxury..." />
												</SelectTrigger>
												<SelectContent>
													{QUALITY_OPTIONS.map((q) => (
														<SelectItem key={q.value} value={q.value} className="text-xs">
															{q.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor="prop-floor-qual" className="text-micro uppercase font-bold text-muted-foreground">
												Flooring (Parquet, Tiles...)
											</Label>
											<Input
												id="prop-floor-qual"
												placeholder="e.g. Solid Oak Parquet, Marble..."
												value={flooringQuality}
												onChange={(e) => setFlooringQuality(e.target.value)}
												className="h-9 text-xs"
											/>
										</div>

										<div className="space-y-1.5">
											<Label htmlFor="prop-win-qual" className="text-micro uppercase font-bold text-muted-foreground">
												Windows & Insulation
											</Label>
											<Input
												id="prop-win-qual"
												placeholder="e.g. Double Glazing Aluminium, Argon..."
												value={windowsQuality}
												onChange={(e) => setWindowsQuality(e.target.value)}
												className="h-9 text-xs"
											/>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* ============================================================== */}
						{/* TAB 5: RENTAL STREAM & YIELD                                   */}
						{/* ============================================================== */}
						{activeTab === "rental" && (
							<div className="space-y-4">
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
									<div className="space-y-1.5">
										<Label htmlFor="prop-rental-type" className="text-xs font-semibold">
											Rental Exploitation Type
										</Label>
										<Select value={rentalType} onValueChange={setRentalType}>
											<SelectTrigger id="prop-rental-type" className="h-9 text-xs">
												<SelectValue placeholder="Select rental type" />
											</SelectTrigger>
											<SelectContent>
												{RENTAL_TYPES.map((rt) => (
													<SelectItem key={rt.value} value={rt.value} className="text-xs">
														{rt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-rental-period" className="text-xs font-semibold">
											Payment Frequency
										</Label>
										<Select value={rentalPeriod} onValueChange={setRentalPeriod}>
											<SelectTrigger id="prop-rental-period" className="h-9 text-xs">
												<SelectValue placeholder="Monthly, Yearly..." />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="Monthly" className="text-xs">Monthly</SelectItem>
												<SelectItem value="Quarterly" className="text-xs">Quarterly</SelectItem>
												<SelectItem value="Yearly" className="text-xs">Yearly</SelectItem>
												<SelectItem value="Seasonal" className="text-xs">Seasonal / Per Night</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-rent-val" className="text-xs font-semibold">
											Gross Monthly Rent
										</Label>
										<Input
											id="prop-rent-val"
											type="number"
											step="any"
											placeholder="e.g. 1450"
											value={monthlyRent}
											onChange={(e) => setMonthlyRent(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<Label htmlFor="prop-utility" className="text-xs font-semibold">
											Monthly Service Charges / Utilities
										</Label>
										<Input
											id="prop-utility"
											type="number"
											step="any"
											placeholder="e.g. 180"
											value={utilityCosts}
											onChange={(e) => setUtilityCosts(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>

									<div className="space-y-1.5 sm:col-span-2">
										<Label htmlFor="prop-yearly-misc" className="text-xs font-semibold">
											Yearly Property Taxes & Misc Expenses (Taxe Foncière, PNO...)
										</Label>
										<Input
											id="prop-yearly-misc"
											type="number"
											step="any"
											placeholder="e.g. 1200"
											value={yearlyMiscCosts}
											onChange={(e) => setYearlyMiscCosts(e.target.value)}
											className="h-9 text-xs font-mono"
										/>
									</div>
								</div>

								{/* Live Rental Yield Card */}
								<div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 grid grid-cols-2 gap-3 text-xs">
									<div>
										<span className="text-micro uppercase font-bold text-muted-foreground block">
											Gross Rental Yield
										</span>
										<span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
											{grossYield !== null ? `${grossYield.toFixed(2)}%` : "—"}
										</span>
										<span className="text-micro text-muted-foreground">
											Annualized rent / Property valuation
										</span>
									</div>

									<div className="text-right">
										<span className="text-micro uppercase font-bold text-muted-foreground block">
											Est. Net Monthly Cash Flow
										</span>
										<span
											className={cn(
												"text-sm font-bold font-mono mt-0.5 block",
												netMonthlyCashflow !== null && netMonthlyCashflow >= 0
													? "text-emerald-500"
													: "text-foreground",
											)}
										>
											{netMonthlyCashflow !== null ? formatCurrency(netMonthlyCashflow) : "—"}
										</span>
										<span className="text-micro text-muted-foreground">
											Rent minus charges & taxes
										</span>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Dialog Footer */}
					<DialogFooter className="px-6 py-3.5 border-t border-border/40 bg-muted/20 flex items-center justify-between sm:justify-between shrink-0">
						<div>
							{activeTab !== "identity" && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										const order: FormTab[] = [
											"identity",
											"financials",
											"specifications",
											"amenities",
											"rental",
										];
										const prevIdx = order.indexOf(activeTab) - 1;
										if (prevIdx >= 0) setActiveTab(order[prevIdx]);
									}}
									className="text-xs touch-target"
								>
									Previous
								</Button>
							)}
						</div>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={handleDialogClose}
								className="text-xs touch-target"
							>
								Cancel
							</Button>

							{activeTab === "identity" && (
								<Button
									type="submit"
									variant="secondary"
									size="sm"
									disabled={isSubmitting || !name.trim() || !city.trim()}
									className="text-xs touch-target border border-border/60 hover:bg-muted font-semibold"
									title="Enregistrer immédiatement sans parcourir les autres onglets"
								>
									<Zap className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" />
									Sauvegarder immédiatement
								</Button>
							)}

							{activeTab !== "rental" ? (
								<Button
									type="button"
									size="sm"
									onClick={() => {
										const order: FormTab[] = [
											"identity",
											"financials",
											"specifications",
											"amenities",
											"rental",
										];
										const nextIdx = order.indexOf(activeTab) + 1;
										if (nextIdx < order.length) setActiveTab(order[nextIdx]);
									}}
									className="text-xs touch-target bg-primary text-primary-foreground font-semibold"
								>
									Continue
								</Button>
							) : (
								<Button
									type="submit"
									size="sm"
									disabled={isSubmitting}
									className="text-xs touch-target bg-primary text-primary-foreground font-semibold"
								>
									{isSubmitting ? "Saving..." : "Save Property"}
								</Button>
							)}
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
