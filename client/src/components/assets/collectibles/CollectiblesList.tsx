import {
	ArrowRight,
	Car,
	Coins,
	Gem,
	LayoutGrid,
	List,
	Package,
	Palette,
	Plus,
	SortAsc,
	Watch,
	Wine,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { AddWatchForm } from "@/components/AddWatchForm";
import { usePortfolio } from "@/components/PortfolioProvider";
import { TrendArrowDown, TrendArrowUp } from "@/components/TrendArrows";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/use-currency";

interface CollectiblesListProps {
	onSelectCollectible: (collectibleId: string) => void;
}

type ViewMode = "grid" | "list";
type CollectibleType =
	| "all"
	| "watch"
	| "art"
	| "vehicle"
	| "jewelry"
	| "wine"
	| "precious_metals"
	| "other";

export function CollectiblesList({ onSelectCollectible }: CollectiblesListProps) {
	const { assets, addWatch, currentPortfolio, refetch } = usePortfolio();
	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState("value");
	const [activeTab, setActiveTab] = useState<CollectibleType>("all");
	const [viewMode, setViewMode] = useState<ViewMode>("grid");
	const [isAddFormOpen, setIsAddFormOpen] = useState(false);
	const [addFormType, setAddFormType] = useState<string>("watch");

	// Get all collectible types
	const collectibleTypes = ["watch", "art", "vehicle", "jewelry", "wine", "precious_metals"];
	const collectibleAssets = assets.filter((asset) => collectibleTypes.includes(asset.type));

	const filteredCollectibles = collectibleAssets
		.filter((item) => {
			const matchesSearch =
				item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				item.model?.toLowerCase().includes(searchTerm.toLowerCase());
			const matchesTab = activeTab === "all" || item.type === activeTab;
			return matchesSearch && matchesTab;
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
		return collectibleAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
	};

	const getTotalGain = () => {
		return collectibleAssets.reduce((sum, asset) => {
			const gain = (asset.currentValue || 0) - (asset.purchasePrice || 0);
			return sum + gain;
		}, 0);
	};

	const getCountByType = (type: string) => {
		return collectibleAssets.filter((asset) => asset.type === type).length;
	};

	const totalValue = getTotalValue();
	const totalGain = getTotalGain();
	const gainPercent = totalValue > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0;

	const { formatCurrencyCompact: formatCurrency } = useCurrency();

	const getTypeIcon = (type: string) => {
		const icons: Record<string, React.ComponentType<{ className?: string }>> = {
			watch: Watch,
			art: Palette,
			vehicle: Car,
			jewelry: Gem,
			wine: Wine,
			precious_metals: Coins,
		};
		return icons[type] || Package;
	};

	const getTypeBadge = (type: string) => {
		const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> =
			{
				watch: { label: "Watch", variant: "default" },
				art: { label: "Art", variant: "secondary" },
				vehicle: { label: "Vehicle", variant: "outline" },
				jewelry: { label: "Jewelry", variant: "default" },
				wine: { label: "Wine", variant: "secondary" },
				precious_metals: { label: "Precious Metals", variant: "outline" },
			};
		return badges[type] || { label: type, variant: "outline" };
	};

	const handleOpenAddForm = (type: string) => {
		setAddFormType(type);
		setIsAddFormOpen(true);
	};

	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	const handleAddCollectible = async (formData: any) => {
		if (addFormType !== "watch") {
			toast.info("Only watches can be added via API currently", {
				description: `Form for ${addFormType} coming soon!`,
			});
			setIsAddFormOpen(false);
			return;
		}
		if (!currentPortfolio) {
			toast.error("No portfolio selected. Please select a portfolio first.");
			throw new Error("No portfolio selected");
		}
		try {
			const result = await addWatch({
				name: formData.name || `${formData.brand || "Watch"} ${formData.model || ""}`.trim(),
				assetTypeID: "6", // Watch asset type ID from server
				brand: formData.brand || "Unknown",
				model: formData.model || "Unknown",
				serialNumber: formData.serialNumber || undefined,
				referenceNumber: formData.reference || undefined,
				condition: formData.condition || "Good",
				yearMade: formData.yearManufactured ? parseInt(formData.yearManufactured, 10) : undefined,
				material: formData.material || "stainless_steel",
				movement: formData.movement || "automatic",
				caseSize: undefined,
				waterResistance: undefined,
				currentValue: parseFloat(formData.currentValue) || undefined,
				purchasePrice: parseFloat(formData.purchasePrice) || undefined,
				purchaseDate: formData.purchaseDate || undefined,
			});

			if (result.asset) {
				setIsAddFormOpen(false);
				toast.success("Watch added successfully");
				await refetch();
			} else {
				throw new Error("createWatchAsset returned no asset");
			}
		} catch (error) {
			toast.error("Failed to add watch. Please try again.");
			throw error;
		}
	};

	if (collectibleAssets.length === 0) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h2 className="mb-1">Collectibles & Valuables</h2>
						<p className="text-sm text-muted-foreground">
							Track watches, art, vehicles, and other valuable items
						</p>
					</div>
					<Button onClick={() => handleOpenAddForm("watch")}>
						<Plus className="h-4 w-4 mr-2" />
						Add Collectible
					</Button>
				</div>

				<Card>
					<CardContent className="flex flex-col items-center justify-center py-16">
						<Package className="h-16 w-16 text-muted-foreground mb-4" />
						<h3 className="mb-2">No Collectibles</h3>
						<p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
							Start tracking your valuable items: luxury watches, art pieces, vehicles, jewelry, and
							more.
						</p>
						<div className="flex gap-2">
							<Button onClick={() => handleOpenAddForm("watch")}>
								<Watch className="h-4 w-4 mr-2" />
								Add Watch
							</Button>
							<Button variant="outline" onClick={() => handleOpenAddForm("art")}>
								<Palette className="h-4 w-4 mr-2" />
								Add Art
							</Button>
						</div>
					</CardContent>
				</Card>

				<Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
					<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>Add {addFormType === "watch" ? "Watch" : "Collectible"}</DialogTitle>
						</DialogHeader>
						{addFormType === "watch" && (
							<AddWatchForm
								onSubmit={handleAddCollectible}
								onCancel={() => setIsAddFormOpen(false)}
							/>
						)}
						{addFormType !== "watch" && (
							<div className="p-6 text-center">
								<p className="text-sm text-muted-foreground">Form for {addFormType} coming soon!</p>
								<Button onClick={() => setIsAddFormOpen(false)} className="mt-4">
									Close
								</Button>
							</div>
						)}
					</DialogContent>
				</Dialog>
			</div>
		);
	}

	return (
		<div className="p-6">
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div>
					<h2 className="mb-1">Collectibles & Valuables</h2>
					<p className="text-sm text-muted-foreground">
						{collectibleAssets.length} {collectibleAssets.length === 1 ? "item" : "items"}
					</p>
				</div>
				<Button onClick={() => handleOpenAddForm("watch")}>
					<Plus className="h-4 w-4 mr-2" />
					Add Collectible
				</Button>
			</div>

			{/* Info banner if collectibles are incomplete */}
			{collectibleAssets.length < 15 && (
				<div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
					<div className="flex gap-3">
						<Package className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
						<div className="space-y-1 flex-1">
							<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
								Portfolio Demo Incomplet
							</p>
							<p className="text-sm text-blue-700 dark:text-blue-300">
								Votre portfolio devrait contenir 15 collectibles (montres, art, véhicules, bijoux,
								vins, métaux précieux). Allez dans{" "}
								<strong>Paramètres → Préférences → Reset to Default Data</strong> pour charger le
								portfolio complet avec tous les exemples.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Value</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="font-mono">{formatCurrency(totalValue)}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Gain</CardDescription>
					</CardHeader>
					<CardContent>
						<div
							className={`flex items-center gap-1.5 font-mono ${totalGain >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{totalGain >= 0 ? (
								<TrendArrowUp className="flex-shrink-0" />
							) : (
								<TrendArrowDown className="flex-shrink-0" />
							)}
							<span>{formatCurrency(Math.abs(totalGain))}</span>
							<span className="text-xs">({gainPercent.toFixed(2)}%)</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardDescription>Total Items</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2 font-mono">
							<Package className="h-4 w-4 text-muted-foreground" />
							<span>{collectibleAssets.length}</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Tabs */}
			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as CollectibleType)}
				className="mb-6"
			>
				<TabsList className="w-full justify-start overflow-x-auto">
					<TabsTrigger value="all">All ({collectibleAssets.length})</TabsTrigger>
					<TabsTrigger value="watch">
						<Watch className="h-4 w-4 mr-2" />
						Watches ({getCountByType("watch")})
					</TabsTrigger>
					<TabsTrigger value="art">
						<Palette className="h-4 w-4 mr-2" />
						Art ({getCountByType("art")})
					</TabsTrigger>
					<TabsTrigger value="vehicle">
						<Car className="h-4 w-4 mr-2" />
						Vehicles ({getCountByType("vehicle")})
					</TabsTrigger>
					<TabsTrigger value="jewelry">
						<Gem className="h-4 w-4 mr-2" />
						Jewelry ({getCountByType("jewelry")})
					</TabsTrigger>
					<TabsTrigger value="wine">
						<Wine className="h-4 w-4 mr-2" />
						Wine ({getCountByType("wine")})
					</TabsTrigger>
					<TabsTrigger value="precious_metals">
						<Coins className="h-4 w-4 mr-2" />
						Metals ({getCountByType("precious_metals")})
					</TabsTrigger>
				</TabsList>
			</Tabs>

			{/* Filters & Search */}
			<Card className="mb-6">
				<CardContent className="pt-6">
					<div className="flex flex-col md:flex-row gap-4">
						<SearchInput
							placeholder="Search collectibles..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							onClear={() => setSearchTerm("")}
							containerClassName="flex-1"
						/>

						<Select value={sortBy} onValueChange={setSortBy}>
							<SelectTrigger className="w-full md:w-[200px]">
								<SortAsc className="h-4 w-4 mr-2" />
								<SelectValue placeholder="Sort by" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="value">Value</SelectItem>
								<SelectItem value="gain">Gain</SelectItem>
								<SelectItem value="name">Name</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex gap-2">
							<Button
								variant={viewMode === "grid" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("grid")}
							>
								<LayoutGrid className="h-4 w-4" />
							</Button>
							<Button
								variant={viewMode === "list" ? "default" : "outline"}
								size="icon"
								onClick={() => setViewMode("list")}
							>
								<List className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Grid View */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{filteredCollectibles.map((item) => {
					const gain = (item.currentValue || 0) - (item.purchasePrice || 0);
					const gainPercent = item.purchasePrice > 0 ? (gain / item.purchasePrice) * 100 : 0;
					const typeBadge = getTypeBadge(item.type);
					const TypeIcon = getTypeIcon(item.type);

					return (
						<Card
							key={item.id}
							className="cursor-pointer hover:shadow-md transition-shadow"
							onClick={() => onSelectCollectible(item.id)}
						>
							<CardHeader>
								<div className="flex items-start justify-between mb-2">
									<TypeIcon className="h-10 w-10 text-primary" />
									<Badge variant={typeBadge.variant}>{typeBadge.label}</Badge>
								</div>
								<CardTitle className="line-clamp-1">{item.name}</CardTitle>
								<CardDescription className="text-xs">
									{item.brand && item.model
										? `${item.brand} ${item.model}`
										: item.brand || item.model || "No details"}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div>
										<p className="text-xs text-muted-foreground mb-1">Current Value</p>
										<p className="font-mono">{formatCurrency(item.currentValue || 0)}</p>
									</div>

									<div>
										<p className="text-xs text-muted-foreground mb-1">Gain/Loss</p>
										<div
											className={`flex items-center gap-1.5 font-mono text-sm ${gain >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{gain >= 0 ? (
												<TrendArrowUp className="flex-shrink-0" />
											) : (
												<TrendArrowDown className="flex-shrink-0" />
											)}
											<span>
												{formatCurrency(Math.abs(gain))} ({gainPercent.toFixed(2)}%)
											</span>
										</div>
									</div>

									{item.condition && (
										<div>
											<p className="text-xs text-muted-foreground mb-1">Condition</p>
											<p className="text-sm">{item.condition}</p>
										</div>
									)}

									<div className="pt-2 border-t">
										<Button variant="ghost" size="sm" className="w-full justify-between">
											View Details
											<ArrowRight className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{filteredCollectibles.length === 0 && (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Package className="h-12 w-12 text-muted-foreground mb-3" />
						<p className="text-sm text-muted-foreground">No items found</p>
					</CardContent>
				</Card>
			)}

			{/* Add Collectible Dialog */}
			<Dialog open={isAddFormOpen} onOpenChange={setIsAddFormOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add {addFormType === "watch" ? "Watch" : "Collectible"}</DialogTitle>
					</DialogHeader>
					{addFormType === "watch" && (
						<AddWatchForm
							onSubmit={handleAddCollectible}
							onCancel={() => setIsAddFormOpen(false)}
						/>
					)}
					{addFormType !== "watch" && (
						<div className="p-6 text-center">
							<p className="text-sm text-muted-foreground">Form for {addFormType} coming soon!</p>
							<Button onClick={() => setIsAddFormOpen(false)} className="mt-4">
								Close
							</Button>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
