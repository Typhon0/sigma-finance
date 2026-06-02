import {
	Bath,
	Bed,
	Building2,
	Calendar as CalendarIcon,
	Car,
	ChevronLeft,
	ChevronRight,
	Construction,
	Droplets,
	FileText,
	Info,
	Layers,
	Leaf,
	Link,
	MapPin,
	Minus,
	Mountain,
	Plus,
	Sofa,
	Trash2,
	UserPlus,
	Users,
	Waves,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface AddRealEstateFormProps {
	open: boolean;
	onClose: () => void;
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onSubmit: (data: any) => void;
}

type FormStep =
	| "description"
	| "characteristics"
	| "rental"
	| "details"
	| "quality"
	| "attached-loan"
	| "ownership";

interface CoOwner {
	id: string;
	type: "registered" | "custom";
	userId?: string;
	name: string;
	percentage: string;
}

interface CompanyOwner {
	id: string;
	type: "existing" | "new";
	companyId?: string;
	name: string;
	registrationNumber: string;
	legalForm: string;
	percentage: string;
}

interface FormData {
	// Description
	name: string;
	description: string;

	// Location
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;

	// Characteristics
	type: string;
	category: string;
	purchasePrice: string;
	currentValuation: string;
	surface: string;
	landSurface: string;
	constructionPeriod: string;
	energyLabel: string;
	agencyFees: string;
	notaryFees: string;
	renovationFees: string;
	purchaseDate: Date | undefined;
	furnishingCosts: string;

	// Rental
	rentalType: string;
	rentalPeriod: string;
	monthlyRent: string;
	utilityCosts: string;
	yearlyMiscCosts: string;

	// Details
	floorOfApartment: string;
	floorsInBuilding: string;
	rooms: string;
	bathrooms: string;
	garages: string;
	parkingSpaces: string;
	garden: string;
	balcony: string;
	lift: boolean;
	newConstruction: boolean;
	pool: boolean;
	sauna: boolean;
	furnished: boolean;

	// Quality
	condition: string;
	kitchenQuality: string;
	kitchenCondition: string;
	bathroomQuality: string;
	bathroomCondition: string;
	flooringQuality: string;
	flooringCondition: string;
	windowsQuality: string;
	windowsCondition: string;
	generalQuality: string;
	generalCondition: string;

	// Attached loan
	linkedLoanId: string;

	// Ownership
	ownershipMode: "personal" | "company";
	ownershipPercentage: string;
	coOwners: CoOwner[];
	companyOwners: CompanyOwner[];
}

export function AddRealEstateForm({ open, onClose, onSubmit }: AddRealEstateFormProps) {
	const [currentStep, setCurrentStep] = useState<FormStep>("description");
	const [formData, setFormData] = useState<FormData>({
		name: "",
		description: "",
		address: "",
		city: "",
		state: "",
		postalCode: "",
		country: "",
		type: "",
		category: "",
		purchasePrice: "",
		currentValuation: "",
		surface: "",
		landSurface: "",
		constructionPeriod: "",
		energyLabel: "",
		agencyFees: "",
		notaryFees: "",
		renovationFees: "",
		purchaseDate: undefined,
		furnishingCosts: "",
		rentalType: "",
		rentalPeriod: "",
		monthlyRent: "",
		utilityCosts: "",
		yearlyMiscCosts: "",
		floorOfApartment: "0",
		floorsInBuilding: "0",
		rooms: "0",
		bathrooms: "0",
		garages: "0",
		parkingSpaces: "0",
		garden: "",
		balcony: "",
		lift: false,
		newConstruction: false,
		pool: false,
		sauna: false,
		furnished: false,
		condition: "",
		kitchenQuality: "",
		kitchenCondition: "",
		bathroomQuality: "",
		bathroomCondition: "",
		flooringQuality: "",
		flooringCondition: "",
		windowsQuality: "",
		windowsCondition: "",
		generalQuality: "",
		generalCondition: "",
		linkedLoanId: "",
		ownershipMode: "personal",
		ownershipPercentage: "100",
		coOwners: [],
		companyOwners: [],
	});

	// Generate steps dynamically based on type and category
	const getSteps = (): { id: FormStep; label: string }[] => {
		const baseSteps: { id: FormStep; label: string }[] = [
			{ id: "description", label: "Description" },
			{ id: "characteristics", label: "Characteristics" },
		];

		// Only show Rental step if category is "rental"
		const showRental = formData.category === "rental";
		if (showRental) {
			baseSteps.push({ id: "rental", label: "Rental" });
		}

		// Only show Details step if NOT parking
		const isParking = formData.type === "parking";
		if (!isParking) {
			baseSteps.push({ id: "details", label: "Details" });
		}

		// Only show Quality step if NOT parking
		if (!isParking) {
			baseSteps.push({ id: "quality", label: "Quality" });
		}

		baseSteps.push(
			{ id: "attached-loan", label: "Attached loan" },
			{ id: "ownership", label: "Ownership" },
		);

		return baseSteps;
	};

	const steps = getSteps();
	const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

	// Reset to description step if current step is no longer valid
	useEffect(() => {
		if (currentStepIndex === -1 && currentStep !== "description") {
			setCurrentStep("description");
		}
	}, [currentStepIndex, currentStep]);

	const handleInputChange = (
		field: keyof FormData,
		value: string | Date | undefined | boolean | CoOwner[] | CompanyOwner[],
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleNext = () => {
		if (currentStepIndex < steps.length - 1) {
			setCurrentStep(steps[currentStepIndex + 1].id);
		} else {
			// Final submit
			onSubmit(formData);
			onClose();
		}
	};

	const handleBack = () => {
		if (currentStepIndex > 0) {
			setCurrentStep(steps[currentStepIndex - 1].id);
		}
	};

	const renderStepContent = () => {
		switch (currentStep) {
			case "description":
				return (
					<div className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="name" className="text-sm">
								Name <span className="text-muted-foreground">Optional</span>
							</Label>
							<Input
								id="name"
								value={formData.name}
								onChange={(e) => handleInputChange("name", e.target.value)}
								placeholder="test"
								className="bg-background border-border"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description" className="text-sm">
								Description <span className="text-muted-foreground">Optional</span>
							</Label>
							<Textarea
								id="description"
								value={formData.description}
								onChange={(e) => handleInputChange("description", e.target.value)}
								placeholder="test"
								className="bg-background border-border min-h-[100px]"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="type" className="text-sm">
									Type
								</Label>
								<Select
									value={formData.type}
									onValueChange={(value) => handleInputChange("type", value)}
								>
									<SelectTrigger id="type" className="bg-background border-border">
										<SelectValue placeholder="Parking" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="apartment">Apartment</SelectItem>
										<SelectItem value="house">House</SelectItem>
										<SelectItem value="building">Building</SelectItem>
										<SelectItem value="parking">Parking</SelectItem>
										<SelectItem value="land">Land</SelectItem>
										<SelectItem value="commercial">Commercial</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="category" className="text-sm">
									Category
								</Label>
								<Select
									value={formData.category}
									onValueChange={(value) => handleInputChange("category", value)}
								>
									<SelectTrigger id="category" className="bg-background border-border">
										<SelectValue placeholder="Other" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="residence">Residence</SelectItem>
										<SelectItem value="vacation-home">Vacation home</SelectItem>
										<SelectItem value="rental">Rental</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Location */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center gap-2 mb-2">
								<MapPin className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Location</h4>
							</div>

							<div className="space-y-2">
								<Label htmlFor="address" className="text-sm">
									Street Address <span className="text-muted-foreground text-xs">Optional</span>
								</Label>
								<Input
									id="address"
									value={formData.address}
									onChange={(e) => handleInputChange("address", e.target.value)}
									placeholder="123 Main St"
									className="bg-background border-border"
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="city" className="text-sm">
										City
									</Label>
									<Input
										id="city"
										value={formData.city}
										onChange={(e) => handleInputChange("city", e.target.value)}
										placeholder="Paris"
										className="bg-background border-border"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="state" className="text-sm">
										State / Region <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<Input
										id="state"
										value={formData.state}
										onChange={(e) => handleInputChange("state", e.target.value)}
										placeholder="Île-de-France"
										className="bg-background border-border"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="postalCode" className="text-sm">
										Postal Code <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<Input
										id="postalCode"
										value={formData.postalCode}
										onChange={(e) => handleInputChange("postalCode", e.target.value)}
										placeholder="75001"
										className="bg-background border-border"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="country" className="text-sm">
										Country
									</Label>
									<Select
										value={formData.country}
										onValueChange={(value) => handleInputChange("country", value)}
									>
										<SelectTrigger id="country" className="bg-background border-border">
											<SelectValue placeholder="Select country" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="FR">France</SelectItem>
											<SelectItem value="US">United States</SelectItem>
											<SelectItem value="DE">Germany</SelectItem>
											<SelectItem value="GB">United Kingdom</SelectItem>
											<SelectItem value="ES">Spain</SelectItem>
											<SelectItem value="IT">Italy</SelectItem>
											<SelectItem value="NL">Netherlands</SelectItem>
											<SelectItem value="BE">Belgium</SelectItem>
											<SelectItem value="CH">Switzerland</SelectItem>
											<SelectItem value="PT">Portugal</SelectItem>
											<SelectItem value="LU">Luxembourg</SelectItem>
											<SelectItem value="other">Other</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</div>
					</div>
				);

			case "characteristics": {
				const isLand = formData.type === "land";
				const isParking = formData.type === "parking";
				const showCurrentValuation = !isLand;
				// Show land surface ONLY for houses (as per Finary screenshots)
				const showLandSurface = formData.type === "house";
				// Show PriceHubble box ONLY for apartment, house, building
				const showPriceHubble = ["apartment", "house", "building"].includes(formData.type);
				// Show furnishing costs for all EXCEPT parking
				const showFurnishingCosts = !isParking;

				return (
					<div className="space-y-6">
						{/* Property Value Section */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center gap-2 mb-2">
								<Building2 className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Property Value</h4>
							</div>

							<div className="space-y-2">
								<Label htmlFor="purchasePrice" className="text-sm flex items-center gap-2">
									<span>Purchase price (without fees)</span>
								</Label>
								<div className="relative">
									<Input
										id="purchasePrice"
										type="number"
										value={formData.purchasePrice}
										onChange={(e) => handleInputChange("purchasePrice", e.target.value)}
										className="bg-background border-border pr-12"
										placeholder="0"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
										EUR
									</span>
								</div>
							</div>

							{/* PriceHubble Info Box - Show ONLY for apartment, house, building */}
							{showPriceHubble && (
								<div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-2">
									<p className="text-xs text-muted-foreground">
										The current value of your real estate will be automatically calculated &
										updated.
									</p>
									<div className="flex items-center gap-2 text-xs">
										<svg
											className="h-3.5 w-3.5"
											viewBox="0 0 24 24"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
											role="img"
											aria-label="PriceHubble"
										>
											<title>PriceHubble</title>
											<path
												d="M12 2L2 7L12 12L22 7L12 2Z"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<path
												d="M2 17L12 22L22 17"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
											<path
												d="M2 12L12 17L22 12"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
										<span className="font-medium">PriceHubble</span>
										<Button
											variant="link"
											className="text-primary hover:underline flex items-center gap-1 h-auto p-0"
										>
											How does it work?
											<Info className="h-3 w-3" />
										</Button>
									</div>
								</div>
							)}

							{/* Current valuation - Show for all except land */}
							{showCurrentValuation && (
								<div className="space-y-2">
									<Label htmlFor="currentValuation" className="text-sm flex items-center gap-2">
										<span>
											Current valuation{" "}
											<span className="text-muted-foreground text-xs">Optional</span>
										</span>
									</Label>
									<div className="relative">
										<Input
											id="currentValuation"
											type="number"
											value={formData.currentValuation}
											onChange={(e) => handleInputChange("currentValuation", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											EUR
										</span>
									</div>
								</div>
							)}
						</div>

						{/* Property Details Section */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center gap-2 mb-2">
								<Layers className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Property Details</h4>
							</div>

							{showLandSurface ? (
								// For House: Surface | Land surface
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label htmlFor="surface" className="text-sm">
											Surface
										</Label>
										<div className="relative">
											<Input
												id="surface"
												type="number"
												value={formData.surface}
												onChange={(e) => handleInputChange("surface", e.target.value)}
												className="bg-background border-border pr-10"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												m²
											</span>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="landSurface" className="text-sm flex items-center gap-1">
											Land surface
											<Info className="h-3 w-3 text-muted-foreground" />
										</Label>
										<div className="relative">
											<Input
												id="landSurface"
												type="number"
												value={formData.landSurface}
												onChange={(e) => handleInputChange("landSurface", e.target.value)}
												className="bg-background border-border pr-10"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												m²
											</span>
										</div>
									</div>
								</div>
							) : (
								// For others: Surface | Construction period
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label htmlFor="surface" className="text-sm">
											Surface
										</Label>
										<div className="relative">
											<Input
												id="surface"
												type="number"
												value={formData.surface}
												onChange={(e) => handleInputChange("surface", e.target.value)}
												className="bg-background border-border pr-10"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												m²
											</span>
										</div>
									</div>

									{!isLand && (
										<div className="space-y-2">
											<Label htmlFor="constructionPeriod" className="text-sm">
												Construction period
											</Label>
											<Select
												value={formData.constructionPeriod}
												onValueChange={(value) => handleInputChange("constructionPeriod", value)}
											>
												<SelectTrigger
													id="constructionPeriod"
													className="bg-background border-border"
												>
													<SelectValue placeholder="Select period" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="before-1900">Before 1900</SelectItem>
													<SelectItem value="1900-1945">1900-1945</SelectItem>
													<SelectItem value="1946-1970">1946-1970</SelectItem>
													<SelectItem value="1971-1990">1971-1990</SelectItem>
													<SelectItem value="1991-2000">1991-2000</SelectItem>
													<SelectItem value="2001-2010">2001-2010</SelectItem>
													<SelectItem value="2011-2020">2011-2020</SelectItem>
													<SelectItem value="after-2020">After 2020</SelectItem>
												</SelectContent>
											</Select>
										</div>
									)}
								</div>
							)}

							{/* For House: Construction period | Energy label on separate row */}
							{showLandSurface && !isLand && (
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label htmlFor="constructionPeriod" className="text-sm">
											Construction period
										</Label>
										<Select
											value={formData.constructionPeriod}
											onValueChange={(value) => handleInputChange("constructionPeriod", value)}
										>
											<SelectTrigger
												id="constructionPeriod"
												className="bg-background border-border"
											>
												<SelectValue placeholder="Select period" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="before-1900">Before 1900</SelectItem>
												<SelectItem value="1900-1945">1900-1945</SelectItem>
												<SelectItem value="1946-1970">1946-1970</SelectItem>
												<SelectItem value="1971-1990">1971-1990</SelectItem>
												<SelectItem value="1991-2000">1991-2000</SelectItem>
												<SelectItem value="2001-2010">2001-2010</SelectItem>
												<SelectItem value="2011-2020">2011-2020</SelectItem>
												<SelectItem value="after-2020">After 2020</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor="energyLabel" className="text-sm">
											Energy label <span className="text-muted-foreground text-xs">Optional</span>
										</Label>
										<Select
											value={formData.energyLabel}
											onValueChange={(value) => handleInputChange("energyLabel", value)}
										>
											<SelectTrigger id="energyLabel" className="bg-background border-border">
												<SelectValue placeholder="Select label" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="A">A</SelectItem>
												<SelectItem value="B">B</SelectItem>
												<SelectItem value="C">C</SelectItem>
												<SelectItem value="D">D</SelectItem>
												<SelectItem value="E">E</SelectItem>
												<SelectItem value="F">F</SelectItem>
												<SelectItem value="G">G</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							)}

							{/* For non-House types: Energy label on same row */}
							{!showLandSurface && (
								<div className="space-y-2">
									<Label htmlFor="energyLabel" className="text-sm">
										Energy label <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<Select
										value={formData.energyLabel}
										onValueChange={(value) => handleInputChange("energyLabel", value)}
									>
										<SelectTrigger id="energyLabel" className="bg-background border-border">
											<SelectValue placeholder="Select label" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="A">A</SelectItem>
											<SelectItem value="B">B</SelectItem>
											<SelectItem value="C">C</SelectItem>
											<SelectItem value="D">D</SelectItem>
											<SelectItem value="E">E</SelectItem>
											<SelectItem value="F">F</SelectItem>
											<SelectItem value="G">G</SelectItem>
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						{/* Fees & Costs Section */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center gap-2 mb-2">
								<Construction className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Fees & Costs</h4>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="agencyFees" className="text-sm">
										Agency fees <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<div className="relative">
										<Input
											id="agencyFees"
											type="number"
											value={formData.agencyFees}
											onChange={(e) => handleInputChange("agencyFees", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											EUR
										</span>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="notaryFees" className="text-sm">
										Notary fees <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<div className="relative">
										<Input
											id="notaryFees"
											type="number"
											value={formData.notaryFees}
											onChange={(e) => handleInputChange("notaryFees", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											EUR
										</span>
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="renovationFees" className="text-sm">
										Renovation fees <span className="text-muted-foreground text-xs">Optional</span>
									</Label>
									<div className="relative">
										<Input
											id="renovationFees"
											type="number"
											value={formData.renovationFees}
											onChange={(e) => handleInputChange("renovationFees", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											EUR
										</span>
									</div>
								</div>

								{showFurnishingCosts && (
									<div className="space-y-2">
										<Label htmlFor="furnishingCosts" className="text-sm">
											Furnishing costs{" "}
											<span className="text-muted-foreground text-xs">Optional</span>
										</Label>
										<div className="relative">
											<Input
												id="furnishingCosts"
												type="number"
												value={formData.furnishingCosts}
												onChange={(e) => handleInputChange("furnishingCosts", e.target.value)}
												className="bg-background border-border pr-12"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
												EUR
											</span>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Purchase Information Section */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<div className="flex items-center gap-2 mb-2">
								<CalendarIcon className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Purchase Information</h4>
							</div>

							<div className="space-y-2">
								<Label htmlFor="purchaseDate" className="text-sm">
									Purchase date <span className="text-muted-foreground text-xs">Optional</span>
								</Label>
								<DatePicker
									date={formData.purchaseDate}
									onChange={(date) => handleInputChange("purchaseDate", date)}
									disabledDates={(date) => date > new Date() || date < new Date("1900-01-01")}
								/>
							</div>
						</div>
					</div>
				);
			}

			case "rental":
				return (
					<div className="space-y-6">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="rentalType" className="text-sm">
									Rental type
								</Label>
								<Select
									value={formData.rentalType}
									onValueChange={(value) => handleInputChange("rentalType", value)}
								>
									<SelectTrigger id="rentalType" className="bg-background border-border">
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="furnished-rental">Furnished rental</SelectItem>
										<SelectItem value="sci">SCI</SelectItem>
										<SelectItem value="unfurnished">Unfurnished</SelectItem>
										<SelectItem value="pinel">Pinel</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="rentalPeriod" className="text-sm">
									Rental period
								</Label>
								<Select
									value={formData.rentalPeriod}
									onValueChange={(value) => handleInputChange("rentalPeriod", value)}
								>
									<SelectTrigger id="rentalPeriod" className="bg-background border-border">
										<SelectValue placeholder="Select period" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="seasonal">Seasonal</SelectItem>
										<SelectItem value="annual">Annual</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label
									htmlFor="monthlyRent"
									className="text-sm flex items-center gap-1 justify-between"
								>
									<span className="flex items-center gap-1">
										Rent
										<Info className="h-3 w-3 text-muted-foreground" />
									</span>
									<span className="text-xs text-muted-foreground">EUR</span>
								</Label>
								<Input
									id="monthlyRent"
									type="number"
									value={formData.monthlyRent}
									onChange={(e) => handleInputChange("monthlyRent", e.target.value)}
									className="bg-background border-border"
								/>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="utilityCosts"
									className="text-sm flex items-center gap-1 justify-between"
								>
									<span className="flex items-center gap-1">
										Utility costs
										<Info className="h-3 w-3 text-muted-foreground" />
									</span>
									<span className="text-xs text-muted-foreground">EUR</span>
								</Label>
								<Input
									id="utilityCosts"
									type="number"
									value={formData.utilityCosts}
									onChange={(e) => handleInputChange("utilityCosts", e.target.value)}
									className="bg-background border-border"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label
								htmlFor="yearlyMiscCosts"
								className="text-sm flex items-center gap-1 justify-between"
							>
								<span className="flex items-center gap-1">
									Yearly misc. costs
									<Info className="h-3 w-3 text-muted-foreground" />
								</span>
								<span className="text-xs text-muted-foreground">EUR</span>
							</Label>
							<Input
								id="yearlyMiscCosts"
								type="number"
								value={formData.yearlyMiscCosts}
								onChange={(e) => handleInputChange("yearlyMiscCosts", e.target.value)}
								className="bg-background border-border"
							/>
						</div>
					</div>
				);

			case "details": {
				const detailsIsApartment = formData.type === "apartment";
				const detailsIsHouse = formData.type === "house";
				const detailsIsBuilding = formData.type === "building";
				const detailsIsLand = formData.type === "land";
				const detailsIsCommercial = formData.type === "commercial";
				const detailsIsOther = formData.type === "other";

				// Building, Land, Commercial, Other have same layout as Building
				const isBuildingLike =
					detailsIsBuilding || detailsIsLand || detailsIsCommercial || detailsIsOther;

				const incrementValue = (field: keyof FormData) => {
					const currentValue = parseInt(formData[field] as string, 10) || 0;
					handleInputChange(field, (currentValue + 1).toString());
				};

				const decrementValue = (field: keyof FormData) => {
					const currentValue = parseInt(formData[field] as string, 10) || 0;
					if (currentValue > 0) {
						handleInputChange(field, (currentValue - 1).toString());
					}
				};

				// Modern number control component
				const NumberControl = ({
					field,
					label,
					icon: Icon,
					tooltip,
				}: {
					field: keyof FormData;
					label: string;
					// biome-ignore lint/suspicious/noExplicitAny: unavoidable
					icon?: any;
					tooltip?: boolean;
				}) => (
					<div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
						<div className="flex items-center gap-3">
							{Icon && (
								<Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
							)}
							<Label htmlFor={field} className="text-sm cursor-pointer flex items-center gap-2">
								{label}
								{tooltip && <Info className="h-3.5 w-3.5 text-muted-foreground" />}
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="h-9 w-9 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
								onClick={() => decrementValue(field)}
							>
								<Minus className="h-4 w-4" />
							</Button>
							<div className="w-12 text-center font-medium tabular-nums">
								{String(formData[field] ?? "")}
							</div>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="h-9 w-9 rounded-lg hover:bg-primary hover:text-primary-foreground transition-all"
								onClick={() => incrementValue(field)}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</div>
					</div>
				);

				// Modern switch control component
				const SwitchControl = ({
					field,
					label,
					icon: Icon,
					tooltip,
				}: {
					field: keyof FormData;
					label: string;
					// biome-ignore lint/suspicious/noExplicitAny: unavoidable
					icon?: any;
					tooltip?: boolean;
				}) => (
					<div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
						<div className="flex items-center gap-3">
							{Icon && (
								<Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
							)}
							<Label htmlFor={field} className="text-sm cursor-pointer flex items-center gap-2">
								{label}
								{tooltip && <Info className="h-3.5 w-3.5 text-muted-foreground" />}
							</Label>
						</div>
						<Switch
							id={field}
							checked={formData[field] as boolean}
							onCheckedChange={(checked) => handleInputChange(field, checked)}
						/>
					</div>
				);

				return (
					<div className="space-y-6">
						{/* Building Information */}
						<div className="space-y-3">
							<div className="flex items-center gap-2 mb-4">
								<Building2 className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Building Information</h4>
							</div>

							{/* Floor of the apartment - ONLY for apartments */}
							{detailsIsApartment && (
								<NumberControl
									field="floorOfApartment"
									label="Floor of the apartment"
									icon={Layers}
								/>
							)}

							<NumberControl
								field="floorsInBuilding"
								label="No. floors in the building"
								icon={Building2}
							/>
						</div>

						{/* Rooms & Spaces */}
						<div className="space-y-3">
							<div className="flex items-center gap-2 mb-4">
								<Bed className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Rooms & Spaces</h4>
							</div>

							<NumberControl field="rooms" label="No. rooms" icon={Bed} tooltip />
							<NumberControl field="bathrooms" label="No. bathrooms" icon={Bath} />
							<NumberControl field="garages" label="No. garages" icon={Car} />
							<NumberControl field="parkingSpaces" label="No. parking spaces" icon={Car} />
						</div>

						{/* Outdoor Spaces */}
						<div className="space-y-3">
							<div className="flex items-center gap-2 mb-4">
								<Leaf className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Outdoor Spaces</h4>
							</div>

							{detailsIsApartment ? (
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label htmlFor="garden" className="text-sm flex items-center gap-2">
											<Leaf className="h-4 w-4 text-muted-foreground" />
											<span>
												Garden <span className="text-muted-foreground text-xs">Optional</span>
											</span>
										</Label>
										<div className="relative">
											<Input
												id="garden"
												type="number"
												value={formData.garden}
												onChange={(e) => handleInputChange("garden", e.target.value)}
												className="bg-background border-border pr-10"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												m²
											</span>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="balcony" className="text-sm flex items-center gap-2">
											<Mountain className="h-4 w-4 text-muted-foreground" />
											<span>
												Balcony <span className="text-muted-foreground text-xs">Optional</span>
											</span>
										</Label>
										<div className="relative">
											<Input
												id="balcony"
												type="number"
												value={formData.balcony}
												onChange={(e) => handleInputChange("balcony", e.target.value)}
												className="bg-background border-border pr-10"
												placeholder="0"
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
												m²
											</span>
										</div>
									</div>
								</div>
							) : (
								<div className="space-y-2">
									<Label htmlFor="balcony" className="text-sm flex items-center gap-2">
										<Mountain className="h-4 w-4 text-muted-foreground" />
										<span>
											Balcony <span className="text-muted-foreground text-xs">Optional</span>
										</span>
									</Label>
									<div className="relative">
										<Input
											id="balcony"
											type="number"
											value={formData.balcony}
											onChange={(e) => handleInputChange("balcony", e.target.value)}
											className="bg-background border-border pr-10"
											placeholder="0"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
											m²
										</span>
									</div>
								</div>
							)}
						</div>

						{/* Features & Amenities */}
						<div className="space-y-3">
							<div className="flex items-center gap-2 mb-4">
								<Sofa className="h-4 w-4 text-primary" />
								<h4 className="text-sm text-muted-foreground">Features & Amenities</h4>
							</div>

							{(detailsIsApartment || isBuildingLike) && (
								<SwitchControl field="lift" label="Elevator / Lift" icon={Layers} />
							)}

							<SwitchControl
								field="newConstruction"
								label="New construction"
								icon={Construction}
								tooltip
							/>

							{detailsIsHouse && (
								<>
									<SwitchControl field="pool" label="Swimming pool" icon={Waves} />
									<SwitchControl field="sauna" label="Sauna" icon={Droplets} />
								</>
							)}

							<SwitchControl field="furnished" label="Furnished" icon={Sofa} />
						</div>
					</div>
				);
			}

			case "quality": {
				const qualityOptions = [
					{ value: "luxury", label: "Luxury" },
					{ value: "high-end", label: "High-end" },
					{ value: "standard", label: "Standard" },
					{ value: "basic", label: "Basic" },
				];

				const conditionOptions = [
					{ value: "new", label: "New" },
					{ value: "excellent", label: "Excellent" },
					{ value: "good", label: "Good" },
					{ value: "average", label: "Average" },
					{ value: "poor", label: "Poor" },
				];

				const QualitySection = ({
					title,
					qualityField,
					conditionField,
				}: {
					title: string;
					qualityField: keyof FormData;
					conditionField: keyof FormData;
				}) => (
					<div className="space-y-3">
						<h4 className="text-sm">{title}</h4>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor={qualityField} className="text-sm text-muted-foreground">
									Quality <span className="text-xs">Optional</span>
								</Label>
								<Select
									value={formData[qualityField] as string}
									onValueChange={(value) => handleInputChange(qualityField, value)}
								>
									<SelectTrigger
										id={qualityField}
										className="bg-background border-border text-muted-foreground"
									>
										<SelectValue placeholder="Quality Optional" />
									</SelectTrigger>
									<SelectContent>
										{qualityOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor={conditionField} className="text-sm text-muted-foreground">
									Condition <span className="text-xs">Optional</span>
								</Label>
								<Select
									value={formData[conditionField] as string}
									onValueChange={(value) => handleInputChange(conditionField, value)}
								>
									<SelectTrigger
										id={conditionField}
										className="bg-background border-border text-muted-foreground"
									>
										<SelectValue placeholder="Condition Optional" />
									</SelectTrigger>
									<SelectContent>
										{conditionOptions.map((opt) => (
											<SelectItem key={opt.value} value={opt.value}>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>
				);

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3>Quality</h3>
							<p className="text-sm text-muted-foreground">
								Indicating the quality and condition of the facilities helps refine the estimate
								even further
							</p>
						</div>

						{/* Quality Sections */}
						<div className="space-y-6">
							<QualitySection
								title="Kitchen"
								qualityField="kitchenQuality"
								conditionField="kitchenCondition"
							/>
							<QualitySection
								title="Bathroom(s)"
								qualityField="bathroomQuality"
								conditionField="bathroomCondition"
							/>
							<QualitySection
								title="Flooring"
								qualityField="flooringQuality"
								conditionField="flooringCondition"
							/>
							<QualitySection
								title="Windows"
								qualityField="windowsQuality"
								conditionField="windowsCondition"
							/>
							<QualitySection
								title="General"
								qualityField="generalQuality"
								conditionField="generalCondition"
							/>
						</div>
					</div>
				);
			}

			case "attached-loan": {
				// Mock existing loans for demo
				const existingLoans = [
					{
						id: "loan-1",
						name: "Mortgage ABC Bank - €250,000",
						amount: 250000,
						type: "Mortgage",
						bank: "ABC Bank",
					},
					{
						id: "loan-2",
						name: "Personal Loan XYZ - €50,000",
						amount: 50000,
						type: "Personal Loan",
						bank: "XYZ Bank",
					},
					{
						id: "loan-3",
						name: "Investment Property Loan - €180,000",
						amount: 180000,
						type: "Investment Loan",
						bank: "Capital Bank",
					},
				];

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<Link className="h-5 w-5" />
								Attached Loan
							</h3>
							<p className="text-sm text-muted-foreground">
								Link this property to an existing loan in your portfolio
							</p>
						</div>

						{/* Loan Selection */}
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="linkedLoanId" className="text-sm">
									Select Loan <span className="text-muted-foreground">Optional</span>
								</Label>
								<Select
									value={formData.linkedLoanId}
									onValueChange={(value) => handleInputChange("linkedLoanId", value)}
								>
									<SelectTrigger id="linkedLoanId" className="bg-background border-border">
										<SelectValue placeholder="Select an existing loan..." />
									</SelectTrigger>
									<SelectContent>
										{existingLoans.map((loan) => (
											<SelectItem key={loan.id} value={loan.id}>
												<div className="flex flex-col">
													<span className="font-medium">{loan.name}</span>
													<span className="text-xs text-muted-foreground">
														{loan.type} • {loan.bank}
													</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{formData.linkedLoanId && (
									<div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
										<p className="text-xs text-muted-foreground">
											✓ This property will be linked to the selected loan in your portfolio
										</p>
									</div>
								)}
							</div>

							{/* Create New Loan CTA */}
							<div className="p-4 rounded-lg border border-dashed border-border bg-muted/30">
								<div className="flex items-start gap-3">
									<div className="p-2 rounded-lg bg-background border border-border">
										<Plus className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="flex-1 space-y-2">
										<div>
											<h4 className="text-sm font-medium">Don't have a loan yet?</h4>
											<p className="text-xs text-muted-foreground mt-1">
												Create a new loan in the Loans section first, then link it to this property
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="gap-2"
											onClick={() => {}}
										>
											<FileText className="h-3.5 w-3.5" />
											Create New Loan
										</Button>
									</div>
								</div>
							</div>

							{/* Info Box */}
							<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
								<div className="flex gap-2">
									<Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
									<p className="text-xs text-blue-900 dark:text-blue-100">
										Linking a loan helps you track total debt, monthly payments, and calculate your
										true property equity and net worth
									</p>
								</div>
							</div>
						</div>
					</div>
				);
			}

			case "ownership": {
				// Mock registered users for demo
				const registeredUsers = [
					{ id: "user-1", name: "Alice Johnson", email: "alice@example.com" },
					{ id: "user-2", name: "Bob Smith", email: "bob@example.com" },
					{ id: "user-3", name: "Carol Williams", email: "carol@example.com" },
				];

				// Mock existing companies for demo
				const existingCompanies = [
					{
						id: "comp-1",
						name: "Sigma Real Estate SCI",
						registrationNumber: "123456789",
						legalForm: "SCI",
					},
					{
						id: "comp-2",
						name: "Investment Holdings SARL",
						registrationNumber: "987654321",
						legalForm: "SARL",
					},
					{
						id: "comp-3",
						name: "Property Management SA",
						registrationNumber: "456789123",
						legalForm: "SA",
					},
				];

				const addCoOwner = () => {
					const newCoOwner: CoOwner = {
						id: `co-owner-${Date.now()}`,
						type: "registered",
						name: "",
						percentage: "0",
					};
					handleInputChange("coOwners", [...formData.coOwners, newCoOwner]);
				};

				const removeCoOwner = (id: string) => {
					handleInputChange(
						"coOwners",
						formData.coOwners.filter((co) => co.id !== id),
					);
				};

				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const updateCoOwner = (id: string, field: keyof CoOwner, value: any) => {
					handleInputChange(
						"coOwners",
						formData.coOwners.map((co) => (co.id === id ? { ...co, [field]: value } : co)),
					);
				};

				const addCompanyOwner = () => {
					const newCompanyOwner: CompanyOwner = {
						id: `company-owner-${Date.now()}`,
						type: "existing",
						name: "",
						registrationNumber: "",
						legalForm: "",
						percentage: "0",
					};
					handleInputChange("companyOwners", [...formData.companyOwners, newCompanyOwner]);
				};

				const removeCompanyOwner = (id: string) => {
					handleInputChange(
						"companyOwners",
						formData.companyOwners.filter((co) => co.id !== id),
					);
				};

				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				const updateCompanyOwner = (id: string, field: keyof CompanyOwner, value: any) => {
					handleInputChange(
						"companyOwners",
						formData.companyOwners.map((co) => (co.id === id ? { ...co, [field]: value } : co)),
					);
				};

				const totalOwnership =
					(formData.ownershipMode === "personal"
						? parseFloat(formData.ownershipPercentage || "0")
						: 0) +
					formData.coOwners.reduce((sum, co) => sum + parseFloat(co.percentage || "0"), 0) +
					formData.companyOwners.reduce((sum, co) => sum + parseFloat(co.percentage || "0"), 0);

				return (
					<div className="space-y-6">
						{/* Header */}
						<div className="space-y-2">
							<h3 className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Ownership
							</h3>
							<p className="text-sm text-muted-foreground">
								Define ownership distribution for this property
							</p>
						</div>

						{/* Ownership Mode Selection */}
						<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
							<h4 className="text-sm font-medium">Ownership Type</h4>
							<div className="flex gap-3">
								<Button
									variant="ghost"
									onClick={() => handleInputChange("ownershipMode", "personal")}
									className={`flex-1 p-4 rounded-lg border-2 transition-all h-auto ${
										formData.ownershipMode === "personal"
											? "border-primary bg-primary/5"
											: "border-border hover:border-border/80"
									}`}
								>
									<div className="flex flex-col items-center gap-2">
										<Users
											className={`h-5 w-5 ${formData.ownershipMode === "personal" ? "text-primary" : "text-muted-foreground"}`}
										/>
										<span className="text-sm font-medium">Personal</span>
										<span className="text-xs text-muted-foreground text-center">
											Owned by individuals
										</span>
									</div>
								</Button>
								<Button
									variant="ghost"
									onClick={() => handleInputChange("ownershipMode", "company")}
									className={`flex-1 p-4 rounded-lg border-2 transition-all h-auto ${
										formData.ownershipMode === "company"
											? "border-primary bg-primary/5"
											: "border-border hover:border-border/80"
									}`}
								>
									<div className="flex flex-col items-center gap-2">
										<Building2
											className={`h-5 w-5 ${formData.ownershipMode === "company" ? "text-primary" : "text-muted-foreground"}`}
										/>
										<span className="text-sm font-medium">Company</span>
										<span className="text-xs text-muted-foreground text-center">
											Owned by companies
										</span>
									</div>
								</Button>
							</div>
						</div>

						{/* Personal Ownership Mode */}
						{formData.ownershipMode === "personal" && (
							<div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-border/50">
								<div className="flex items-center gap-2 mb-2">
									<Users className="h-4 w-4 text-primary" />
									<h4 className="text-sm text-muted-foreground">Your Ownership</h4>
								</div>

								<div className="space-y-2">
									<Label htmlFor="ownershipPercentage" className="text-sm">
										Ownership percentage
									</Label>
									<div className="relative">
										<Input
											id="ownershipPercentage"
											type="number"
											min="0"
											max="100"
											step="0.01"
											value={formData.ownershipPercentage}
											onChange={(e) => handleInputChange("ownershipPercentage", e.target.value)}
											className="bg-background border-border pr-12"
											placeholder="100"
										/>
										<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
											%
										</span>
									</div>
								</div>
							</div>
						)}

						{/* Co-Owners */}
						{formData.coOwners.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<h4 className="text-sm text-muted-foreground">Co-Owners</h4>
								</div>

								{formData.coOwners.map((coOwner, index) => (
									<div
										key={coOwner.id}
										className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm">Co-Owner {index + 1}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeCoOwner(coOwner.id)}
												className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>

										{/* Owner Type Selection */}
										<div className="flex gap-2">
											<Button
												variant="ghost"
												onClick={() => updateCoOwner(coOwner.id, "type", "registered")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													coOwner.type === "registered"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Registered User
											</Button>
											<Button
												variant="ghost"
												onClick={() => updateCoOwner(coOwner.id, "type", "custom")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													coOwner.type === "custom"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Custom Owner
											</Button>
										</div>

										{/* Owner Selection/Input */}
										{coOwner.type === "registered" ? (
											<div className="space-y-2">
												<Label className="text-sm">Select User</Label>
												<Select
													value={coOwner.userId}
													onValueChange={(value) => {
														const user = registeredUsers.find((u) => u.id === value);
														updateCoOwner(coOwner.id, "userId", value);
														if (user) {
															updateCoOwner(coOwner.id, "name", user.name);
														}
													}}
												>
													<SelectTrigger className="bg-background border-border">
														<SelectValue placeholder="Select a user..." />
													</SelectTrigger>
													<SelectContent>
														{registeredUsers.map((user) => (
															<SelectItem key={user.id} value={user.id}>
																<div className="flex flex-col">
																	<span>{user.name}</span>
																	<span className="text-xs text-muted-foreground">
																		{user.email}
																	</span>
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										) : (
											<div className="space-y-2">
												<Label className="text-sm">Owner Name</Label>
												<Input
													type="text"
													value={coOwner.name}
													onChange={(e) => updateCoOwner(coOwner.id, "name", e.target.value)}
													className="bg-background border-border"
													placeholder="Enter owner name..."
												/>
											</div>
										)}

										{/* Ownership Percentage */}
										<div className="space-y-2">
											<Label className="text-sm">Ownership percentage</Label>
											<div className="relative">
												<Input
													type="number"
													min="0"
													max="100"
													step="0.01"
													value={coOwner.percentage}
													onChange={(e) => updateCoOwner(coOwner.id, "percentage", e.target.value)}
													className="bg-background border-border pr-12"
													placeholder="0"
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Company Owners Section */}
						{formData.companyOwners.length > 0 && (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-primary" />
									<h4 className="text-sm text-muted-foreground">Company Owners</h4>
								</div>

								{formData.companyOwners.map((company, index) => (
									<div
										key={company.id}
										className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-4"
									>
										<div className="flex items-center justify-between">
											<span className="text-sm">Company {index + 1}</span>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() => removeCompanyOwner(company.id)}
												className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>

										{/* Company Type Selection */}
										<div className="flex gap-2">
											<Button
												variant="ghost"
												onClick={() => updateCompanyOwner(company.id, "type", "existing")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													company.type === "existing"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												Existing Company
											</Button>
											<Button
												variant="ghost"
												onClick={() => updateCompanyOwner(company.id, "type", "new")}
												className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all h-auto ${
													company.type === "new"
														? "border-primary bg-primary/5 text-primary"
														: "border-border hover:border-border/80"
												}`}
											>
												New Company
											</Button>
										</div>

										{/* Company Selection/Input */}
										{company.type === "existing" ? (
											<div className="space-y-2">
												<Label className="text-sm">Select Company</Label>
												<Select
													value={company.companyId}
													onValueChange={(value) => {
														const comp = existingCompanies.find((c) => c.id === value);
														updateCompanyOwner(company.id, "companyId", value);
														if (comp) {
															updateCompanyOwner(company.id, "name", comp.name);
															updateCompanyOwner(
																company.id,
																"registrationNumber",
																comp.registrationNumber,
															);
															updateCompanyOwner(company.id, "legalForm", comp.legalForm);
														}
													}}
												>
													<SelectTrigger className="bg-background border-border">
														<SelectValue placeholder="Select a company..." />
													</SelectTrigger>
													<SelectContent>
														{existingCompanies.map((comp) => (
															<SelectItem key={comp.id} value={comp.id}>
																<div className="flex flex-col">
																	<span>{comp.name}</span>
																	<span className="text-xs text-muted-foreground">
																		{comp.legalForm} • {comp.registrationNumber}
																	</span>
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										) : (
											<div className="space-y-4">
												<div className="space-y-2">
													<Label className="text-sm">Company Name</Label>
													<Input
														type="text"
														value={company.name}
														onChange={(e) => updateCompanyOwner(company.id, "name", e.target.value)}
														className="bg-background border-border"
														placeholder="Enter company name..."
													/>
												</div>
												<div className="grid grid-cols-2 gap-4">
													<div className="space-y-2">
														<Label className="text-sm">Legal Form</Label>
														<Select
															value={company.legalForm}
															onValueChange={(value) =>
																updateCompanyOwner(company.id, "legalForm", value)
															}
														>
															<SelectTrigger className="bg-background border-border">
																<SelectValue placeholder="Select..." />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="SCI">SCI</SelectItem>
																<SelectItem value="SARL">SARL</SelectItem>
																<SelectItem value="SA">SA</SelectItem>
																<SelectItem value="SAS">SAS</SelectItem>
																<SelectItem value="EURL">EURL</SelectItem>
																<SelectItem value="LLC">LLC</SelectItem>
																<SelectItem value="LTD">LTD</SelectItem>
																<SelectItem value="Other">Other</SelectItem>
															</SelectContent>
														</Select>
													</div>
													<div className="space-y-2">
														<Label className="text-sm">Registration Number</Label>
														<Input
															type="text"
															value={company.registrationNumber}
															onChange={(e) =>
																updateCompanyOwner(company.id, "registrationNumber", e.target.value)
															}
															className="bg-background border-border"
															placeholder="000 000 000"
														/>
													</div>
												</div>
											</div>
										)}

										{/* Company Ownership Percentage */}
										<div className="space-y-2">
											<Label className="text-sm">Ownership percentage</Label>
											<div className="relative">
												<Input
													type="number"
													min="0"
													max="100"
													step="0.01"
													value={company.percentage}
													onChange={(e) =>
														updateCompanyOwner(company.id, "percentage", e.target.value)
													}
													className="bg-background border-border pr-12"
													placeholder="0"
												/>
												<span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
													%
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}

						{/* Add Co-Owner/Company Buttons */}
						<div className="flex gap-3">
							<Button type="button" variant="outline" onClick={addCoOwner} className="flex-1 gap-2">
								<UserPlus className="h-4 w-4" />
								Add Co-Owner
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={addCompanyOwner}
								className="flex-1 gap-2"
							>
								<Building2 className="h-4 w-4" />
								Add Company
							</Button>
						</div>

						{/* Total Ownership Summary */}
						<div
							className={`p-4 rounded-lg border ${
								totalOwnership === 100
									? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
									: totalOwnership > 100
										? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
										: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900"
							}`}
						>
							<div className="flex items-center justify-between">
								<span className="text-sm">Total Ownership</span>
								<span
									className={`font-medium ${
										totalOwnership === 100
											? "text-green-600 dark:text-green-400"
											: totalOwnership > 100
												? "text-red-600 dark:text-red-400"
												: "text-yellow-600 dark:text-yellow-400"
									}`}
								>
									{totalOwnership.toFixed(2)}%
								</span>
							</div>
							{totalOwnership !== 100 && (
								<p className="text-xs mt-2 text-muted-foreground">
									{totalOwnership > 100
										? "Total ownership exceeds 100%. Please adjust the percentages."
										: "Total ownership is less than 100%. Remaining ownership will be unassigned."}
								</p>
							)}
						</div>
					</div>
				);
			}

			default:
				return (
					<div className="space-y-4">
						<p className="text-muted-foreground">Section "{currentStep}"</p>
					</div>
				);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className=" w-[80%] h-[92vh] p-0 gap-0 overflow-hidden bg-background">
				<DialogTitle className="sr-only">Add my Real Estate</DialogTitle>
				<DialogDescription className="sr-only">
					Add a new real estate property to your portfolio by filling out the information step by
					step
				</DialogDescription>

				{/* Content */}
				<div className="flex flex-1 overflow-hidden h-full">
					{/* Left Sidebar - Steps Navigation */}
					<div className="w-56 border-r border-border p-5 space-y-1 flex-shrink-0">
						{steps.map((step, index) => (
							<Button
								variant="ghost"
								key={step.id}
								onClick={() => setCurrentStep(step.id)}
								className={`w-full justify-start px-3 py-2.5 rounded-lg transition-colors text-sm h-auto ${
									currentStep === step.id
										? "bg-primary/10 text-primary font-medium"
										: index <= currentStepIndex
											? "text-foreground hover:bg-accent"
											: "text-muted-foreground cursor-not-allowed"
								}`}
								disabled={index > currentStepIndex}
							>
								{step.label}
							</Button>
						))}
					</div>

					{/* Right Content Area */}
					<div className="flex-1 flex flex-col min-w-0">
						<div className="flex-1 min-h-0 overflow-y-auto px-10 py-8">
							<div className="max-w-3xl mx-auto">
								<div className="flex items-start justify-between mb-8">
									<h1>Add my Real Estate</h1>
									<Button
										variant="ghost"
										onClick={onClose}
										className="p-2 h-auto w-auto -mt-1"
										aria-label="Close dialog"
									>
										<X className="h-5 w-5" />
									</Button>
								</div>
								{renderStepContent()}
							</div>
						</div>

						{/* Footer Actions */}
						<div className="border-t border-border px-10 py-5 flex items-center justify-between bg-background">
							<div className="max-w-3xl mx-auto w-full flex items-center justify-between">
								<Button
									variant="ghost"
									onClick={handleBack}
									disabled={currentStepIndex === 0}
									className="gap-2"
								>
									<ChevronLeft className="h-4 w-4" />
									Back
								</Button>
								<Button onClick={handleNext} className="gap-2 bg-primary hover:bg-primary/90">
									{currentStepIndex === steps.length - 1 ? "Submit" : "Next"}
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
