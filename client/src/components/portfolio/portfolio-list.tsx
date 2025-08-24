import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Grid3X3, List, SortAsc } from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssets } from "@/hooks/use-asset-management";
import type { Portfolio } from "@/hooks/use-portfolio-management";
import { cn } from "@/lib/utils";
import {
	type PortfolioAction,
	PortfolioCard,
	type PortfolioCardProps,
	type ViewMode,
} from "./portfolio-card";

export type SortBy = "name" | "value" | "performance" | "created";

interface SortablePortfolioCardProps extends PortfolioCardProps {
	isDragging?: boolean;
}

const SortablePortfolioCard = ({
	portfolio,
	viewMode,
	isSelected,
	onSelect,
	onAction,
	isDragging,
	assets,
}: SortablePortfolioCardProps) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging: isSortableDragging,
	} = useSortable({ id: portfolio.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			aria-label={`Portfolio card for ${portfolio.name}`}
			aria-selected={isSelected}
			className="list-none"
		>
			<PortfolioCard
				portfolio={portfolio}
				viewMode={viewMode}
				isSelected={isSelected}
				onSelect={onSelect}
				onAction={onAction}
				isDragging={isDragging || isSortableDragging}
				assets={assets}
			/>
		</li>
	);
};

interface PortfolioListProps {
	portfolios: Portfolio[];
	viewMode: ViewMode;
	sortBy: SortBy;
	selectedPortfolios: string[];
	onSelectionChange: (selected: string[]) => void;
	onPortfolioAction: (action: PortfolioAction, portfolioId: string) => void;
	onViewModeChange: (mode: ViewMode) => void;
	onSortChange: (sort: SortBy) => void;
	onReorder?: (portfolios: Portfolio[]) => void;
	isLoading?: boolean;
	className?: string;
}

