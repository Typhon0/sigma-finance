import type React from "react";
import { useState } from "react";
import ChartContainer from "@/components/charts/ChartContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const ChartDemo: React.FC = () => {
	const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT:CRYPTO");
	const [selectedAssetType, setSelectedAssetType] = useState("CRYPTO");

	const cryptoSymbols = [
		{ symbol: "BTC/USDT:CRYPTO", name: "Bitcoin", type: "CRYPTO" },
		{ symbol: "ETH/USDT:CRYPTO", name: "Ethereum", type: "CRYPTO" },
		{ symbol: "BNB/USDT:CRYPTO", name: "Binance Coin", type: "CRYPTO" },
		{ symbol: "ADA/USDT:CRYPTO", name: "Cardano", type: "CRYPTO" },
		{ symbol: "SOL/USDT:CRYPTO", name: "Solana", type: "CRYPTO" },
	];

	const stockSymbols = [
		{ symbol: "AAPL:STOCK", name: "Apple Inc.", type: "STOCK" },
		{ symbol: "MSFT:STOCK", name: "Microsoft", type: "STOCK" },
		{ symbol: "GOOGL:STOCK", name: "Alphabet", type: "STOCK" },
		{ symbol: "AMZN:STOCK", name: "Amazon", type: "STOCK" },
		{ symbol: "TSLA:STOCK", name: "Tesla", type: "STOCK" },
	];

	const allSymbols = [...cryptoSymbols, ...stockSymbols];

	const handleSymbolChange = (value: string) => {
		const symbol = allSymbols.find((s) => s.symbol === value);
		if (symbol) {
			setSelectedSymbol(symbol.symbol);
			setSelectedAssetType(symbol.type);
		}
	};

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-bold">TradingView Chart Demo</h1>
			</div>

			{/* Controls */}
			<Card>
				<CardHeader>
					<CardTitle>Chart Controls</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center space-x-4">
						<div className="flex-1">
							<label className="text-sm font-medium mb-2 block">Select Symbol</label>
							<Select value={selectedSymbol} onValueChange={handleSymbolChange}>
								<SelectTrigger>
									<SelectValue placeholder="Choose a symbol" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="BTC" disabled>
										Cryptocurrencies
									</SelectItem>
									{cryptoSymbols.map((symbol) => (
										<SelectItem key={symbol.symbol} value={symbol.symbol}>
											{symbol.name} ({symbol.symbol.split(":")[0]})
										</SelectItem>
									))}
									<SelectItem value="stock" disabled>
										Stocks
									</SelectItem>
									{stockSymbols.map((symbol) => (
										<SelectItem key={symbol.symbol} value={symbol.symbol}>
											{symbol.name} ({symbol.symbol.split(":")[0]})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-sm font-medium mb-2 block">Asset Type</label>
							<div className="px-3 py-2 bg-gray-100 rounded-md text-sm">{selectedAssetType}</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ChartContainer
					symbol={selectedSymbol}
					assetType={selectedAssetType}
					title={`${selectedSymbol.split(":")[0]} Lightweight Charts`}
					height="500px"
					useLightweightCharts={true}
					fallbackToSimpleChart={false}
				/>
				<ChartContainer
					symbol={selectedSymbol}
					assetType={selectedAssetType}
					title={`${selectedSymbol.split(":")[0]} ECharts Fallback`}
					height="500px"
					useLightweightCharts={false}
					fallbackToSimpleChart={true}
				/>
			</div>

			{/* Info */}
			<Card>
				<CardHeader>
					<CardTitle>Setup Information</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<h4 className="font-semibold text-blue-900 mb-2">TradingView Library Required</h4>
						<p className="text-blue-800 text-sm mb-3">
							To see live charts, you need to install the TradingView Charting Library.
						</p>
						<div className="space-y-2 text-sm text-blue-700">
							<p>1. Download the library from TradingView's GitHub repository</p>
							<p>
								2. Extract to{" "}
								<code className="bg-blue-100 px-1 rounded">client/public/charting_library/</code>
							</p>
							<p>3. Refresh this page to see the interactive charts</p>
						</div>
					</div>

					<div className="bg-green-50 border border-green-200 rounded-lg p-4">
						<h4 className="font-semibold text-green-900 mb-2">Market Data Integration</h4>
						<p className="text-green-800 text-sm">
							The charts are connected to our market data service with support for:
						</p>
						<ul className="list-disc list-inside text-sm text-green-700 mt-2 space-y-1">
							<li>Real-time price updates</li>
							<li>Historical candle data</li>
							<li>Multiple data providers (Binance, Finnhub, etc.)</li>
							<li>Intelligent caching and gap detection</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default ChartDemo;
