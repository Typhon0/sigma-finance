import {
	Bell,
	DollarSign,
	Edit,
	Filter,
	MoreHorizontal,
	Percent,
	Power,
	PowerOff,
	Trash2,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { Alert, AlertFilterData, AlertFormData } from "./types";

interface AlertListProps {
	alerts: Alert[];
	onEdit?: (alert: Alert) => void;
	onDelete?: (id: string) => Promise<void>;
	onToggleActive?: (id: string, data: AlertFormData) => Promise<void>;
	onFilter?: (filters: AlertFilterData) => void;
	showFilters?: boolean;
	className?: string;
}

export function AlertList({
	alerts,
	onEdit,
	onDelete,
	onToggleActive,
	onFilter,
	showFilters = true,
	className,
}: AlertListProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterType, setFilterType] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Filter alerts based on search and filters
	const filteredAlerts = alerts.filter((alert) => {
		const matchesSearch =
			!searchTerm ||
			alert.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			alert.asset?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			alert.portfolio?.name.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesType = filterType === "all" || alert.alertType === filterType;
		const matchesStatus =
			filterStatus === "all" ||
			(filterStatus === "active" && alert.isActive) ||
			(filterStatus === "inactive" && !alert.isActive);

		return matchesSearch && matchesType && matchesStatus;
	});

	const handleSearch = (value: string) => {
		setSearchTerm(value);
		if (onFilter) {
			onFilter({
				alertType: filterType !== "all" ? (filterType as any) : undefined,
				isActive: filterStatus !== "all" ? filterStatus === "active" : undefined,
			});
		}
	};

	const handleFilterChange = (type: string, status: string) => {
		setFilterType(type);
		setFilterStatus(status);
		if (onFilter) {
			onFilter({
				alertType: type !== "all" ? (type as any) : undefined,
				isActive: status !== "all" ? status === "active" : undefined,
			});
		}
	};

	const handleToggleActive = async (alert: Alert) => {
		if (onToggleActive) {
			const updatedData: AlertFormData = {
				id: alert.id,
				alertType: alert.alertType,
				conditionType: alert.conditionType,
				assetId: alert.assetId,
				portfolioId: alert.portfolioId,
				thresholdValue: alert.thresholdValue,
				thresholdPercentage: alert.thresholdPercentage,
				notificationMethods: alert.notificationMethods,
				isActive: !alert.isActive,
				name: alert.name,
				description: alert.description,
			};
			await onToggleActive(alert.id, updatedData);
		}
	};

	const handleDelete = async (id: string) => {
		if (onDelete) {
			setDeletingId(id);
			try {
				await onDelete(id);
			} finally {
				setDeletingId(null);
			}
		}
	};

	const getAlertTypeIcon = (type: string) => {
		switch (type) {
			case "PRICE":
				return <DollarSign className="h-4 w-4" />;
			case "PERCENTAGE_CHANGE":
				return <Percent className="h-4 w-4" />;
			case "PORTFOLIO_VALUE":
				return <TrendingUp className="h-4 w-4" />;
			case "ALLOCATION":
				return <TrendingDown className="h-4 w-4" />;
			default:
				return <Bell className="h-4 w-4" />;
		}
	};

	const getAlertTypeLabel = (type: string) => {
		switch (type) {
			case "PRICE":
				return "Price";
			case "PERCENTAGE_CHANGE":
				return "Percentage";
			case "PORTFOLIO_VALUE":
				return "Portfolio";
			case "ALLOCATION":
				return "Allocation";
			default:
				return type;
		}
	};

	const getConditionLabel = (condition: string) => {
		switch (condition) {
			case "ABOVE":
				return "Above";
			case "BELOW":
				return "Below";
			case "INCREASE_BY":
				return "Increase by";
			case "DECREASE_BY":
				return "Decrease by";
			default:
				return condition;
		}
	};

	const formatThreshold = (alert: Alert) => {
		if (alert.thresholdValue !== undefined) {
			return formatCurrency(alert.thresholdValue);
		}
		if (alert.thresholdPercentage !== undefined) {
			return formatPercentage(alert.thresholdPercentage / 100);
		}
		return "N/A";
	};

	const getTargetName = (alert: Alert) => {
		if (alert.asset) {
			return alert.asset.symbol || alert.asset.name;
		}
		if (alert.portfolio) {
			return alert.portfolio.name;
		}
		return "Unknown";
	};

	if (alerts.length === 0) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<h3 className="text-lg font-medium text-muted-foreground mb-2">No Alerts Found</h3>
				<p className="text-sm text-muted-foreground">
					Create your first alert to get notified about important changes.
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-4 ${className}`}>
			{/* Filters */}
			{showFilters && (
				<div className="flex flex-col sm:flex-row gap-4">
					<SearchInput
						placeholder="Search alerts..."
						value={searchTerm}
						onChange={(e) => handleSearch(e.target.value)}
						onClear={() => handleSearch("")}
						containerClassName="flex-1"
					/>

					<div className="flex gap-2">
						<Select
							value={filterType}
							onValueChange={(value) => handleFilterChange(value, filterStatus)}
						>
							<SelectTrigger className="w-[140px]">
								<SelectValue placeholder="Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Types</SelectItem>
								<SelectItem value="PRICE">Price</SelectItem>
								<SelectItem value="PERCENTAGE_CHANGE">Percentage</SelectItem>
								<SelectItem value="PORTFOLIO_VALUE">Portfolio</SelectItem>
								<SelectItem value="ALLOCATION">Allocation</SelectItem>
							</SelectContent>
						</Select>

						<Select
							value={filterStatus}
							onValueChange={(value) => handleFilterChange(filterType, value)}
						>
							<SelectTrigger className="w-[120px]">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}

			{/* Alert List */}
			<div className="space-y-3">
				{filteredAlerts.map((alert) => (
					<Card
						key={alert.id}
						className={`transition-colors ${!alert.isActive ? "opacity-60" : ""}`}
					>
						<CardContent className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3 mb-2">
										<div className="flex items-center gap-2">
											{getAlertTypeIcon(alert.alertType)}
											<Badge variant={alert.isActive ? "default" : "secondary"}>
												{getAlertTypeLabel(alert.alertType)}
											</Badge>
										</div>

										<div className="flex items-center gap-1 text-sm text-muted-foreground">
											{alert.conditionType === "ABOVE" || alert.conditionType === "INCREASE_BY" ? (
												<TrendingUp className="h-3 w-3" />
											) : (
												<TrendingDown className="h-3 w-3" />
											)}
											<span>{getConditionLabel(alert.conditionType)}</span>
										</div>

										{alert.isActive ? (
											<Badge variant="outline" className="text-green-600 border-green-600">
												<Power className="h-3 w-3 mr-1" />
												Active
											</Badge>
										) : (
											<Badge variant="outline" className="text-gray-500 border-gray-500">
												<PowerOff className="h-3 w-3 mr-1" />
												Inactive
											</Badge>
										)}
									</div>

									<div className="space-y-1">
										<h4 className="font-medium truncate">{alert.name}</h4>
										<div className="flex items-center gap-4 text-sm text-muted-foreground">
											<span>Target: {getTargetName(alert)}</span>
											<span>Threshold: {formatThreshold(alert)}</span>
											{alert.triggerCount > 0 && <span>Triggered: {alert.triggerCount} times</span>}
										</div>
										{alert.description && (
											<p className="text-sm text-muted-foreground truncate">{alert.description}</p>
										)}
									</div>

									<div className="flex items-center gap-2 mt-2">
										{alert.notificationMethods.map((method) => (
											<Badge key={method} variant="outline" className="text-xs">
												{method}
											</Badge>
										))}
									</div>
								</div>

								<div className="flex items-center gap-2 ml-4">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant="ghost" size="sm">
												<MoreHorizontal className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											{onEdit && (
												<DropdownMenuItem onClick={() => onEdit(alert)}>
													<Edit className="h-4 w-4 mr-2" />
													Edit
												</DropdownMenuItem>
											)}

											{onToggleActive && (
												<DropdownMenuItem onClick={() => handleToggleActive(alert)}>
													{alert.isActive ? (
														<>
															<PowerOff className="h-4 w-4 mr-2" />
															Deactivate
														</>
													) : (
														<>
															<Power className="h-4 w-4 mr-2" />
															Activate
														</>
													)}
												</DropdownMenuItem>
											)}

											{onDelete && (
												<>
													<DropdownMenuSeparator />
													<AlertDialog>
														<AlertDialogTrigger asChild>
															<DropdownMenuItem
																className="text-destructive focus:text-destructive"
																onSelect={(e) => e.preventDefault()}
															>
																<Trash2 className="h-4 w-4 mr-2" />
																Delete
															</DropdownMenuItem>
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>Delete Alert</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete "{alert.name}
																	"? This action cannot be undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() => handleDelete(alert.id)}
																	disabled={deletingId === alert.id}
																	className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																>
																	{deletingId === alert.id ? "Deleting..." : "Delete"}
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{filteredAlerts.length === 0 && alerts.length > 0 && (
				<div className="text-center py-8">
					<Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h3 className="text-lg font-medium text-muted-foreground mb-2">No Matching Alerts</h3>
					<p className="text-sm text-muted-foreground">
						Try adjusting your search or filter criteria.
					</p>
				</div>
			)}
		</div>
	);
}