export function PortfolioList({
	portfolios,
	viewMode,
	sortBy,
	selectedPortfolios,
	onSelectionChange,
	onPortfolioAction,
	onViewModeChange,
	onSortChange,
	onReorder,
	isLoading = false,
	className,
}: PortfolioListProps) {
	const [draggedPortfolio, setDraggedPortfolio] = useState<string | null>(null);
	const [orderedPortfolios, setOrderedPortfolios] = useState(portfolios);

	// Fetch all assets for display or use in child components
	const { loading: assetsLoading, error: assetsError, assets } = useAssets();

	// Update ordered portfolios when portfolios prop changes
	React.useEffect(() => {
		setOrderedPortfolios(portfolios);
	}, [portfolios]);

	// Drag and drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragStart = (event: DragStartEvent) => {
		setDraggedPortfolio(event.active.id as string);
	};

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event;

		if (!active || !over) {
			return;
		}

		const draggedPortfolioId = active.id.toString();
		const targetPortfolioId = over.id.toString();

		if (draggedPortfolioId === targetPortfolioId) {
			return;
		}

		setOrderedPortfolios((items) => {
			const oldIndex = items.findIndex((p) => p.id === draggedPortfolioId);
			const newIndex = items.findIndex((p) => p.id === targetPortfolioId);

			if (oldIndex === -1 || newIndex === -1) {
				return items;
			}
			return arrayMove(items, oldIndex, newIndex);
		});
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (active && over && active.id !== over.id) {
			if (onReorder) {
				onReorder(orderedPortfolios);
			}
		}
		setDraggedPortfolio(null);
	};

	const handleSelectAll = () => {
		if (selectedPortfolios.length === portfolios.length) {
			// Deselect all
			onSelectionChange([]);
		} else {
			// Select all
			onSelectionChange(portfolios.map((p) => p.id));
		}
	};

	const handlePortfolioSelect = (portfolioId: string, selected: boolean) => {
		if (selected) {
			onSelectionChange([...selectedPortfolios, portfolioId]);
		} else {
			onSelectionChange(selectedPortfolios.filter((id) => id !== portfolioId));
		}
	};

	const isAllSelected =
		selectedPortfolios.length === portfolios.length && portfolios.length > 0;
	const isPartiallySelected =
		selectedPortfolios.length > 0 &&
		selectedPortfolios.length < portfolios.length;

	if (isLoading || assetsLoading) {
		return <PortfolioListSkeleton viewMode={viewMode} />;
	}
	if (assetsError) {
		return <div className="text-destructive">Error loading assets</div>;
	}

	return (
		<div
			className={cn("space-y-4", className, "w-full max-w-full")}
			role="region"
			aria-label="Portfolio selection and list"
		>
			{/* Controls Header */}
			<div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 w-full">
				{/* Selection Controls */}
				<div className="flex items-center space-x-2 md:space-x-4 w-full">
					{portfolios.length > 0 && (
						<div className="flex items-center space-x-2">
							<Checkbox
								checked={isAllSelected}
								ref={(el) => {
									if (el && "indeterminate" in el)
										(el as HTMLInputElement).indeterminate =
											isPartiallySelected;
								}}
								onCheckedChange={handleSelectAll}
								aria-label={
									isAllSelected
										? "Deselect all portfolios"
										: "Select all portfolios"
								}
							/>
							<span className="text-sm text-muted-foreground">
								{selectedPortfolios.length > 0
									? `${selectedPortfolios.length} selected`
									: "Select all"}
							</span>
						</div>
					)}

					{selectedPortfolios.length > 0 && (
						<Badge variant="secondary">
							{selectedPortfolios.length} portfolio
							{selectedPortfolios.length !== 1 ? "s" : ""} selected
						</Badge>
					)}
				</div>

				{/* View and Sort Controls */}
				<div className="flex items-center space-x-2 md:space-x-4 w-full justify-end">
					{/* Sort Selection */}
					<Select
						value={sortBy}
						onValueChange={(value: SortBy) => onSortChange(value)}
					>
						<SelectTrigger className="w-full md:w-[180px]">
							<SortAsc className="mr-2 h-4 w-4" />
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="name">Name</SelectItem>
							<SelectItem value="value">Total Value</SelectItem>
							<SelectItem value="performance">Performance</SelectItem>
							<SelectItem value="created">Date Created</SelectItem>
						</SelectContent>
					</Select>

					{/* View Mode Toggle */}
					<Tabs
						value={viewMode}
						onValueChange={(value) => onViewModeChange(value as ViewMode)}
					>
						<TabsList className="grid w-full grid-cols-2 md:w-auto">
							<TabsTrigger value="grid" className="flex items-center">
								<Grid3X3 className="mr-2 h-4 w-4" />
								Grid
							</TabsTrigger>
							<TabsTrigger value="list" className="flex items-center">
								<List className="mr-2 h-4 w-4" />
								List
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</div>

			{/* Portfolio Grid/List */}
			{/* Mobile drag-and-drop hint */}
			<div className="md:hidden text-xs text-muted-foreground mb-2 px-2">
				Tap and hold a card to reorder portfolios
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setDraggedPortfolio(null)}
			>
				<SortableContext
					items={orderedPortfolios.map((p) => p.id)}
					strategy={
						viewMode === "grid"
							? rectSortingStrategy
							: verticalListSortingStrategy
					}
				>
					<ul
						className={cn(
							"gap-4 w-full",
							viewMode === "grid"
								? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
								: "flex flex-col space-y-2",
						)}
						aria-label="Portfolios"
					>
						{orderedPortfolios.map((portfolio) => (
							<SortablePortfolioCard
								key={portfolio.id}
								portfolio={portfolio}
								viewMode={viewMode}
								isSelected={selectedPortfolios.includes(portfolio.id)}
								onSelect={(selected) =>
									handlePortfolioSelect(portfolio.id, selected)
								}
								onAction={onPortfolioAction}
								isDragging={draggedPortfolio === portfolio.id}
								assets={assets}
							/>
						))}
					</ul>
				</SortableContext>

				<DragOverlay>
					{draggedPortfolio ? (
						<ul className="list-none">
							<PortfolioCard
								portfolio={
									orderedPortfolios.find((p) => p.id === draggedPortfolio) ??
									orderedPortfolios[0]
								}
								viewMode={viewMode}
								isSelected={false}
								onSelect={() => {}}
								onAction={() => {}}
								isDragging={true}
							/>
						</ul>
					) : null}
				</DragOverlay>
			</DndContext>

			{/* Bulk Actions */}
			{selectedPortfolios.length > 0 && (
				<div className="flex items-center justify-between p-4 bg-muted rounded-lg">
					<span className="text-sm font-medium">
						{selectedPortfolios.length} portfolio
						{selectedPortfolios.length !== 1 ? "s" : ""} selected
					</span>
					<div className="flex items-center space-x-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								// TODO: Implement bulk export
								console.log("Bulk export:", selectedPortfolios);
							}}
						>
							Export Selected
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								// TODO: Implement bulk delete
								console.log("Bulk delete:", selectedPortfolios);
							}}
						>
							Delete Selected
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => onSelectionChange([])}
						>
							Clear Selection
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

// Loading skeleton for portfolio list
function PortfolioListSkeleton({ viewMode }: { viewMode: ViewMode }) {
	const skeletonCount = 8;
	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<div className="flex items-center space-x-4">
					<div className="w-4 h-4 bg-muted rounded animate-pulse" />
					<div className="w-20 h-4 bg-muted rounded animate-pulse" />
				</div>
				<div className="flex items-center space-x-4">
					<div className="w-32 h-9 bg-muted rounded animate-pulse" />
					<div className="w-24 h-9 bg-muted rounded animate-pulse" />
				</div>
			</div>
			{/* Portfolio grid skeleton */}
			<div
				className={cn(
					"gap-4",
					viewMode === "grid"
						? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
						: "space-y-4",
				)}
			>
				{Array.from({ length: skeletonCount }).map((_, i) => (
					<div
						key={`portfolio-view-skeleton-${i}`}
						className="bg-muted rounded-lg h-48 animate-pulse"
					/>
				))}
			</div>
		</div>
	);
}
