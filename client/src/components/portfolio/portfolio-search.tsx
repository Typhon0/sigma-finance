import { Filter, SortAsc, SortDesc, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import type { Portfolio } from "@/gql/graphql";
import type { SortConfig } from "@/hooks/use-debounced-search";

interface PortfolioSearchProps {
	searchTerm: string;
	onSearchChange: (term: string) => void;
	onFilterChange: (key: string, value: any) => void;
	onSortChange: (config: SortConfig<Portfolio> | null) => void;
	filters: Record<string, unknown>;
	sortConfig: SortConfig<Portfolio> | null;
	resultCount: number;
	totalCount: number;
	isSearching: boolean;
	onClearAll: () => void;
}

export function PortfolioSearch({
	searchTerm,
	onSearchChange,
	onFilterChange,
	onSortChange,
	filters,
	sortConfig,
	resultCount,
	totalCount,
	isSearching,
	onClearAll,
}: PortfolioSearchProps) {
	const [showFilters, setShowFilters] = useState(false);

	const hasActiveFilters = Object.keys(filters).length > 0 || searchTerm.trim() !== "";

	const sortOptions: Array<{
		label: string;
		field: keyof Portfolio;
		direction: "asc" | "desc";
	}> = [
		{ label: "Name (A-Z)", field: "name", direction: "asc" },
		{ label: "Name (Z-A)", field: "name", direction: "desc" },
		{ label: "Created (Newest)", field: "createdAt", direction: "desc" },
		{ label: "Created (Oldest)", field: "createdAt", direction: "asc" },
		{ label: "Updated (Recent)", field: "updatedAt", direction: "desc" },
		{ label: "Updated (Oldest)", field: "updatedAt", direction: "asc" },
	];

	const handleSortSelect = (field: keyof Portfolio, direction: "asc" | "desc") => {
		onSortChange({ field, direction });
	};

	const clearSort = () => {
		onSortChange(null);
	};

	return (
		<div className="space-y-4">
			{/* Search Bar */}
			<SearchInput
				placeholder="Search portfolios..."
				value={searchTerm}
				onChange={(e) => onSearchChange(e.target.value)}
				onClear={() => onSearchChange("")}
			/>

			{/* Filter and Sort Controls */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{/* Filter Button */}
					<DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Filter className="mr-2 h-4 w-4" />
								Filters
								{Object.keys(filters).length > 0 && (
									<Badge variant="secondary" className="ml-2">
										{Object.keys(filters).length}
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							<DropdownMenuLabel>Filter Options</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onFilterChange("hasAssets", true)}
								className={filters.hasAssets === true ? "bg-accent" : ""}
							>
								Has Assets
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => onFilterChange("hasAssets", false)}
								className={filters.hasAssets === false ? "bg-accent" : ""}
							>
								Empty Portfolios
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onFilterChange("hasAssets", undefined)}
								disabled={!filters.hasAssets}
							>
								Clear Asset Filter
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Sort Button */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								{sortConfig ? (
									sortConfig.direction === "asc" ? (
										<SortAsc className="mr-2 h-4 w-4" />
									) : (
										<SortDesc className="mr-2 h-4 w-4" />
									)
								) : (
									<SortAsc className="mr-2 h-4 w-4" />
								)}
								Sort
								{sortConfig && (
									<Badge variant="secondary" className="ml-2">
										{String(sortConfig.field)}
									</Badge>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-48">
							<DropdownMenuLabel>Sort Options</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{sortOptions.map((option) => (
								<DropdownMenuItem
									key={`${option.field}-${option.direction}`}
									onClick={() => handleSortSelect(option.field, option.direction)}
									className={
										sortConfig?.field === option.field && sortConfig?.direction === option.direction
											? "bg-accent"
											: ""
									}
								>
									{option.label}
								</DropdownMenuItem>
							))}
							{sortConfig && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={clearSort}>Clear Sort</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Clear All Button */}
					{hasActiveFilters && (
						<Button variant="ghost" size="sm" onClick={onClearAll}>
							<X className="mr-2 h-4 w-4" />
							Clear All
						</Button>
					)}
				</div>

				{/* Results Count */}
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					{isSearching ? (
						<span>Searching...</span>
					) : (
						<span>
							{resultCount === totalCount
								? `${totalCount} portfolios`
								: `${resultCount} of ${totalCount} portfolios`}
						</span>
					)}
				</div>
			</div>

			{/* Active Filters Display */}
			{hasActiveFilters && (
				<div className="flex flex-wrap gap-2">
					{searchTerm && (
						<Badge variant="secondary" className="gap-1">
							Search: "{searchTerm}"
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0"
								onClick={() => onSearchChange("")}
							>
								<X className="h-3 w-3" />
							</Button>
						</Badge>
					)}
					{Object.entries(filters).map(([key, value]) => (
						<Badge key={key} variant="secondary" className="gap-1">
							{key}: {String(value)}
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0"
								onClick={() => onFilterChange(key, undefined)}
							>
								<X className="h-3 w-3" />
							</Button>
						</Badge>
					))}
					{sortConfig && (
						<Badge variant="secondary" className="gap-1">
							Sort: {String(sortConfig.field)} ({sortConfig.direction})
							<Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={clearSort}>
								<X className="h-3 w-3" />
							</Button>
						</Badge>
					)}
				</div>
			)}
		</div>
	);
}
