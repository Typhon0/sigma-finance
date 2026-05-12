import {
	AlertCircle,
	Briefcase,
	Building2,
	Calendar as CalendarIcon,
	ChevronLeft,
	ChevronRight,
	Clock,
	Filter,
	Globe,
	Star,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface MarketCalendarProps {
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	onFilterStock?: (filters: any) => void;
}

export function MarketCalendar({ onFilterStock }: MarketCalendarProps) {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
	const [selectedCountry, setSelectedCountry] = useState("all");
	const [selectedImportance, setSelectedImportance] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("economic");

	// Mock economic events
	const economicEvents = [
		{
			id: 1,
			date: new Date(2025, 9, 10, 8, 30),
			title: "US CPI (Consumer Price Index)",
			country: "US",
			importance: "high",
			forecast: "3.1%",
			previous: "3.0%",
			actual: null,
			category: "Inflation",
		},
		{
			id: 2,
			date: new Date(2025, 9, 10, 10, 0),
			title: "Eurozone GDP Growth Rate",
			country: "EU",
			importance: "high",
			forecast: "0.3%",
			previous: "0.2%",
			actual: null,
			category: "GDP",
		},
		{
			id: 3,
			date: new Date(2025, 9, 10, 14, 0),
			title: "Fed Interest Rate Decision",
			country: "US",
			importance: "high",
			forecast: "5.50%",
			previous: "5.50%",
			actual: null,
			category: "Interest Rate",
		},
		{
			id: 4,
			date: new Date(2025, 9, 11, 8, 30),
			title: "UK Unemployment Rate",
			country: "UK",
			importance: "medium",
			forecast: "4.2%",
			previous: "4.3%",
			actual: null,
			category: "Employment",
		},
		{
			id: 5,
			date: new Date(2025, 9, 11, 13, 0),
			title: "US Retail Sales",
			country: "US",
			importance: "medium",
			forecast: "0.5%",
			previous: "0.6%",
			actual: null,
			category: "Sales",
		},
		{
			id: 6,
			date: new Date(2025, 9, 12, 2, 0),
			title: "China Industrial Production",
			country: "CN",
			importance: "medium",
			forecast: "5.2%",
			previous: "5.1%",
			actual: null,
			category: "Production",
		},
		{
			id: 7,
			date: new Date(2025, 9, 13, 9, 0),
			title: "Germany ZEW Economic Sentiment",
			country: "DE",
			importance: "low",
			forecast: "12.5",
			previous: "11.8",
			actual: null,
			category: "Sentiment",
		},
	];

	// Mock earnings events
	const earningsEvents = [
		{
			id: 1,
			date: new Date(2025, 9, 10, 16, 30),
			symbol: "AAPL",
			company: "Apple Inc.",
			epsEstimate: "1.39",
			epsPrevious: "1.29",
			revenueEstimate: "89.5B",
			marketCap: "3.0T",
			time: "After Market Close",
		},
		{
			id: 2,
			date: new Date(2025, 9, 10, 7, 0),
			symbol: "JPM",
			company: "JPMorgan Chase",
			epsEstimate: "3.91",
			epsPrevious: "3.74",
			revenueEstimate: "41.2B",
			marketCap: "481B",
			time: "Before Market Open",
		},
		{
			id: 3,
			date: new Date(2025, 9, 11, 16, 30),
			symbol: "MSFT",
			company: "Microsoft Corporation",
			epsEstimate: "2.65",
			epsPrevious: "2.45",
			revenueEstimate: "56.1B",
			marketCap: "2.8T",
			time: "After Market Close",
		},
		{
			id: 4,
			date: new Date(2025, 9, 11, 7, 0),
			symbol: "WFC",
			company: "Wells Fargo",
			epsEstimate: "1.28",
			epsPrevious: "1.23",
			revenueEstimate: "20.5B",
			marketCap: "158B",
			time: "Before Market Open",
		},
		{
			id: 5,
			date: new Date(2025, 9, 12, 16, 30),
			symbol: "TSLA",
			company: "Tesla Inc.",
			epsEstimate: "0.73",
			epsPrevious: "0.66",
			revenueEstimate: "24.8B",
			marketCap: "788B",
			time: "After Market Close",
		},
	];

	// Mock IPO events
	const ipoEvents = [
		{
			id: 1,
			date: new Date(2025, 9, 11),
			symbol: "NEWCO",
			company: "NewCo Technology",
			priceRange: "$18-$20",
			shares: "15M",
			valuation: "$2.5B",
			exchange: "NASDAQ",
		},
		{
			id: 2,
			date: new Date(2025, 9, 13),
			symbol: "BIOP",
			company: "BioPharma Solutions",
			priceRange: "$14-$16",
			shares: "10M",
			valuation: "$1.8B",
			exchange: "NYSE",
		},
	];

	// Mock stock split events
	const splitEvents = [
		{
			id: 1,
			date: new Date(2025, 9, 12),
			symbol: "GOOGL",
			company: "Alphabet Inc.",
			ratio: "20:1",
			type: "Stock Split",
		},
	];

	const getImportanceColor = (importance: string) => {
		switch (importance) {
			case "high":
				return "destructive";
			case "medium":
				return "default";
			case "low":
				return "secondary";
			default:
				return "outline";
		}
	};

	const getCountryFlag = (country: string) => {
		const flags: Record<string, string> = {
			US: "🇺🇸",
			EU: "🇪🇺",
			UK: "🇬🇧",
			CN: "🇨🇳",
			DE: "🇩🇪",
			JP: "🇯🇵",
		};
		return flags[country] || "🌍";
	};

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	};

	const formatDate = (date: Date) => {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const navigateDate = (direction: "prev" | "next") => {
		const newDate = new Date(currentDate);
		if (viewMode === "day") {
			newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
		} else if (viewMode === "week") {
			newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
		} else {
			newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
		}
		setCurrentDate(newDate);
	};

	return (
		<div className="p-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl">Market Calendar</h1>
					<p className="text-muted-foreground mt-1">
						Economic events, earnings, IPOs, and corporate actions
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Badge variant="outline" className="gap-1">
						<Clock className="h-3 w-3" />
						Live Updates
					</Badge>
				</div>
			</div>

			{/* Navigation and Filters */}
			<Card>
				<CardContent className="pt-6">
					<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
						{/* Date Navigation */}
						<div className="flex items-center gap-2">
							<Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<div className="flex items-center gap-2 min-w-[200px] justify-center">
								<CalendarIcon className="h-4 w-4 text-muted-foreground" />
								<span className="font-mono">{formatDate(currentDate)}</span>
							</div>
							<Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
								<ChevronRight className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
								Today
							</Button>
						</div>

						{/* View Mode */}
						<div className="flex items-center gap-2">
							<Button
								variant={viewMode === "day" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("day")}
							>
								Day
							</Button>
							<Button
								variant={viewMode === "week" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("week")}
							>
								Week
							</Button>
							<Button
								variant={viewMode === "month" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("month")}
							>
								Month
							</Button>
						</div>

						{/* Filters */}
						<div className="flex items-center gap-2">
							<Select value={selectedCountry} onValueChange={setSelectedCountry}>
								<SelectTrigger className="w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Countries</SelectItem>
									<SelectItem value="US">🇺🇸 United States</SelectItem>
									<SelectItem value="EU">🇪🇺 Eurozone</SelectItem>
									<SelectItem value="UK">🇬🇧 United Kingdom</SelectItem>
									<SelectItem value="CN">🇨🇳 China</SelectItem>
									<SelectItem value="DE">🇩🇪 Germany</SelectItem>
								</SelectContent>
							</Select>
							<Select value={selectedImportance} onValueChange={setSelectedImportance}>
								<SelectTrigger className="w-36">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Events</SelectItem>
									<SelectItem value="high">High Impact</SelectItem>
									<SelectItem value="medium">Medium Impact</SelectItem>
									<SelectItem value="low">Low Impact</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Search */}
					<SearchInput
						placeholder="Search economic events..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onClear={() => setSearchQuery("")}
						containerClassName="flex-1"
					/>
				</CardContent>
			</Card>

			{/* Calendar Content */}
			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList className="grid w-full grid-cols-4">
					<TabsTrigger value="economic">
						<Globe className="h-4 w-4 mr-2" />
						Economic
					</TabsTrigger>
					<TabsTrigger value="earnings">
						<TrendingUp className="h-4 w-4 mr-2" />
						Earnings
					</TabsTrigger>
					<TabsTrigger value="ipo">
						<Building2 className="h-4 w-4 mr-2" />
						IPOs
					</TabsTrigger>
					<TabsTrigger value="corporate">
						<Briefcase className="h-4 w-4 mr-2" />
						Corporate Actions
					</TabsTrigger>
				</TabsList>

				{/* Economic Events */}
				<TabsContent value="economic" className="space-y-4 mt-6">
					<ScrollArea className="h-[600px]">
						<div className="space-y-3 pr-4">
							{economicEvents.map((event) => (
								<Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow">
									<CardContent className="pt-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-2">
													<span className="text-2xl">{getCountryFlag(event.country)}</span>
													<Badge variant={getImportanceColor(event.importance)}>
														{event.importance.toUpperCase()}
													</Badge>
													<Badge variant="outline">{event.category}</Badge>
													<span className="text-sm text-muted-foreground font-mono">
														{formatTime(event.date)}
													</span>
												</div>
												<h3 className="font-medium mb-3">{event.title}</h3>
												<div className="grid grid-cols-3 gap-4">
													<div>
														<p className="text-xs text-muted-foreground">Forecast</p>
														<p className="font-mono">{event.forecast}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Previous</p>
														<p className="font-mono">{event.previous}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Actual</p>
														<p className="font-mono">{event.actual || "-"}</p>
													</div>
												</div>
											</div>
											<Button variant="ghost" size="icon">
												<Star className="h-4 w-4" />
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>
				</TabsContent>

				{/* Earnings Events */}
				<TabsContent value="earnings" className="space-y-4 mt-6">
					<div className="flex justify-end mb-4">
						<Button
							onClick={() => {
								onFilterStock?.({ hasEarnings: true });
								toast.success("Filtered stocks with earnings in screener");
							}}
						>
							<Filter className="h-4 w-4 mr-2" />
							Filter in Stock Screener
						</Button>
					</div>
					<ScrollArea className="h-[600px]">
						<div className="space-y-3 pr-4">
							{earningsEvents.map((event) => (
								<Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow">
									<CardContent className="pt-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-2">
													<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
														<TrendingUp className="h-5 w-5 text-primary" />
													</div>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-mono">{event.symbol}</span>
															<Badge variant="outline">{event.time}</Badge>
														</div>
														<p className="text-sm text-muted-foreground">{event.company}</p>
													</div>
												</div>
												<div className="grid grid-cols-4 gap-4 mt-4">
													<div>
														<p className="text-xs text-muted-foreground">EPS Estimate</p>
														<p className="font-mono">${event.epsEstimate}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Previous EPS</p>
														<p className="font-mono">${event.epsPrevious}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Revenue Est.</p>
														<p className="font-mono">{event.revenueEstimate}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Market Cap</p>
														<p className="font-mono">${event.marketCap}</p>
													</div>
												</div>
											</div>
											<div className="flex flex-col gap-2">
												<Button variant="ghost" size="icon">
													<Star className="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => toast.info(`Viewing ${event.symbol} details`)}
												>
													<AlertCircle className="h-4 w-4" />
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>
				</TabsContent>

				{/* IPO Events */}
				<TabsContent value="ipo" className="space-y-4 mt-6">
					<ScrollArea className="h-[600px]">
						<div className="space-y-3 pr-4">
							{ipoEvents.map((event) => (
								<Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow">
									<CardContent className="pt-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-2">
													<div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
														<Building2 className="h-5 w-5 text-green-600" />
													</div>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-mono">{event.symbol}</span>
															<Badge variant="outline">{event.exchange}</Badge>
														</div>
														<p className="text-sm text-muted-foreground">{event.company}</p>
													</div>
												</div>
												<div className="grid grid-cols-4 gap-4 mt-4">
													<div>
														<p className="text-xs text-muted-foreground">Price Range</p>
														<p className="font-mono">{event.priceRange}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Shares</p>
														<p className="font-mono">{event.shares}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Valuation</p>
														<p className="font-mono">{event.valuation}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Date</p>
														<p className="font-mono">{formatDate(event.date)}</p>
													</div>
												</div>
											</div>
											<Button variant="ghost" size="icon">
												<Star className="h-4 w-4" />
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>
				</TabsContent>

				{/* Corporate Actions */}
				<TabsContent value="corporate" className="space-y-4 mt-6">
					<ScrollArea className="h-[600px]">
						<div className="space-y-3 pr-4">
							{splitEvents.map((event) => (
								<Card key={event.id} className="cursor-pointer hover:shadow-md transition-shadow">
									<CardContent className="pt-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-2 mb-2">
													<div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
														<Briefcase className="h-5 w-5 text-blue-600" />
													</div>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-mono">{event.symbol}</span>
															<Badge variant="default">{event.type}</Badge>
														</div>
														<p className="text-sm text-muted-foreground">{event.company}</p>
													</div>
												</div>
												<div className="grid grid-cols-3 gap-4 mt-4">
													<div>
														<p className="text-xs text-muted-foreground">Split Ratio</p>
														<p className="font-mono text-lg">{event.ratio}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Effective Date</p>
														<p className="font-mono">{formatDate(event.date)}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">Type</p>
														<p>{event.type}</p>
													</div>
												</div>
											</div>
											<Button variant="ghost" size="icon">
												<Star className="h-4 w-4" />
											</Button>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
}
