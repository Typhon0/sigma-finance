import ReactECharts from "echarts-for-react";
import {
	ArrowRight,
	BarChart3,
	Building2,
	ChevronLeft,
	ChevronRight,
	Euro,
	Filter,
	Home,
	LayoutGrid,
	List,
	MapPin,
	Maximize,
	Plus,
	SortAsc,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import exampleImage from "@/assets/placeholder.svg";
import { usePortfolio } from "@/components/PortfolioProvider";
import { SearchInput } from "@/components/ui/search-input";
import { AddRealEstateForm } from "./AddRealEstateForm";
import { RealEstateAnalytics } from "./RealEstateAnalytics";
import { TrendArrowDown, TrendArrowUp } from "./TrendArrows";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface RealEstateListProps {
	onSelectProperty: (propertyId: string) => void;
}

type ViewMode = "grid" | "list";

export function RealEstateList({ onSelectProperty }: RealEstateListProps) {
	const { assets, addRealEstate, currentPortfolio, refetch } = usePortfolio();
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("value");
	const [filterType, setFilterType] = useState("all");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [currentPage, setCurrentPage] = useState(1);
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const itemsPerPage = viewMode === "grid" ? 9 : 15;

	const realEstateAssets = assets.filter((asset) => asset.type === "real_estate");

	// Debug log
	React.useEffect(() => {
		if (realEstateAssets.length === 0) {
		}
	}, [realEstateAssets.length, realEstateAssets]);

	const filteredProperties = realEstateAssets
		.filter((property) => {
			const matchesSearch =
				property.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				property.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				property.city?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesType = filterType === "all" || property.propertyType === filterType;
			return matchesSearch && matchesType;
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
				case "name":
					return (a.name || "").localeCompare(b.name || "");
				default:
					return 0;
			}
		});

	const getTotalValue = () => {
		return realEstateAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
	};

	const getTotalGain = () => {
		return realEstateAssets.reduce((sum, asset) => {
			const gain = (asset.currentValue || 0) - (asset.purchasePrice || 0);
			return sum + gain;
		}, 0);
	};

	const totalValue = getTotalValue();
	const totalGain = getTotalGain();

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleAddProperty = async (formData: any) => {
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addRealEstate({
				name: formData.name || formData.type || "Property",
				assetTypeID: "4", // Real Estate asset type ID from server
				propertyType: formData.type || "House",
				address: formData.address || "",
				city: formData.city || "",
				state: formData.state || undefined,
				country: formData.country || "US",
				zipCode: formData.postalCode || undefined,
				squareFeet: parseFloat(formData.surface) || undefined,
				bedrooms: undefined,
				bathrooms: undefined,
				currentValue:
					parseFloat(formData.currentValuation) || parseFloat(formData.purchasePrice) || undefined,
				purchasePrice: parseFloat(formData.purchasePrice) || undefined,
				purchaseDate: formData.purchaseDate || undefined,
			});

			if (result.asset) {
				toast.success("Property added successfully!", {
					description: `${formData.name || formData.type || "Property"} has been added to your portfolio.`,
				});
				await refetch();
			} else {
				throw new Error("createRealEstateAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add property. Please try again.");
			throw error;
		}
	};
	const totalGainPercent = totalValue > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0;

	// Pagination
	const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedProperties = filteredProperties.slice(startIndex, endIndex);

	// Reset to page 1 when filters change
	React.useEffect(() => {
		setCurrentPage(1);
	}, []);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Real Estate Portfolio</h1>
					<p className="text-muted-foreground">Manage your property investments</p>
				</div>
				<Button onClick={() => setIsAddFormOpen(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Property
				</Button>
			</div>

			{/* Main Tabs */}
			<Tabs defaultValue="properties" className="space-y-6">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="properties">
						<LayoutGrid className="h-4 w-4 mr-2" />
						Properties
					</TabsTrigger>
					<TabsTrigger value="analytics">
						<BarChart3 className="h-4 w-4 mr-2" />
						Analytics
					</TabsTrigger>
				</TabsList>

				{/* Properties Tab */}
				<TabsContent value="properties" className="space-y-6">
					{/* Help Banner for empty state */}
					{realEstateAssets.length === 0 && (
						<Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
							<CardContent className="pt-6">
								<div className="flex items-start gap-3">
									<div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
										<span className="text-blue-600 dark:text-blue-400">💡</span>
									</div>
									<div className="flex-1">
										<h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
											No Properties Found
										</h4>
										<p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
											It looks like your demo data hasn't loaded. This can happen if you were using
											the app before the Real Estate feature was added.
										</p>
										<p className="text-sm text-blue-700 dark:text-blue-300">
											<strong>Quick fix:</strong> Click on your profile picture in the top-right
											corner and select <strong>"Reset Demo Data"</strong> or simply{" "}
											<strong>log out and log back in</strong> to reload the demo properties.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Performance Overview */}
					{realEstateAssets.length > 0 && (
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Performance Overview</CardTitle>
										<CardDescription>Quick snapshot of your real estate portfolio</CardDescription>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											const tabsElement = document.querySelector('[value="analytics"]');
											if (tabsElement instanceof HTMLElement) {
												tabsElement.click();
											}
										}}
									>
										View All Analytics
										<ArrowRight className="h-4 w-4 ml-1" />
									</Button>
								</div>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Quick Stats Grid - Real Estate Specific */}
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-2">
											<Home className="h-4 w-4 text-muted-foreground" />
											<p className="text-xs text-muted-foreground">Total Value</p>
										</div>
										<div className="font-mono text-xl">€{(totalValue / 1000).toFixed(0)}k</div>
										<p
											className={`text-xs mt-1 ${totalGain >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{totalGain >= 0 ? "+" : ""}€{(Math.abs(totalGain) / 1000).toFixed(0)}k (
											{totalGain >= 0 ? "+" : ""}
											{totalGainPercent.toFixed(1)}%)
										</p>
									</div>

									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-2">
											<Building2 className="h-4 w-4 text-muted-foreground" />
											<p className="text-xs text-muted-foreground">Properties</p>
										</div>
										<div className="font-mono text-xl">{realEstateAssets.length}</div>
										<p className="text-xs text-muted-foreground mt-1">
											{new Set(realEstateAssets.map((p) => p.city)).size} locations
										</p>
									</div>

									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-2">
											<Maximize className="h-4 w-4 text-muted-foreground" />
											<p className="text-xs text-muted-foreground">Total Surface</p>
										</div>
										<div className="font-mono text-xl">
											{realEstateAssets
												.reduce((sum, p) => sum + (p.surface || 0), 0)
												.toLocaleString()}{" "}
											m²
										</div>
										<p className="text-xs text-muted-foreground mt-1">
											Avg:{" "}
											{Math.round(
												realEstateAssets.reduce((sum, p) => sum + (p.surface || 0), 0) /
													realEstateAssets.length,
											)}{" "}
											m²
										</p>
									</div>

									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-2">
											<Euro className="h-4 w-4 text-muted-foreground" />
											<p className="text-xs text-muted-foreground">Avg. Price/m²</p>
										</div>
										<div className="font-mono text-xl">
											€{(() => {
												const totalSurface = realEstateAssets.reduce(
													(sum, p) => sum + (p.surface || 0),
													0,
												);
												return totalSurface > 0
													? Math.round(totalValue / totalSurface).toLocaleString()
													: "0";
											})()}
										</div>
										<p className="text-xs text-muted-foreground mt-1">per square meter</p>
									</div>
								</div>

								{/* Charts Grid */}
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{/* Geographic Distribution */}
									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-4">
											<MapPin className="h-4 w-4" />
											<h4 className="text-sm font-medium">Geographic Distribution</h4>
										</div>
										<ReactECharts
											option={{
												tooltip: {
													trigger: "axis",
													backgroundColor: document.documentElement.classList.contains("dark")
														? "#161b22"
														: "#ffffff",
													borderColor: document.documentElement.classList.contains("dark")
														? "#30363d"
														: "#e9e9e7",
													textStyle: {
														color: document.documentElement.classList.contains("dark")
															? "#e6edf3"
															: "#37352f",
													},
													axisPointer: { type: "shadow" },
												},
												grid: {
													left: "5%",
													right: "15%",
													top: "5%",
													bottom: "5%",
													containLabel: true,
												},
												xAxis: {
													type: "value",
													axisLine: { show: false },
													axisTick: { show: false },
													axisLabel: {
														color: document.documentElement.classList.contains("dark")
															? "#7d8590"
															: "#888888",
														formatter: "€{value}k",
													},
													splitLine: {
														lineStyle: {
															color: document.documentElement.classList.contains("dark")
																? "#30363d"
																: "#e9e9e7",
															type: "dashed",
														},
													},
												},
												yAxis: {
													type: "category",
													data: (() => {
														const cities: { [key: string]: number } = {};
														realEstateAssets.forEach((p) => {
															const city = p.city || "Unknown";
															cities[city] = (cities[city] || 0) + (p.currentValue || 0);
														});
														return Object.entries(cities)
															.sort((a, b) => b[1] - a[1])
															.map(([city]) => city);
													})(),
													axisLine: { show: false },
													axisTick: { show: false },
													axisLabel: {
														color: document.documentElement.classList.contains("dark")
															? "#e6edf3"
															: "#37352f",
														fontSize: 11,
													},
												},
												series: [
													{
														type: "bar",
														data: (() => {
															const cities: { [key: string]: number } = {};
															realEstateAssets.forEach((p) => {
																const city = p.city || "Unknown";
																cities[city] = (cities[city] || 0) + (p.currentValue || 0);
															});
															const colors = [
																"#3b82f6",
																"#8b5cf6",
																"#ec4899",
																"#f59e0b",
																"#10b981",
																"#06b6d4",
															];
															return Object.entries(cities)
																.sort((a, b) => b[1] - a[1])
																.map(([, value], index) => ({
																	value: Math.round(value / 1000),
																	itemStyle: {
																		color: colors[index % colors.length],
																		borderRadius: [0, 4, 4, 0],
																	},
																}));
														})(),
														barWidth: "60%",
														label: {
															show: true,
															position: "right",
															formatter: "€{c}k",
															color: document.documentElement.classList.contains("dark")
																? "#e6edf3"
																: "#37352f",
															fontSize: 10,
														},
													},
												],
											}}
											style={{ height: "180px", width: "100%" }}
											opts={{ renderer: "svg" }}
										/>
									</div>

									{/* Property Types Distribution */}
									<div className="p-4 rounded-lg border bg-card">
										<div className="flex items-center gap-2 mb-4">
											<Building2 className="h-4 w-4" />
											<h4 className="text-sm font-medium">Property Types</h4>
										</div>
										<ReactECharts
											option={{
												tooltip: {
													trigger: "item",
													backgroundColor: document.documentElement.classList.contains("dark")
														? "#161b22"
														: "#ffffff",
													borderColor: document.documentElement.classList.contains("dark")
														? "#30363d"
														: "#e9e9e7",
													textStyle: {
														color: document.documentElement.classList.contains("dark")
															? "#e6edf3"
															: "#37352f",
													},
													// biome-ignore lint/suspicious/noExplicitAny: unavoidable
													formatter: (params: any) => {
														return `
                          <div style="padding: 4px;">
                            <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
                            <div style="font-family: monospace;">€${params.value}k (${params.percent}%)</div>
                          </div>
                        `;
													},
												},
												legend: {
													orient: "horizontal",
													bottom: 0,
													textStyle: {
														color: document.documentElement.classList.contains("dark")
															? "#e6edf3"
															: "#37352f",
														fontSize: 10,
													},
												},
												series: [
													{
														type: "pie",
														radius: ["40%", "65%"],
														center: ["50%", "42%"],
														avoidLabelOverlap: false,
														label: { show: false },
														emphasis: {
															label: {
																show: true,
																fontSize: 13,
																fontWeight: "bold",
																formatter: "{d}%",
															},
														},
														data: (() => {
															const types: { [key: string]: number } = {};
															realEstateAssets.forEach((p) => {
																const type = p.propertyType || "Unknown";
																types[type] = (types[type] || 0) + (p.currentValue || 0);
															});
															const colors = [
																"#3b82f6",
																"#8b5cf6",
																"#ec4899",
																"#f59e0b",
																"#10b981",
															];
															return Object.entries(types).map(([name, value], index) => ({
																name,
																value: Math.round(value / 1000),
																itemStyle: {
																	color: colors[index % colors.length],
																},
															}));
														})(),
													},
												],
											}}
											style={{ height: "180px", width: "100%" }}
											opts={{ renderer: "svg" }}
										/>
									</div>
								</div>

								{/* Price per Square Meter Comparison */}
								<div className="p-4 rounded-lg border bg-card">
									<div className="flex items-center justify-between mb-4">
										<div className="flex items-center gap-2">
											<Euro className="h-4 w-4" />
											<h4 className="text-sm font-medium">Price per m² Analysis</h4>
										</div>
										<span className="text-xs text-muted-foreground">
											Top {Math.min(6, realEstateAssets.length)} properties
										</span>
									</div>
									<ReactECharts
										option={{
											tooltip: {
												trigger: "axis",
												backgroundColor: document.documentElement.classList.contains("dark")
													? "#161b22"
													: "#ffffff",
												borderColor: document.documentElement.classList.contains("dark")
													? "#30363d"
													: "#e9e9e7",
												textStyle: {
													color: document.documentElement.classList.contains("dark")
														? "#e6edf3"
														: "#37352f",
												},
												axisPointer: { type: "shadow" },
											},
											grid: {
												left: "22%",
												right: "15%",
												top: "5%",
												bottom: "5%",
												containLabel: true,
											},
											xAxis: {
												type: "value",
												axisLine: { show: false },
												axisTick: { show: false },
												axisLabel: {
													color: document.documentElement.classList.contains("dark")
														? "#7d8590"
														: "#888888",
													formatter: "€{value}",
												},
												splitLine: {
													lineStyle: {
														color: document.documentElement.classList.contains("dark")
															? "#30363d"
															: "#e9e9e7",
														type: "dashed",
													},
												},
											},
											yAxis: {
												type: "category",
												data: (() => {
													const propsWithPrice = realEstateAssets
														.filter((p) => (p.surface || 0) > 0)
														.map((p) => ({
															name: p.name,
															pricePerSqm: (p.currentValue || 0) / (p.surface || 1),
														}))
														.sort((a, b) => b.pricePerSqm - a.pricePerSqm)
														.slice(0, 6);
													return propsWithPrice.map((p) =>
														p.name.length > 18 ? `${p.name.substring(0, 18)}...` : p.name,
													);
												})(),
												axisLine: { show: false },
												axisTick: { show: false },
												axisLabel: {
													color: document.documentElement.classList.contains("dark")
														? "#e6edf3"
														: "#37352f",
													fontSize: 10,
												},
											},
											series: [
												{
													type: "bar",
													data: (() => {
														const propsWithPrice = realEstateAssets
															.filter((p) => (p.surface || 0) > 0)
															.map((p) => ({
																pricePerSqm: (p.currentValue || 0) / (p.surface || 1),
															}))
															.sort((a, b) => b.pricePerSqm - a.pricePerSqm)
															.slice(0, 6);
														const maxPrice = Math.max(...propsWithPrice.map((p) => p.pricePerSqm));
														return propsWithPrice.map((p) => ({
															value: Math.round(p.pricePerSqm),
															itemStyle: {
																color: {
																	type: "linear",
																	x: 0,
																	y: 0,
																	x2: 1,
																	y2: 0,
																	colorStops: [
																		{ offset: 0, color: "#3b82f6" },
																		{
																			offset: 1,
																			color: p.pricePerSqm === maxPrice ? "#8b5cf6" : "#3b82f6",
																		},
																	],
																},
																borderRadius: [0, 4, 4, 0],
															},
														}));
													})(),
													barWidth: "60%",
													label: {
														show: true,
														position: "right",
														formatter: "€{c}/m²",
														color: document.documentElement.classList.contains("dark")
															? "#e6edf3"
															: "#37352f",
														fontSize: 10,
													},
												},
											],
										}}
										style={{ height: "200px", width: "100%" }}
										opts={{ renderer: "svg" }}
									/>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Filters and View Toggle */}
					<Card>
						<CardContent className="pt-6">
							<div className="flex flex-col gap-4">
								<div className="flex flex-col md:flex-row gap-4">
									<SearchInput
										placeholder="Search by name, address, or city..."
										value={searchTerm}
										onChange={(e) => setSearchTerm(e.target.value)}
										onClear={() => setSearchTerm("")}
										containerClassName="flex-1"
									/>

									<Select value={filterType} onValueChange={setFilterType}>
										<SelectTrigger className="w-full md:w-[180px]">
											<Filter className="h-4 w-4 mr-2" />
											<SelectValue placeholder="Filter by type" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Types</SelectItem>
											<SelectItem value="House">House</SelectItem>
											<SelectItem value="Apartment">Apartment</SelectItem>
											<SelectItem value="Commercial">Commercial</SelectItem>
											<SelectItem value="Land">Land</SelectItem>
										</SelectContent>
									</Select>

									<Select value={sortBy} onValueChange={setSortBy}>
										<SelectTrigger className="w-full md:w-[180px]">
											<SortAsc className="h-4 w-4 mr-2" />
											<SelectValue placeholder="Sort by" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="value">Highest Value</SelectItem>
											<SelectItem value="gain">Highest Gain</SelectItem>
											<SelectItem value="name">Name (A-Z)</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{/* View Mode Toggle and Results Count */}
								<div className="flex items-center justify-between">
									<p className="text-sm text-muted-foreground">
										{filteredProperties.length > 0
											? `Showing ${startIndex + 1}-${Math.min(endIndex, filteredProperties.length)} of ${filteredProperties.length} properties`
											: "No properties to display"}
									</p>
									<div className="flex gap-1 border rounded-lg p-1">
										<Button
											variant={viewMode === "grid" ? "secondary" : "ghost"}
											size="sm"
											onClick={() => setViewMode("grid")}
											className="h-8 px-3"
										>
											<LayoutGrid className="h-4 w-4" />
										</Button>
										<Button
											variant={viewMode === "list" ? "secondary" : "ghost"}
											size="sm"
											onClick={() => setViewMode("list")}
											className="h-8 px-3"
										>
											<List className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Properties Grid/List */}
					{filteredProperties.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-12">
								<Home className="h-12 w-12 text-muted-foreground mb-4" />
								<h3 className="text-lg font-medium mb-2">No properties found</h3>
								<p className="text-sm text-muted-foreground mb-4">
									{searchTerm
										? "Try adjusting your search or filters"
										: "Start building your real estate portfolio"}
								</p>
								<Button onClick={() => setIsAddFormOpen(true)}>
									<Plus className="h-4 w-4 mr-2" />
									Add Your First Property
								</Button>
							</CardContent>
						</Card>
					) : viewMode === "grid" ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{paginatedProperties.map((property) => {
								const currentValue = property.currentValue || 0;
								const purchasePrice = property.purchasePrice || 0;
								const gain = currentValue - purchasePrice;
								const gainPercent = purchasePrice > 0 ? (gain / purchasePrice) * 100 : 0;
								const surfaceArea = property.surfaceArea || 0;
								const pricePerM2 = surfaceArea > 0 ? Math.round(currentValue / surfaceArea) : 0;

								return (
									<Card
										key={property.id}
										className="cursor-pointer hover:shadow-lg transition-all group"
										onClick={() => onSelectProperty(property.id)}
									>
										<CardContent className="p-0">
											{/* Property Image */}
											<div className="relative h-32 overflow-hidden rounded-t-lg">
												<img
													src={property.imageUrl || exampleImage}
													alt={property.name}
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
												/>
												<div className="absolute top-2 right-2">
													<Badge
														variant="secondary"
														className="backdrop-blur-sm bg-background/80 text-xs"
													>
														{property.propertyType || "House"}
													</Badge>
												</div>
											</div>

											{/* Property Details */}
											<div className="p-4">
												<div className="space-y-3">
													{/* Name and Location */}
													<div>
														<h3 className="font-medium mb-1">{property.name}</h3>
														<div className="flex items-center text-xs text-muted-foreground">
															<MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
															<span className="truncate">
																{property.city || "Location not specified"}
															</span>
														</div>
													</div>

													{/* Price and Gain */}
													<div>
														<div className="font-mono">€{currentValue.toLocaleString()}</div>
														<div className="flex items-center space-x-1 mt-0.5">
															{gain >= 0 ? <TrendArrowUp /> : <TrendArrowDown />}
															<span
																className={`text-xs ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
															>
																{gain >= 0 ? "+" : ""}
																{gainPercent.toFixed(1)}%
															</span>
														</div>
													</div>

													{/* Property Stats */}
													<div className="grid grid-cols-2 gap-2 pt-3 border-t text-xs">
														<div>
															<p className="text-muted-foreground">Surface</p>
															<p className="font-medium">{surfaceArea} m²</p>
														</div>
														<div>
															<p className="text-muted-foreground">€/m²</p>
															<p className="font-medium">€{pricePerM2.toLocaleString()}</p>
														</div>
													</div>
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})}
						</div>
					) : (
						/* Table View */
						<Card>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-12"></TableHead>
										<TableHead>Property</TableHead>
										<TableHead>Type</TableHead>
										<TableHead className="text-right">Current Value</TableHead>
										<TableHead className="text-right">Purchase Price</TableHead>
										<TableHead className="text-right">Gain/Loss</TableHead>
										<TableHead className="text-right">Surface</TableHead>
										<TableHead className="w-12"></TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{paginatedProperties.map((property) => {
										const currentValue = property.currentValue || 0;
										const purchasePrice = property.purchasePrice || 0;
										const gain = currentValue - purchasePrice;
										const gainPercent = purchasePrice > 0 ? (gain / purchasePrice) * 100 : 0;
										const surfaceArea = property.surfaceArea || 0;
										const pricePerM2 = surfaceArea > 0 ? Math.round(currentValue / surfaceArea) : 0;

										return (
											<TableRow
												key={property.id}
												className="cursor-pointer hover:bg-muted/50"
												onClick={() => onSelectProperty(property.id)}
											>
												<TableCell>
													<div className="relative w-12 h-12 overflow-hidden rounded">
														<img
															src={property.imageUrl || exampleImage}
															alt={property.name}
															className="w-full h-full object-cover"
														/>
													</div>
												</TableCell>
												<TableCell>
													<div>
														<div className="font-medium">{property.name}</div>
														<div className="flex items-center text-xs text-muted-foreground">
															<MapPin className="h-3 w-3 mr-1" />
															{property.city || "N/A"}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="secondary" className="text-xs">
														{property.propertyType || "House"}
													</Badge>
												</TableCell>
												<TableCell className="text-right">
													<div className="font-mono">€{currentValue.toLocaleString()}</div>
													{pricePerM2 > 0 && (
														<div className="text-xs text-muted-foreground">€{pricePerM2}/m²</div>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="font-mono text-muted-foreground">
														€{purchasePrice.toLocaleString()}
													</div>
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-1">
														{gain >= 0 ? (
															<TrendingUp className="h-3 w-3 text-green-600" />
														) : (
															<TrendingDown className="h-3 w-3 text-red-600" />
														)}
														<span
															className={`font-mono ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															{gain >= 0 ? "+" : ""}€{Math.abs(gain).toLocaleString()}
														</span>
													</div>
													<div
														className={`text-xs ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
													>
														{gain >= 0 ? "+" : ""}
														{gainPercent.toFixed(1)}%
													</div>
												</TableCell>
												<TableCell className="text-right">
													<div>{surfaceArea} m²</div>
													{property.rooms && (
														<div className="text-xs text-muted-foreground">
															{property.rooms} rooms
														</div>
													)}
												</TableCell>
												<TableCell>
													<Button variant="ghost" size="icon" className="h-8 w-8">
														<ArrowRight className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</Card>
					)}

					{/* Pagination */}
					{filteredProperties.length > itemsPerPage && (
						<Card>
							<CardContent className="py-4">
								<div className="flex items-center justify-between">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
										disabled={currentPage === 1}
									>
										<ChevronLeft className="h-4 w-4 mr-1" />
										Previous
									</Button>

									<div className="flex items-center gap-2">
										{/* Show page numbers with smart truncation */}
										{totalPages <= 7 ? (
											// Show all pages if 7 or less
											Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
												<Button
													key={page}
													variant={currentPage === page ? "default" : "outline"}
													size="sm"
													onClick={() => setCurrentPage(page)}
													className="w-8 h-8 p-0"
												>
													{page}
												</Button>
											))
										) : (
											// Smart pagination for many pages
											<>
												{/* First page */}
												<Button
													variant={currentPage === 1 ? "default" : "outline"}
													size="sm"
													onClick={() => setCurrentPage(1)}
													className="w-8 h-8 p-0"
												>
													1
												</Button>

												{/* Left ellipsis */}
												{currentPage > 3 && <span className="px-2 text-muted-foreground">...</span>}

												{/* Pages around current */}
												{Array.from({ length: totalPages }, (_, i) => i + 1)
													.filter((page) => {
														if (page === 1 || page === totalPages) return false;
														return Math.abs(page - currentPage) <= 1;
													})
													.map((page) => (
														<Button
															key={page}
															variant={currentPage === page ? "default" : "outline"}
															size="sm"
															onClick={() => setCurrentPage(page)}
															className="w-8 h-8 p-0"
														>
															{page}
														</Button>
													))}

												{/* Right ellipsis */}
												{currentPage < totalPages - 2 && (
													<span className="px-2 text-muted-foreground">...</span>
												)}

												{/* Last page */}
												<Button
													variant={currentPage === totalPages ? "default" : "outline"}
													size="sm"
													onClick={() => setCurrentPage(totalPages)}
													className="w-8 h-8 p-0"
												>
													{totalPages}
												</Button>
											</>
										)}
									</div>

									<Button
										variant="outline"
										size="sm"
										onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
										disabled={currentPage === totalPages}
									>
										Next
										<ChevronRight className="h-4 w-4 ml-1" />
									</Button>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Analytics Tab */}
				<TabsContent value="analytics">
					<RealEstateAnalytics onSelectProperty={onSelectProperty} />
				</TabsContent>
			</Tabs>

			{/* Add Property Form Dialog */}
			<AddRealEstateForm
				open={isAddFormOpen}
				onClose={() => setIsAddFormOpen(false)}
				onSubmit={handleAddProperty}
			/>
		</div>
	);
}
