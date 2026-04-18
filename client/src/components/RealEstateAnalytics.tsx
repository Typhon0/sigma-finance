import ReactECharts from "echarts-for-react";
import {
	AlertTriangle,
	Award,
	BarChart3,
	Calendar,
	LayoutGrid,
	MapPin,
	PieChart as PieChartIcon,
	Target,
} from "lucide-react";
import { useMemo, useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface RealEstateAnalyticsProps {
	onSelectProperty?: (propertyId: string) => void;
}

type TimeRange = "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";
type ChartType = "simple" | "stacked";
type AllocationView = "pie" | "treemap";
type AllocationBy = "type" | "location" | "category";

const COLORS = [
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#f59e0b",
	"#10b981",
	"#06b6d4",
	"#6366f1",
	"#84cc16",
];

export function RealEstateAnalytics({
	onSelectProperty,
}: RealEstateAnalyticsProps) {
	const { assets } = usePortfolio();
	const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
	const [chartType, setChartType] = useState<ChartType>("simple");
	const [allocationView, setAllocationView] = useState<AllocationView>("pie");
	const [allocationBy, setAllocationBy] = useState<AllocationBy>("type");

	const realEstateAssets = assets.filter(
		(asset) => asset.type === "real_estate",
	);

	// Generate mock historical data for value over time
	const generateHistoricalData = () => {
		let months: number;
		if (timeRange === "1M") months = 1;
		else if (timeRange === "3M") months = 3;
		else if (timeRange === "6M") months = 6;
		else if (timeRange === "1Y") months = 12;
		else if (timeRange === "YTD")
			months = new Date().getMonth() + 1; // Months since start of year
		else months = 24; // ALL

		const data = [];

		for (let i = months; i >= 0; i--) {
			const date = new Date();
			date.setMonth(date.getMonth() - i);

			const entry: any = {
				date: date.toLocaleDateString("en-US", {
					month: "short",
					year: "numeric",
				}),
				total: 0,
			};

			realEstateAssets.forEach((property) => {
				const currentValue = property.currentValue || 0;
				const purchasePrice = property.purchasePrice || currentValue;
				// Simulate gradual appreciation
				const progress = (months - i) / months;
				const value = purchasePrice + (currentValue - purchasePrice) * progress;
				entry[property.id] = Math.round(value);
				entry.total += Math.round(value);
			});

			data.push(entry);
		}

		return data;
	};

	const historicalData = useMemo(
		() => generateHistoricalData(),
		[timeRange, realEstateAssets.length],
	);

	// Calculate performance metrics
	const performanceData = useMemo(() => {
		return realEstateAssets
			.map((property) => {
				const currentValue = property.currentValue || 0;
				const purchasePrice = property.purchasePrice || 0;
				const gain = currentValue - purchasePrice;
				const gainPercent =
					purchasePrice > 0 ? (gain / purchasePrice) * 100 : 0;

				// Calculate annualized return
				const purchaseDate = new Date(property.purchaseDate || Date.now());
				const yearsHeld = Math.max(
					0.1,
					(Date.now() - purchaseDate.getTime()) /
						(365.25 * 24 * 60 * 60 * 1000),
				);
				const annualizedReturn =
					((currentValue / purchasePrice) ** (1 / yearsHeld) - 1) * 100;

				return {
					id: property.id,
					name: property.name,
					currentValue,
					purchasePrice,
					gain,
					gainPercent,
					annualizedReturn,
					yearsHeld,
					city: property.city,
				};
			})
			.sort((a, b) => b.gainPercent - a.gainPercent);
	}, [realEstateAssets]);

	// Calculate allocation data
	const allocationData = useMemo(() => {
		const groups: { [key: string]: number } = {};

		realEstateAssets.forEach((property) => {
			let key = "";
			switch (allocationBy) {
				case "type":
					key = property.propertyType || "Unknown";
					break;
				case "location":
					key = property.city || "Unknown";
					break;
				case "category":
					key = property.category || "Other";
					break;
			}

			groups[key] = (groups[key] || 0) + (property.currentValue || 0);
		});

		return Object.entries(groups).map(([name, value]) => ({
			name,
			value,
			percentage:
				(value /
					realEstateAssets.reduce((sum, p) => sum + (p.currentValue || 0), 0)) *
				100,
		}));
	}, [realEstateAssets, allocationBy]);

	// Portfolio totals
	const totalValue = realEstateAssets.reduce(
		(sum, p) => sum + (p.currentValue || 0),
		0,
	);
	const totalInvested = realEstateAssets.reduce(
		(sum, p) => sum + (p.purchasePrice || 0),
		0,
	);
	const totalGain = totalValue - totalInvested;
	const _totalGainPercent =
		totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

	const topPerformer = performanceData[0];
	const worstPerformer = performanceData[performanceData.length - 1];

	// ECharts Options for Value Over Time
	const getValueOverTimeOption = () => {
		const isDark = document.documentElement.classList.contains("dark");
		const textColor = isDark ? "#e6edf3" : "#37352f";
		const gridColor = isDark ? "#30363d" : "#e9e9e7";

		if (chartType === "simple") {
			return {
				tooltip: {
					trigger: "axis",
					backgroundColor: isDark ? "#161b22" : "#ffffff",
					borderColor: gridColor,
					textStyle: { color: textColor },
					formatter: (params: any) => {
						const data = params[0];
						return `
              <div style="padding: 4px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
                <div style="font-family: monospace;">€${data.value.toLocaleString()}</div>
              </div>
            `;
					},
				},
				grid: {
					left: "3%",
					right: "4%",
					bottom: "3%",
					top: "10%",
					containLabel: true,
				},
				xAxis: {
					type: "category",
					boundaryGap: false,
					data: historicalData.map((d) => d.date),
					axisLine: { lineStyle: { color: gridColor } },
					axisLabel: { color: textColor },
				},
				yAxis: {
					type: "value",
					axisLine: { lineStyle: { color: gridColor } },
					axisLabel: {
						color: textColor,
						formatter: (value: number) => `€${(value / 1000).toFixed(0)}k`,
					},
					splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
				},
				series: [
					{
						name: "Total Value",
						type: "line",
						smooth: true,
						symbol: "circle",
						symbolSize: 6,
						data: historicalData.map((d) => d.total),
						areaStyle: {
							color: {
								type: "linear",
								x: 0,
								y: 0,
								x2: 0,
								y2: 1,
								colorStops: [
									{ offset: 0, color: "rgba(59, 130, 246, 0.3)" },
									{ offset: 1, color: "rgba(59, 130, 246, 0)" },
								],
							},
						},
						lineStyle: { color: "#3b82f6", width: 2 },
						itemStyle: { color: "#3b82f6" },
					},
				],
			};
		} else {
			// Stacked view
			return {
				tooltip: {
					trigger: "axis",
					backgroundColor: isDark ? "#161b22" : "#ffffff",
					borderColor: gridColor,
					textStyle: { color: textColor },
					axisPointer: { type: "cross" },
				},
				legend: {
					data: realEstateAssets.map((p) => p.name),
					textStyle: { color: textColor },
					top: 0,
				},
				grid: {
					left: "3%",
					right: "4%",
					bottom: "3%",
					top: "15%",
					containLabel: true,
				},
				xAxis: {
					type: "category",
					boundaryGap: false,
					data: historicalData.map((d) => d.date),
					axisLine: { lineStyle: { color: gridColor } },
					axisLabel: { color: textColor },
				},
				yAxis: {
					type: "value",
					axisLine: { lineStyle: { color: gridColor } },
					axisLabel: {
						color: textColor,
						formatter: (value: number) => `€${(value / 1000).toFixed(0)}k`,
					},
					splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
				},
				series: realEstateAssets.map((property, index) => ({
					name: property.name,
					type: "line",
					stack: "Total",
					smooth: true,
					data: historicalData.map((d) => d[property.id] || 0),
					areaStyle: { opacity: 0.6 },
					lineStyle: { color: COLORS[index % COLORS.length], width: 2 },
					itemStyle: { color: COLORS[index % COLORS.length] },
				})),
			};
		}
	};

	// ECharts Options for Performance Distribution
	const getPerformanceDistributionOption = () => {
		const isDark = document.documentElement.classList.contains("dark");
		const textColor = isDark ? "#e6edf3" : "#37352f";
		const gridColor = isDark ? "#30363d" : "#e9e9e7";

		return {
			tooltip: {
				trigger: "axis",
				backgroundColor: isDark ? "#161b22" : "#ffffff",
				borderColor: gridColor,
				textStyle: { color: textColor },
				axisPointer: { type: "shadow" },
				formatter: (params: any) => {
					const data = params[0];
					return `
            <div style="padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
              <div style="font-family: monospace; color: ${data.value >= 0 ? "#10b981" : "#ef4444"};">
                ${data.value >= 0 ? "+" : ""}${data.value.toFixed(1)}%
              </div>
            </div>
          `;
				},
			},
			grid: {
				left: "3%",
				right: "4%",
				bottom: "15%",
				top: "10%",
				containLabel: true,
			},
			xAxis: {
				type: "category",
				data: performanceData.map((p) => p.name),
				axisLine: { lineStyle: { color: gridColor } },
				axisLabel: {
					color: textColor,
					rotate: 45,
					interval: 0,
				},
			},
			yAxis: {
				type: "value",
				axisLine: { lineStyle: { color: gridColor } },
				axisLabel: {
					color: textColor,
					formatter: (value: number) => `${value}%`,
				},
				splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
			},
			series: [
				{
					name: "Return",
					type: "bar",
					data: performanceData.map((p) => ({
						value: p.gainPercent,
						itemStyle: {
							color: p.gainPercent >= 0 ? "#10b981" : "#ef4444",
						},
					})),
					barWidth: "60%",
				},
			],
		};
	};

	// ECharts Options for Pie Chart
	const getPieChartOption = () => {
		const isDark = document.documentElement.classList.contains("dark");
		const textColor = isDark ? "#e6edf3" : "#37352f";

		return {
			tooltip: {
				trigger: "item",
				backgroundColor: isDark ? "#161b22" : "#ffffff",
				borderColor: isDark ? "#30363d" : "#e9e9e7",
				textStyle: { color: textColor },
				formatter: (params: any) => {
					return `
            <div style="padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
              <div style="font-family: monospace;">€${params.value.toLocaleString()}</div>
              <div style="color: #888;">${params.percent}%</div>
            </div>
          `;
				},
			},
			legend: {
				orient: "vertical",
				left: "left",
				textStyle: { color: textColor },
			},
			series: [
				{
					name: "Allocation",
					type: "pie",
					radius: ["40%", "70%"],
					avoidLabelOverlap: true,
					itemStyle: {
						borderRadius: 8,
						borderColor: isDark ? "#0d1117" : "#ffffff",
						borderWidth: 2,
					},
					label: {
						show: true,
						formatter: "{b}: {d}%",
						color: textColor,
					},
					emphasis: {
						label: {
							show: true,
							fontSize: 16,
							fontWeight: "bold",
						},
					},
					data: allocationData.map((item, index) => ({
						name: item.name,
						value: item.value,
						itemStyle: { color: COLORS[index % COLORS.length] },
					})),
				},
			],
		};
	};

	// ECharts Options for Treemap
	const getTreemapOption = () => {
		const isDark = document.documentElement.classList.contains("dark");
		const textColor = isDark ? "#e6edf3" : "#37352f";

		return {
			tooltip: {
				trigger: "item",
				backgroundColor: isDark ? "#161b22" : "#ffffff",
				borderColor: isDark ? "#30363d" : "#e9e9e7",
				textStyle: { color: textColor },
				formatter: (params: any) => {
					return `
            <div style="padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${params.name}</div>
              <div style="font-family: monospace;">€${params.value.toLocaleString()}</div>
              <div style="color: #888;">${params.data.percentage.toFixed(1)}%</div>
            </div>
          `;
				},
			},
			series: [
				{
					name: "Allocation",
					type: "treemap",
					width: "100%",
					height: "100%",
					roam: false,
					nodeClick: false,
					breadcrumb: { show: false },
					label: {
						show: true,
						formatter: (params: any) => {
							return `{name|${params.name}}\n{value|€${(params.value / 1000).toFixed(0)}k}\n{percent|${params.data.percentage.toFixed(1)}%}`;
						},
						rich: {
							name: {
								fontSize: 14,
								fontWeight: "bold",
								color: "#ffffff",
							},
							value: {
								fontSize: 12,
								fontFamily: "monospace",
								color: "#ffffff",
							},
							percent: {
								fontSize: 11,
								color: "rgba(255,255,255,0.7)",
							},
						},
					},
					itemStyle: {
						borderColor: isDark ? "#0d1117" : "#ffffff",
						borderWidth: 2,
						gapWidth: 2,
					},
					data: allocationData.map((item, index) => ({
						name: item.name,
						value: item.value,
						percentage: item.percentage,
						itemStyle: { color: COLORS[index % COLORS.length] },
					})),
				},
			],
		};
	};

	// ECharts Options for Geographic Distribution
	const getGeographicDistributionOption = () => {
		const isDark = document.documentElement.classList.contains("dark");
		const textColor = isDark ? "#e6edf3" : "#37352f";
		const gridColor = isDark ? "#30363d" : "#e9e9e7";

		const locationData =
			allocationBy === "location"
				? allocationData
				: (() => {
						const groups: { [key: string]: number } = {};
						realEstateAssets.forEach((property) => {
							const key = property.city || "Unknown";
							groups[key] = (groups[key] || 0) + (property.currentValue || 0);
						});
						return Object.entries(groups).map(([name, value]) => ({
							name,
							value,
						}));
					})();

		return {
			tooltip: {
				trigger: "axis",
				backgroundColor: isDark ? "#161b22" : "#ffffff",
				borderColor: gridColor,
				textStyle: { color: textColor },
				axisPointer: { type: "shadow" },
				formatter: (params: any) => {
					const data = params[0];
					return `
            <div style="padding: 4px;">
              <div style="font-weight: 600; margin-bottom: 4px;">${data.name}</div>
              <div style="font-family: monospace;">€${data.value.toLocaleString()}</div>
            </div>
          `;
				},
			},
			grid: {
				left: "20%",
				right: "4%",
				bottom: "3%",
				top: "5%",
				containLabel: true,
			},
			xAxis: {
				type: "value",
				axisLine: { lineStyle: { color: gridColor } },
				axisLabel: {
					color: textColor,
					formatter: (value: number) => `€${(value / 1000).toFixed(0)}k`,
				},
				splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
			},
			yAxis: {
				type: "category",
				data: locationData.map((d) => d.name),
				axisLine: { lineStyle: { color: gridColor } },
				axisLabel: { color: textColor },
			},
			series: [
				{
					name: "Value",
					type: "bar",
					data: locationData.map((d, index) => ({
						value: d.value,
						itemStyle: { color: COLORS[index % COLORS.length] },
					})),
					barWidth: "60%",
				},
			],
		};
	};

	// Diversification metrics
	const uniqueTypes = new Set(realEstateAssets.map((p) => p.propertyType)).size;
	const uniqueLocations = new Set(realEstateAssets.map((p) => p.city)).size;
	const avgPropertyValue =
		realEstateAssets.length > 0 ? totalValue / realEstateAssets.length : 0;
	const geoScore =
		realEstateAssets.length > 0
			? (uniqueLocations / realEstateAssets.length) * 100
			: 0;
	const typeScore =
		realEstateAssets.length > 0
			? (uniqueTypes / realEstateAssets.length) * 100
			: 0;

	if (realEstateAssets.length === 0) {
		return (
			<Card>
				<CardContent className="pt-6">
					<div className="text-center py-12">
						<BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
						<h3 className="font-medium mb-2">No Real Estate Data</h3>
						<p className="text-sm text-muted-foreground">
							Add properties to see analytics and insights
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Total Value</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-mono">€{totalValue.toLocaleString()}</div>
						<p className="text-xs text-muted-foreground mt-1">
							{realEstateAssets.length} properties
						</p>
						<div className="mt-2">
							<div
								className={`text-sm ${totalGain >= 0 ? "text-green-600" : "text-red-600"}`}
							>
								{totalGain >= 0 ? "+" : ""}€
								{Math.abs(totalGain).toLocaleString()}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Properties</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-mono">{realEstateAssets.length}</div>
						<p className="text-xs text-muted-foreground mt-1">
							Avg: €{Math.round(avgPropertyValue).toLocaleString()}
						</p>
						<div className="mt-2 text-sm text-muted-foreground">
							{uniqueTypes} types, {uniqueLocations} locations
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center gap-2">
							<Award className="h-4 w-4 text-green-600" />
							<CardTitle className="text-sm font-medium">
								Best Performer
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{topPerformer ? (
							<>
								<div className="font-mono text-green-600">
									+{topPerformer.annualizedReturn.toFixed(1)}%
								</div>
								<p className="text-xs text-muted-foreground mt-1 truncate">
									{topPerformer.name}
								</p>
								<p className="text-xs text-muted-foreground">Annual return</p>
							</>
						) : (
							<p className="text-sm text-muted-foreground">N/A</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-red-600" />
							<CardTitle className="text-sm font-medium">
								Worst Performer
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{worstPerformer ? (
							<>
								<div
									className={`font-mono ${worstPerformer.gainPercent >= 0 ? "text-green-600" : "text-red-600"}`}
								>
									{worstPerformer.gainPercent >= 0 ? "+" : ""}
									{worstPerformer.gainPercent.toFixed(1)}%
								</div>
								<p className="text-xs text-muted-foreground mt-1 truncate">
									{worstPerformer.name}
								</p>
								<p className="text-xs text-muted-foreground">Total return</p>
							</>
						) : (
							<p className="text-sm text-muted-foreground">N/A</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Analytics Tabs */}
			<Tabs defaultValue="value" className="space-y-4">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="value">
						<Calendar className="h-4 w-4 mr-2" />
						Value Over Time
					</TabsTrigger>
					<TabsTrigger value="performance">
						<Target className="h-4 w-4 mr-2" />
						Performance
					</TabsTrigger>
					<TabsTrigger value="allocation">
						<PieChartIcon className="h-4 w-4 mr-2" />
						Allocation
					</TabsTrigger>
				</TabsList>

				{/* Value Over Time Tab */}
				<TabsContent value="value" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Portfolio Value Over Time</CardTitle>
									<CardDescription>
										Track your real estate portfolio growth
									</CardDescription>
								</div>
								<div className="flex items-center gap-4">
									{/* Time Range Selector */}
									<div className="flex gap-1 border rounded-lg p-1">
										{(
											["1M", "3M", "6M", "1Y", "YTD", "ALL"] as TimeRange[]
										).map((range) => (
											<Button
												key={range}
												variant={timeRange === range ? "default" : "ghost"}
												size="sm"
												onClick={() => setTimeRange(range)}
												className="h-7 px-3"
											>
												{range}
											</Button>
										))}
									</div>

									{/* Chart Type Toggle */}
									<div className="flex gap-1 border rounded-lg p-1">
										<Button
											variant={chartType === "simple" ? "default" : "ghost"}
											size="sm"
											onClick={() => setChartType("simple")}
											className="h-7 px-3"
										>
											Total
										</Button>
										<Button
											variant={chartType === "stacked" ? "default" : "ghost"}
											size="sm"
											onClick={() => setChartType("stacked")}
											className="h-7 px-3"
										>
											Stacked
										</Button>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={getValueOverTimeOption()}
								style={{ height: "400px", width: "100%" }}
								notMerge={true}
								lazyUpdate={true}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Performance Tab */}
				<TabsContent value="performance" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle>Property Performance</CardTitle>
							<CardDescription>
								Detailed performance metrics for each property
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Property</TableHead>
										<TableHead className="text-right">Current Value</TableHead>
										<TableHead className="text-right">Purchase Price</TableHead>
										<TableHead className="text-right">Gain/Loss</TableHead>
										<TableHead className="text-right">Return %</TableHead>
										<TableHead className="text-right">Annual Return</TableHead>
										<TableHead className="text-right">Years Held</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{performanceData.map((property) => (
										<TableRow
											key={property.id}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() => onSelectProperty?.(property.id)}
										>
											<TableCell>
												<div className="font-medium">{property.name}</div>
												<div className="flex items-center text-xs text-muted-foreground">
													<MapPin className="h-3 w-3 mr-1" />
													{property.city}
												</div>
											</TableCell>
											<TableCell className="text-right font-mono">
												€{property.currentValue.toLocaleString()}
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground">
												€{property.purchasePrice.toLocaleString()}
											</TableCell>
											<TableCell className="text-right">
												<div
													className={`font-mono ${property.gain >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{property.gain >= 0 ? "+" : ""}€
													{Math.abs(property.gain).toLocaleString()}
												</div>
											</TableCell>
											<TableCell className="text-right">
												<Badge
													variant={
														property.gainPercent >= 0
															? "default"
															: "destructive"
													}
													className={
														property.gainPercent >= 0 ? "bg-green-600" : ""
													}
												>
													{property.gainPercent >= 0 ? "+" : ""}
													{property.gainPercent.toFixed(1)}%
												</Badge>
											</TableCell>
											<TableCell className="text-right font-mono">
												{property.annualizedReturn.toFixed(1)}%
											</TableCell>
											<TableCell className="text-right text-muted-foreground">
												{property.yearsHeld.toFixed(1)}y
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					{/* Return Distribution Chart */}
					<Card>
						<CardHeader>
							<CardTitle>Return Distribution</CardTitle>
							<CardDescription>
								Performance comparison across properties
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={getPerformanceDistributionOption()}
								style={{ height: "300px", width: "100%" }}
								notMerge={true}
								lazyUpdate={true}
							/>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Allocation Tab */}
				<TabsContent value="allocation" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Portfolio Allocation</CardTitle>
									<CardDescription>
										Visualize your portfolio distribution
									</CardDescription>
								</div>
								<div className="flex items-center gap-4">
									{/* Allocation By Selector */}
									<Select
										value={allocationBy}
										onValueChange={(v) => setAllocationBy(v as AllocationBy)}
									>
										<SelectTrigger className="w-[140px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="type">By Type</SelectItem>
											<SelectItem value="location">By Location</SelectItem>
											<SelectItem value="category">By Category</SelectItem>
										</SelectContent>
									</Select>

									{/* View Toggle */}
									<div className="flex gap-1 border rounded-lg p-1">
										<Button
											variant={allocationView === "pie" ? "default" : "ghost"}
											size="sm"
											onClick={() => setAllocationView("pie")}
											className="h-7 px-3"
										>
											<PieChartIcon className="h-4 w-4 mr-1" />
											Pie
										</Button>
										<Button
											variant={
												allocationView === "treemap" ? "default" : "ghost"
											}
											size="sm"
											onClick={() => setAllocationView("treemap")}
											className="h-7 px-3"
										>
											<LayoutGrid className="h-4 w-4 mr-1" />
											Treemap
										</Button>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={
									allocationView === "pie"
										? getPieChartOption()
										: getTreemapOption()
								}
								style={{ height: "400px", width: "100%" }}
								notMerge={true}
								lazyUpdate={true}
							/>
						</CardContent>
					</Card>

					{/* Allocation Breakdown */}
					<Card>
						<CardHeader>
							<CardTitle>Allocation Breakdown</CardTitle>
							<CardDescription>
								Detailed distribution by {allocationBy}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{allocationData.map((item, index) => (
									<div key={item.name} className="space-y-2">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<div
													className="w-3 h-3 rounded-full"
													style={{
														backgroundColor: COLORS[index % COLORS.length],
													}}
												/>
												<span className="font-medium">{item.name}</span>
											</div>
											<div className="text-right">
												<div className="font-mono">
													€{item.value.toLocaleString()}
												</div>
												<div className="text-xs text-muted-foreground">
													{item.percentage.toFixed(1)}%
												</div>
											</div>
										</div>
										<Progress value={item.percentage} className="h-2" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>

					{/* Geographic Distribution */}
					<Card>
						<CardHeader>
							<CardTitle>Geographic Distribution</CardTitle>
							<CardDescription>Value distribution by location</CardDescription>
						</CardHeader>
						<CardContent>
							<ReactECharts
								option={getGeographicDistributionOption()}
								style={{ height: "300px", width: "100%" }}
								notMerge={true}
								lazyUpdate={true}
							/>
						</CardContent>
					</Card>

					{/* Portfolio Diversification */}
					<Card>
						<CardHeader>
							<CardTitle>Portfolio Diversification</CardTitle>
							<CardDescription>Measure your portfolio spread</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm">Geographic Diversification</span>
										<span className="text-sm font-medium">
											{geoScore.toFixed(0)}%
										</span>
									</div>
									<Progress value={Math.min(geoScore, 100)} className="h-2" />
									<p className="text-xs text-muted-foreground">
										{uniqueLocations} unique locations across{" "}
										{realEstateAssets.length} properties
									</p>
								</div>

								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-sm">Type Diversification</span>
										<span className="text-sm font-medium">
											{typeScore.toFixed(0)}%
										</span>
									</div>
									<Progress value={Math.min(typeScore, 100)} className="h-2" />
									<p className="text-xs text-muted-foreground">
										{uniqueTypes} property types in portfolio
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
