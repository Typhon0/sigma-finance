import {
	AlertCircle,
	Bell,
	Calendar,
	CheckCircle,
	Clock,
	DollarSign,
	Download,
	Filter,
	History,
	Percent,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { AlertFilterData, AlertHistoryData } from "./types";

interface AlertHistoryProps {
	history: AlertHistoryData[];
	onFilter?: (filters: AlertFilterData) => void;
	onExport?: () => Promise<void>;
	className?: string;
}

export function AlertHistory({ history, onFilter, onExport, className }: AlertHistoryProps) {
	const [searchTerm, setSearchTerm] = useState("");
	const [filterType, setFilterType] = useState<string>("all");
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [isExporting, setIsExporting] = useState(false);

	// Filter history based on search and filters
	const filteredHistory = history.filter((item) => {
		const matchesSearch =
			!searchTerm ||
			item.alertName.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.assetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.portfolioName?.toLowerCase().includes(searchTerm.toLowerCase());

		const matchesType = filterType === "all" || item.alertType === filterType;

		const matchesStatus =
			filterStatus === "all" ||
			(filterStatus === "acknowledged" && item.acknowledgedAt) ||
			(filterStatus === "unacknowledged" && !item.acknowledgedAt);

		const matchesDateRange =
			(!dateRange.from || item.triggeredAt >= dateRange.from) &&
			(!dateRange.to || item.triggeredAt <= dateRange.to);

		return matchesSearch && matchesType && matchesStatus && matchesDateRange;
	});

	// Group history by date
	const groupedHistory = filteredHistory.reduce(
		(groups, item) => {
			const date = item.triggeredAt.toDateString();
			if (!groups[date]) {
				groups[date] = [];
			}
			groups[date].push(item);
			return groups;
		},
		{} as Record<string, AlertHistoryData[]>,
	);

	const handleSearch = (value: string) => {
		setSearchTerm(value);
		applyFilters();
	};

	const handleFilterChange = () => {
		applyFilters();
	};

	const applyFilters = () => {
		if (onFilter) {
			onFilter({
				// biome-ignore lint/suspicious/noExplicitAny: unavoidable
				alertType: filterType !== "all" ? (filterType as any) : undefined,
				triggeredAfter: dateRange.from,
			});
		}
	};

	const handleExport = async () => {
		if (onExport) {
			setIsExporting(true);
			try {
				await onExport();
			} finally {
				setIsExporting(false);
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

	const formatValue = (value: number | undefined, type: string) => {
		if (value === undefined) return "N/A";

		if (type === "PERCENTAGE_CHANGE" || type === "ALLOCATION") {
			return formatPercentage(value / 100);
		}

		return formatCurrency(value);
	};

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	const formatDate = (date: Date) => {
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return "Today";
		} else if (date.toDateString() === yesterday.toDateString()) {
			return "Yesterday";
		} else {
			return date.toLocaleDateString([], {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			});
		}
	};

	if (history.length === 0) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<h3 className="text-lg font-medium text-muted-foreground mb-2">No Alert History</h3>
				<p className="text-sm text-muted-foreground">
					Alert trigger history will appear here once your alerts are activated.
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Filters and Actions */}
			<div className="flex flex-col lg:flex-row gap-4">
				<div className="flex-1 space-y-4 lg:space-y-0 lg:flex lg:gap-4">
					{/* Search */}
					<SearchInput
						placeholder="Search alert history..."
						value={searchTerm}
						onChange={(e) => handleSearch(e.target.value)}
						onClear={() => handleSearch("")}
						containerClassName="flex-1"
					/>

					{/* Type Filter */}
					<Select
						value={filterType}
						onValueChange={(value) => {
							setFilterType(value);
							handleFilterChange();
						}}
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

					{/* Status Filter */}
					<Select
						value={filterStatus}
						onValueChange={(value) => {
							setFilterStatus(value);
							handleFilterChange();
						}}
					>
						<SelectTrigger className="w-[140px]">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="acknowledged">Acknowledged</SelectItem>
							<SelectItem value="unacknowledged">Unacknowledged</SelectItem>
						</SelectContent>
					</Select>

					{/* Date Range Filter */}
					<Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
						<PopoverTrigger asChild>
							<Button variant="outline" className="w-[200px] justify-start text-left font-normal">
								<Calendar className="mr-2 h-4 w-4" />
								{dateRange.from ? (
									dateRange.to ? (
										<>
											{dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
										</>
									) : (
										dateRange.from.toLocaleDateString()
									)
								) : (
									<span>Pick a date range</span>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<CalendarComponent
								initialFocus
								mode="range"
								defaultMonth={dateRange.from}
								selected={{ from: dateRange.from, to: dateRange.to }}
								onSelect={(range) => {
									setDateRange({ from: range?.from, to: range?.to });
									handleFilterChange();
								}}
								numberOfMonths={2}
							/>
						</PopoverContent>
					</Popover>
				</div>

				{/* Export Button */}
				{onExport && (
					<Button variant="outline" onClick={handleExport} disabled={isExporting} className="gap-2">
						<Download className="h-4 w-4" />
						{isExporting ? "Exporting..." : "Export"}
					</Button>
				)}
			</div>

			{/* History Summary */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Total Triggers</p>
								<div className="text-2xl font-bold">{filteredHistory.length}</div>
							</div>
							<History className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Acknowledged</p>
								<div className="text-2xl font-bold">
									{filteredHistory.filter((h) => h.acknowledgedAt).length}
								</div>
							</div>
							<CheckCircle className="h-4 w-4 text-green-500" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">Pending</p>
								<div className="text-2xl font-bold">
									{filteredHistory.filter((h) => !h.acknowledgedAt).length}
								</div>
							</div>
							<AlertCircle className="h-4 w-4 text-orange-500" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">This Week</p>
								<div className="text-2xl font-bold">
									{
										filteredHistory.filter((h) => {
											const weekAgo = new Date();
											weekAgo.setDate(weekAgo.getDate() - 7);
											return h.triggeredAt >= weekAgo;
										}).length
									}
								</div>
							</div>
							<Calendar className="h-4 w-4 text-muted-foreground" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* History Timeline */}
			<div className="space-y-6">
				{Object.entries(groupedHistory)
					.sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
					.map(([date, items]) => (
						<div key={date} className="space-y-3">
							<div className="flex items-center gap-3">
								<h3 className="text-lg font-medium">{formatDate(new Date(date))}</h3>
								<Badge variant="outline">
									{items.length} trigger{items.length !== 1 ? "s" : ""}
								</Badge>
							</div>

							<div className="space-y-3 pl-4 border-l-2 border-muted">
								{items
									.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
									.map((item) => (
										<Card key={item.id} className="ml-4">
											<CardContent className="p-4">
												<div className="flex items-start justify-between">
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-3 mb-2">
															{getAlertTypeIcon(item.alertType)}
															<Badge variant="outline">{getAlertTypeLabel(item.alertType)}</Badge>
															<div className="flex items-center gap-1 text-sm text-muted-foreground">
																<Clock className="h-3 w-3" />
																{formatTime(item.triggeredAt)}
															</div>
															{item.acknowledgedAt ? (
																<Badge variant="secondary" className="text-green-600">
																	<CheckCircle className="h-3 w-3 mr-1" />
																	Acknowledged
																</Badge>
															) : (
																<Badge variant="secondary" className="text-orange-600">
																	<AlertCircle className="h-3 w-3 mr-1" />
																	Pending
																</Badge>
															)}
														</div>

														<div className="space-y-2">
															<h4 className="font-medium">{item.alertName}</h4>
															<p className="text-sm text-muted-foreground">{item.message}</p>

															<div className="flex items-center gap-4 text-sm text-muted-foreground">
																{item.assetName && <span>Asset: {item.assetName}</span>}
																{item.portfolioName && <span>Portfolio: {item.portfolioName}</span>}
															</div>

															{(item.currentValue !== undefined ||
																item.thresholdValue !== undefined) && (
																<div className="flex items-center gap-4 text-sm">
																	{item.currentValue !== undefined && (
																		<span>
																			Current:{" "}
																			<span className="font-medium">
																				{formatValue(item.currentValue, item.alertType)}
																			</span>
																		</span>
																	)}
																	{item.thresholdValue !== undefined && (
																		<span>
																			Threshold:{" "}
																			<span className="font-medium">
																				{formatValue(item.thresholdValue, item.alertType)}
																			</span>
																		</span>
																	)}
																</div>
															)}

															{item.acknowledgedAt && (
																<div className="text-xs text-muted-foreground">
																	Acknowledged on {item.acknowledgedAt.toLocaleString()}
																</div>
															)}
														</div>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
							</div>
						</div>
					))}
			</div>

			{filteredHistory.length === 0 && history.length > 0 && (
				<div className="text-center py-8">
					<Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h3 className="text-lg font-medium text-muted-foreground mb-2">No Matching History</h3>
					<p className="text-sm text-muted-foreground">
						Try adjusting your search or filter criteria.
					</p>
				</div>
			)}
		</div>
	);
}
