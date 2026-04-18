import {
	Bell,
	Eye,
	EyeOff,
	MoreHorizontal,
	Plus,
	Search,
	ShoppingCart,
	Trash2,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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

export function WatchlistManagement() {
	const { watchlist, removeFromWatchlist, addToWatchlist, addAsset } =
		usePortfolio();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedType, setSelectedType] = useState("all");
	const [isAddItemOpen, setIsAddItemOpen] = useState(false);
	const [newItem, setNewItem] = useState({
		symbol: "",
		name: "",
		type: "stock",
		currentPrice: "",
		targetPrice: "",
	});

	const filteredWatchlist = watchlist.filter((item) => {
		const matchesSearch =
			item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesType = selectedType === "all" || item.type === selectedType;
		return matchesSearch && matchesType;
	});

	const handleAddItem = () => {
		if (!newItem.symbol || !newItem.name || !newItem.currentPrice) {
			alert("Please fill in all required fields");
			return;
		}

		const price = parseFloat(newItem.currentPrice);
		const item = {
			...newItem,
			currentPrice: price,
			targetPrice: newItem.targetPrice ? parseFloat(newItem.targetPrice) : null,
			change: 0, // Real change data requires market API
			changePercent: 0,
		};

		addToWatchlist(item);
		setNewItem({
			symbol: "",
			name: "",
			type: "stock",
			currentPrice: "",
			targetPrice: "",
		});
		setIsAddItemOpen(false);
	};

	const handleAddToPortfolio = (item) => {
		// Convert watchlist item to asset
		const asset = {
			type: item.type,
			symbol: item.symbol,
			name: item.name,
			quantity: 1,
			currentPrice: item.currentPrice,
			purchasePrice: item.currentPrice,
			purchaseDate: new Date().toISOString().split("T")[0],
		};

		addAsset(asset);
		// Optionally remove from watchlist
		removeFromWatchlist(item.id);
	};

	const getTypeLabel = (type) => {
		const labels = {
			stock: "Stock",
			crypto: "Crypto",
			etf: "ETF",
			forex: "Forex",
		};
		return labels[type] || type;
	};

	const getTypeBadgeVariant = (type) => {
		const variants = {
			stock: "default",
			crypto: "secondary",
			etf: "outline",
			forex: "destructive",
		};
		return variants[type] || "secondary";
	};

	// Mock watchlist stats
	const totalItems = watchlist.length;
	const gainers = watchlist.filter(
		(item) => (item.changePercent || 0) > 0,
	).length;
	const losers = watchlist.filter(
		(item) => (item.changePercent || 0) < 0,
	).length;
	const avgChange =
		watchlist.length > 0
			? watchlist.reduce((sum, item) => sum + (item.changePercent || 0), 0) /
				watchlist.length
			: 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-mono">Watchlist</h1>
					<p className="text-muted-foreground">
						Monitor assets you're interested in
					</p>
				</div>
				<Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="h-4 w-4 mr-2" />
							Add to Watchlist
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Add to Watchlist</DialogTitle>
							<DialogDescription>Add a new asset to monitor</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="item-type">Asset Type *</Label>
								<Select
									value={newItem.type}
									onValueChange={(value) =>
										setNewItem({ ...newItem, type: value })
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="stock">Stock</SelectItem>
										<SelectItem value="crypto">Cryptocurrency</SelectItem>
										<SelectItem value="etf">ETF</SelectItem>
										<SelectItem value="forex">Forex</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="symbol">Symbol *</Label>
									<Input
										id="symbol"
										value={newItem.symbol}
										onChange={(e) =>
											setNewItem({
												...newItem,
												symbol: e.target.value.toUpperCase(),
											})
										}
										placeholder="AAPL"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="name">Name *</Label>
									<Input
										id="name"
										value={newItem.name}
										onChange={(e) =>
											setNewItem({ ...newItem, name: e.target.value })
										}
										placeholder="Apple Inc."
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="current-price">Current Price *</Label>
									<Input
										id="current-price"
										type="number"
										step="0.01"
										value={newItem.currentPrice}
										onChange={(e) =>
											setNewItem({ ...newItem, currentPrice: e.target.value })
										}
										placeholder="185.50"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="target-price">Target Price</Label>
									<Input
										id="target-price"
										type="number"
										step="0.01"
										value={newItem.targetPrice}
										onChange={(e) =>
											setNewItem({ ...newItem, targetPrice: e.target.value })
										}
										placeholder="200.00"
									/>
								</div>
							</div>
						</div>

						<DialogFooter>
							<Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleAddItem}>Add to Watchlist</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			{/* Summary Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Total Watching</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono">{totalItems}</div>
						<p className="text-xs text-muted-foreground">Assets tracked</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Gainers</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-green-600">{gainers}</div>
						<p className="text-xs text-muted-foreground">Positive movement</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Losers</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-mono text-red-600">{losers}</div>
						<p className="text-xs text-muted-foreground">Negative movement</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm">Avg Change</CardTitle>
					</CardHeader>
					<CardContent>
						<div
							className={`text-2xl font-mono ${avgChange >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{avgChange >= 0 ? "+" : ""}
							{avgChange.toFixed(2)}%
						</div>
						<p className="text-xs text-muted-foreground">Overall trend</p>
					</CardContent>
				</Card>
			</div>

			{/* Filters and Search */}
			<Card>
				<CardHeader>
					<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
						<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
							<div className="relative">
								<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Search watchlist..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="pl-10 w-64"
								/>
							</div>

							<Select value={selectedType} onValueChange={setSelectedType}>
								<SelectTrigger className="w-40">
									<Eye className="h-4 w-4 mr-2" />
									<SelectValue placeholder="All types" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Types</SelectItem>
									<SelectItem value="stock">Stocks</SelectItem>
									<SelectItem value="crypto">Crypto</SelectItem>
									<SelectItem value="etf">ETFs</SelectItem>
									<SelectItem value="forex">Forex</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{filteredWatchlist.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Asset</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Current Price</TableHead>
									<TableHead>Change</TableHead>
									<TableHead>% Change</TableHead>
									<TableHead>Target Price</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredWatchlist.map((item) => {
									const change = item.change || 0;
									const changePercent = item.changePercent || 0;
									const isNearTarget =
										item.targetPrice &&
										Math.abs(item.currentPrice - item.targetPrice) /
											item.targetPrice <
											0.05;

									return (
										<TableRow key={item.id}>
											<TableCell>
												<div className="space-y-1">
													<div className="font-medium">{item.symbol}</div>
													<div className="text-sm text-muted-foreground">
														{item.name}
													</div>
												</div>
											</TableCell>
											<TableCell>
												<Badge variant={getTypeBadgeVariant(item.type)}>
													{getTypeLabel(item.type)}
												</Badge>
											</TableCell>
											<TableCell className="font-mono">
												${item.currentPrice.toLocaleString()}
											</TableCell>
											<TableCell>
												<div
													className={`font-mono ${change >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{change >= 0 ? "+" : ""}${Math.abs(change).toFixed(2)}
												</div>
											</TableCell>
											<TableCell>
												<div
													className={`flex items-center ${changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{changePercent >= 0 ? (
														<TrendingUp className="h-4 w-4 mr-1" />
													) : (
														<TrendingDown className="h-4 w-4 mr-1" />
													)}
													{Math.abs(changePercent).toFixed(2)}%
												</div>
											</TableCell>
											<TableCell>
												{item.targetPrice ? (
													<div className="space-y-1">
														<div className="font-mono">
															${item.targetPrice.toLocaleString()}
														</div>
														{isNearTarget && (
															<Badge variant="secondary" className="text-xs">
																<Bell className="h-3 w-3 mr-1" />
																Near Target
															</Badge>
														)}
													</div>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</TableCell>
											<TableCell className="text-right">
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon">
															<MoreHorizontal className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuItem
															onClick={() => handleAddToPortfolio(item)}
														>
															<ShoppingCart className="h-4 w-4 mr-2" />
															Add to Portfolio
														</DropdownMenuItem>
														<DropdownMenuItem>
															<Bell className="h-4 w-4 mr-2" />
															Set Alert
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => removeFromWatchlist(item.id)}
															className="text-red-600"
														>
															<Trash2 className="h-4 w-4 mr-2" />
															Remove
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					) : (
						<div className="text-center py-12">
							<div className="text-muted-foreground">
								{searchTerm || selectedType !== "all" ? (
									<p>No items found matching your filters.</p>
								) : (
									<div className="space-y-2">
										<EyeOff className="h-12 w-12 mx-auto text-muted-foreground/50" />
										<p>Your watchlist is empty.</p>
										<p className="text-sm">Add assets you want to monitor.</p>
										<Button onClick={() => setIsAddItemOpen(true)}>
											<Plus className="h-4 w-4 mr-2" />
											Add Your First Item
										</Button>
									</div>
								)}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
