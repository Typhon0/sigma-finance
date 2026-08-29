import {
	ArrowLeft,
	Building2,
	Calendar,
	DollarSign,
	Edit,
	FileText,
	Home,
	MapPin,
	Maximize,
	MoreVertical,
	Share2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import exampleImage from "@/assets/placeholder.svg";
import { AssetDetailChart, type AssetDetailChartPoint } from "@/components/charts/AssetDetailChart";
import { usePortfolio } from "@/components/PortfolioProvider";
import { PageTimeframeSelector, type TimeRange } from "@/components/shared/PageTimeframeSelector";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface RealEstateDetailProps {
	propertyId: string;
	onBack: () => void;
	isPanel?: boolean;
}

export function RealEstateDetail({ propertyId, onBack, isPanel = false }: RealEstateDetailProps) {
	const { assets } = usePortfolio();
	const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

	const property = assets.find((a) => a.id === propertyId && a.type === "real_estate");

	const chartData = useMemo(() => {
		if (!property) return [];
		const data: AssetDetailChartPoint[] = [];
		let days: number;

		if (timeRange === "7D") days = 7;
		else if (timeRange === "1D") days = 1;
		else if (timeRange === "1M") days = 30;
		else if (timeRange === "YTD") {
			const now = new Date();
			const startOfYear = new Date(now.getFullYear(), 0, 1);
			days = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
		} else if (timeRange === "1Y") days = 365;
		else days = 1825; // ALL (5 years)

		const startPrice = property.purchasePrice || 195000;
		const currentPrice = property.currentValue || 228930;
		const priceIncrement = (currentPrice - startPrice) / days;

		for (let i = 0; i <= days; i++) {
			const date = new Date();
			date.setDate(date.getDate() - (days - i));
			const price = startPrice + priceIncrement * i + (Math.random() * 5000 - 2500);

			data.push({
				date: date.toISOString().split("T")[0],
				close: Math.round(price),
			});
		}

		return data;
	}, [timeRange, property]);

	if (!property) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center space-y-4">
					<p className="text-muted-foreground">Property not found</p>
					<Button onClick={onBack}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Properties
					</Button>
				</div>
			</div>
		);
	}

	const currentPrice = property.currentValue || 228930;
	const purchasePrice = property.purchasePrice || 195000;
	const pnl = currentPrice - purchasePrice;
	const pnlPercentage = ((pnl / purchasePrice) * 100).toFixed(2);
	const surfaceArea = property.surfaceArea || 130;
	const pricePerM2 = Math.round(currentPrice / surfaceArea);
	const marketPricePerM2 = 1500;
	const ownershipPercentage = property.ownershipPercentage || 100;
	const ownedShare = (currentPrice * ownershipPercentage) / 100;

	const handleExport = () => {
		toast.success("Property details exported successfully");
	};

	const handleShare = () => {
		toast.success("Property link copied to clipboard");
	};

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className={cn("border-b", isPanel ? "px-4 py-3" : "px-6 py-4")}>
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						{!isPanel && (
							<Button variant="ghost" size="icon" onClick={onBack}>
								<ArrowLeft className="h-4 w-4" />
							</Button>
						)}
						<div>
							<div className="flex items-center space-x-2">
								<MapPin className="h-4 w-4 text-muted-foreground" />
								<h1 className={cn("text-2xl", isPanel && "text-lg font-bold")}>
									{property.address || property.name}
								</h1>
							</div>
							<p className="text-sm text-muted-foreground mt-1">
								{property.city || "Nivange"}, {property.country || "France"}
							</p>
						</div>
					</div>

					<div className="flex items-center space-x-4">
						<PageTimeframeSelector
							value={timeRange}
							onChange={setTimeRange}
							ranges={["7D", "1M", "YTD", "1Y", "ALL"]}
						/>
						<div className="flex items-center space-x-2">
							<Button variant="outline" size="sm" onClick={handleShare}>
								<Share2 className="h-4 w-4 mr-2" />
								Share
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon">
										<MoreVertical className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => toast.info("Edit property")}>
										<Edit className="h-4 w-4 mr-2" />
										Edit Property
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleExport}>
										<FileText className="h-4 w-4 mr-2" />
										Export Details
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1">
				<div className={cn("space-y-6", isPanel ? "p-4" : "p-6")}>
					{/* Price and Chart */}
					<div className={cn("grid gap-6", isPanel ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
						{/* Chart Card */}
						<div className="lg:col-span-2">
							<div className="mb-4">
								<div className="text-4xl font-mono mb-2">€{currentPrice.toLocaleString()}</div>
								<div className="flex items-center space-x-2">
									{pnl >= 0 ? <TrendArrowUp /> : <TrendArrowDown />}
									<span className={pnl >= 0 ? "text-green-600" : "text-red-600"}>
										{pnl >= 0 ? "+" : ""}€{pnl.toLocaleString()} ({pnl >= 0 ? "+" : ""}
										{pnlPercentage}%)
									</span>
								</div>
							</div>

							<AssetDetailChart
								data={chartData}
								symbol="Property"
								initialChartType="area"
								showIndicators={false}
								showTypeSelector={false}
								height={350}
								timeRange={timeRange}
							/>
						</div>

						{/* Price per M2 Card */}
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">PRICE PER M²</CardTitle>
								<CardDescription>Compared to market</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<div className="text-2xl font-mono">€{pricePerM2.toLocaleString()}</div>
									<p className="text-sm text-muted-foreground mt-1">Current price per m²</p>
								</div>

								<Separator />

								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Market average</span>
										<span>€{marketPricePerM2.toLocaleString()}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Difference</span>
										<span
											className={pricePerM2 > marketPricePerM2 ? "text-red-600" : "text-green-600"}
										>
											{pricePerM2 > marketPricePerM2 ? "+" : ""}€
											{(pricePerM2 - marketPricePerM2).toLocaleString()}
										</span>
									</div>
								</div>

								<div className="text-xs text-muted-foreground">
									We are unable to display the comparison for your property at this time. This may
									be due to a lack of recent sales data or insufficient information for your region.
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Property Overview */}
					<div
						className={cn(
							"grid gap-6",
							isPanel ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 md:grid-cols-3",
						)}
					>
						{/* P&L */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">P&L</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-1">
									{pnl >= 0 ? "+" : ""}€{Math.abs(pnl).toLocaleString()}
								</div>
								<div className="text-sm text-muted-foreground">
									<span className={pnl >= 0 ? "text-green-600" : "text-red-600"}>
										{pnl >= 0 ? "+" : ""}
										{pnlPercentage}%
									</span>{" "}
									since purchase
								</div>
								<p className="text-xs text-muted-foreground mt-2">
									The price of this property is estimated at €{currentPrice.toLocaleString()} based
									on the analysis of similar properties.
								</p>
							</CardContent>
						</Card>

						{/* Net Ownership */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">NET OWNERSHIP</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-1">{ownershipPercentage}%</div>
								<div className="text-sm text-muted-foreground">Ownership percentage</div>
							</CardContent>
						</Card>

						{/* Owned Share */}
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-sm">OWNED SHARE</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="text-2xl font-mono mb-1">€{ownedShare.toLocaleString()}</div>
								<div className="text-sm text-muted-foreground">Current value of your share</div>
							</CardContent>
						</Card>
					</div>

					{/* Specifications and Fees */}
					<div className={cn("grid gap-6", isPanel ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
						{/* Specifications */}
						<Card>
							<CardHeader>
								<CardTitle>Specifications</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-sm text-muted-foreground mb-1">Type</p>
										<div className="flex items-center space-x-2">
											<Home className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">{property.propertyType || "House"}</p>
										</div>
									</div>

									<div>
										<p className="text-sm text-muted-foreground mb-1">Category</p>
										<div className="flex items-center space-x-2">
											<Building2 className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">{property.category || "Residence"}</p>
										</div>
									</div>

									<div>
										<p className="text-sm text-muted-foreground mb-1">Surface area</p>
										<div className="flex items-center space-x-2">
											<Maximize className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">{surfaceArea} m²</p>
										</div>
									</div>

									<div>
										<p className="text-sm text-muted-foreground mb-1">
											Price per m² when purchased
										</p>
										<div className="flex items-center space-x-2">
											<DollarSign className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">€{property.purchasePricePerM2 || "1,500"} / m²</p>
										</div>
									</div>

									<div>
										<p className="text-sm text-muted-foreground mb-1">Date of purchase</p>
										<div className="flex items-center space-x-2">
											<Calendar className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">
												{property.purchaseDate
													? new Date(property.purchaseDate).toLocaleDateString()
													: "11/18/2021"}
											</p>
										</div>
									</div>

									<div>
										<p className="text-sm text-muted-foreground mb-1">Construction date</p>
										<div className="flex items-center space-x-2">
											<Calendar className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium">{property.constructionDate || "1947"}</p>
										</div>
									</div>

									<div className="col-span-2">
										<p className="text-sm text-muted-foreground mb-1">Purchase price</p>
										<div className="flex items-center space-x-2">
											<DollarSign className="h-4 w-4 text-muted-foreground" />
											<p className="font-medium text-lg">€{purchasePrice.toLocaleString()}</p>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Fees */}
						<Card>
							<CardHeader>
								<CardTitle>Fees</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Agency fees</span>
										<span className="font-medium">
											€{property.agencyFees?.toLocaleString() || "14,300"}
										</span>
									</div>

									<Separator />

									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Other initial fees</span>
										<span className="font-medium">
											€{property.otherFees?.toLocaleString() || "30,000"}
										</span>
									</div>

									<Separator />

									<div className="flex items-center justify-between">
										<span className="text-sm text-muted-foreground">Financing costs</span>
										<span className="font-medium">-</span>
									</div>

									<Separator />

									<div className="flex items-center justify-between pt-2">
										<span className="font-medium">Total Fees</span>
										<span className="font-mono text-lg">
											€
											{(
												(property.agencyFees || 14300) + (property.otherFees || 30000)
											).toLocaleString()}
										</span>
									</div>
								</div>

								<div className="mt-4 p-3 bg-muted rounded-lg">
									<p className="text-xs text-muted-foreground">
										💡 Tip: Keep track of all fees to accurately calculate your return on
										investment.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Property Image */}
					{property.imageUrl && (
						<Card>
							<CardHeader>
								<CardTitle>Property Photos</CardTitle>
							</CardHeader>
							<CardContent>
								<img
									src={property.imageUrl || exampleImage}
									alt={property.name}
									className="w-full h-96 object-cover rounded-lg"
								/>
							</CardContent>
						</Card>
					)}

					{/* Additional Information */}
					<Card>
						<CardHeader>
							<CardTitle>Additional Information</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground mb-1">Rooms</p>
									<p className="font-medium">{property.rooms || "5"}</p>
								</div>
								<div>
									<p className="text-muted-foreground mb-1">Bedrooms</p>
									<p className="font-medium">{property.bedrooms || "3"}</p>
								</div>
								<div>
									<p className="text-muted-foreground mb-1">Bathrooms</p>
									<p className="font-medium">{property.bathrooms || "2"}</p>
								</div>
								<div>
									<p className="text-muted-foreground mb-1">Energy Rating</p>
									<p className="font-medium">{property.energyRating || "C"}</p>
								</div>
							</div>

							{property.description && (
								<div className="mt-4">
									<p className="text-sm text-muted-foreground mb-2">Description</p>
									<p className="text-sm">{property.description}</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</ScrollArea>
		</div>
	);
}
