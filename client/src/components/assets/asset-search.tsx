import {
	Building2,
	Coins,
	CreditCard,
	Home,
	Package,
	Search,
	Shield,
	Watch,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Asset, AssetFilter } from "@/hooks/use-asset-management";
import { useAssets, useAssetTypes } from "@/hooks/use-asset-management";
import { useDebounce } from "@/hooks/use-debounce";

interface AssetSearchProps {
	onAssetSelect: (asset: Asset) => void;
	selectedAssets?: Asset[];
	placeholder?: string;
	className?: string;
	showFilters?: boolean;
	excludeAssetIds?: string[];
}

const ASSET_TYPE_ICONS: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	STOCK: Building2,
	CRYPTO: Coins,
	BANK_ACCOUNT: CreditCard,
	REAL_ESTATE: Home,
	LIFE_INSURANCE: Shield,
	WATCH: Watch,
	OTHER_VALUABLE: Package,
};

export function AssetSearch({
	onAssetSelect,
	selectedAssets = [],
	placeholder = "Search assets...",
	className,
	showFilters = true,
	excludeAssetIds = [],
}: AssetSearchProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedAssetType, setSelectedAssetType] = useState<string>("all");
	const [isOpen, setIsOpen] = useState(false);

	const debouncedSearchTerm = useDebounce(searchTerm, 300);
	const { assetTypes } = useAssetTypes();

	// Build filter for asset query
	const assetFilter: AssetFilter = useMemo(() => {
		const filter: AssetFilter = {};

		if (debouncedSearchTerm) {
			filter.nameContains = debouncedSearchTerm;
		}

		if (selectedAssetType !== "all") {
			filter.assetTypeID = selectedAssetType;
		}

		return filter;
	}, [debouncedSearchTerm, selectedAssetType]);

	const { assets, loading } = useAssets(assetFilter, { limit: 50 });

	// Filter out excluded and already selected assets
	const filteredAssets = useMemo(() => {
		const selectedIds = new Set(selectedAssets.map((a) => a.id));
		const excludedIds = new Set(excludeAssetIds);

		return assets.filter(
			(asset) => !selectedIds.has(asset.id) && !excludedIds.has(asset.id),
		);
	}, [assets, selectedAssets, excludeAssetIds]);

	const handleAssetSelect = (asset: Asset) => {
		onAssetSelect(asset);
		setSearchTerm("");
		setIsOpen(false);
	};

	const clearSearch = () => {
		setSearchTerm("");
		setSelectedAssetType("all");
	};

	const hasActiveFilters = searchTerm || selectedAssetType !== "all";

	return (
		<div className={`space-y-3 ${className}`}>
			{/* Filters */}
			{showFilters && (
				<div className="flex gap-2 items-center">
					<Select
						value={selectedAssetType}
						onValueChange={setSelectedAssetType}
					>
						<SelectTrigger className="w-48">
							<SelectValue placeholder="Asset type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{assetTypes.map((type) => {
								const Icon = ASSET_TYPE_ICONS[type.name] || Package;
								return (
									<SelectItem key={type.id} value={type.id}>
										<div className="flex items-center gap-2">
											<Icon className="h-4 w-4" />
											{type.name.replace("_", " ")}
										</div>
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>

					{hasActiveFilters && (
						<Button variant="ghost" size="sm" onClick={clearSearch}>
							<X className="h-4 w-4 mr-1" />
							Clear
						</Button>
					)}
				</div>
			)}

			{/* Search Input */}
			<Popover open={isOpen} onOpenChange={setIsOpen}>
				<PopoverTrigger asChild>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder={placeholder}
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-9"
						/>
					</div>
				</PopoverTrigger>
				<PopoverContent className="w-full max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-0" align="start">
					<Command>
						<CommandInput
							placeholder="Search assets..."
							value={searchTerm}
							onValueChange={setSearchTerm}
						/>
						<CommandList>
							{loading && (
								<div className="p-4 text-center text-sm text-muted-foreground">
									Searching...
								</div>
							)}

							{!loading && filteredAssets.length === 0 && (
								<CommandEmpty>
									{debouncedSearchTerm
										? "No assets found."
										: "Start typing to search assets."}
								</CommandEmpty>
							)}

							{!loading && filteredAssets.length > 0 && (
								<CommandGroup>
									{filteredAssets.map((asset) => {
										const Icon =
											ASSET_TYPE_ICONS[asset.assetType.name] || Package;
										return (
											<CommandItem
												key={asset.id}
												onSelect={() => handleAssetSelect(asset)}
												className="flex items-center gap-3 p-3"
											>
												<Icon className="h-5 w-5 text-muted-foreground" />
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<span className="font-medium truncate">
															{asset.name}
														</span>
														{asset.symbol && (
															<Badge variant="outline" className="text-xs">
																{asset.symbol}
															</Badge>
														)}
													</div>
													<div className="flex items-center gap-2">
														<Badge variant="secondary" className="text-xs">
															{asset.assetType.name.replace("_", " ")}
														</Badge>
														{asset.currentValue && (
															<span className="text-xs text-muted-foreground">
																${asset.currentValue.toLocaleString()}
															</span>
														)}
													</div>
												</div>
											</CommandItem>
										);
									})}
								</CommandGroup>
							)}
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			{/* Selected Assets Display */}
			{selectedAssets.length > 0 && (
				<Card>
					<CardContent className="p-3">
						<div className="flex items-center gap-2 mb-2">
							<span className="text-sm font-medium">Selected Assets:</span>
							<Badge variant="secondary">{selectedAssets.length}</Badge>
						</div>
						<div className="flex flex-wrap gap-2">
							{selectedAssets.map((asset) => {
								const Icon = ASSET_TYPE_ICONS[asset.assetType.name] || Package;
								return (
									<Badge key={asset.id} variant="outline" className="gap-1">
										<Icon className="h-3 w-3" />
										{asset.name}
										{asset.symbol && ` (${asset.symbol})`}
									</Badge>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
