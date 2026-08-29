import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";
import { StocksDistributionWidget } from "../assets/stocks-funds/StocksDistributionWidget";

// Mock echarts-for-react
vi.mock("echarts-for-react", () => ({
	default: () => <div data-testid="echarts-distribution">ECharts Distribution</div>,
}));

const mockAssets: StockAsset[] = [
	{
		id: "1",
		portfolioId: "p1",
		symbol: "GOOGL",
		name: "Alphabet Inc.",
		type: "stock",
		quantity: 10,
		avgCost: 150,
		currentPrice: 200,
		totalValue: 2000,
		totalReturn: 500,
		totalReturnPercentage: 33.3,
		dayChangePercentage: 1.5,
		account: "Trading",
		sector: "Technology",
		currency: "USD",
		portfolioWeight: 50,
		sparklineData: [190, 195, 200],
	},
	{
		id: "2",
		portfolioId: "p1",
		symbol: "NVDA",
		name: "NVIDIA Corp.",
		type: "stock",
		quantity: 5,
		avgCost: 200,
		currentPrice: 240,
		totalValue: 1200,
		totalReturn: 200,
		totalReturnPercentage: 20,
		dayChangePercentage: 2.1,
		account: "Trading",
		sector: "Technology",
		currency: "USD",
		portfolioWeight: 30,
		sparklineData: [230, 235, 240],
	},
	{
		id: "3",
		portfolioId: "p1",
		symbol: "SPY",
		name: "SPDR S&P 500 ETF",
		type: "fund",
		quantity: 2,
		avgCost: 380,
		currentPrice: 400,
		totalValue: 800,
		totalReturn: 40,
		totalReturnPercentage: 5.2,
		dayChangePercentage: 0.4,
		account: "Retirement",
		sector: "Index Fund",
		currency: "USD",
		portfolioWeight: 20,
		sparklineData: [395, 398, 400],
	},
];

const mockSectorValueMap = new Map<string, number>([
	["Technology", 3200],
	["Index Fund", 800],
]);

const mockFormatCurrency = (val: number) => `$${val.toLocaleString()}`;

describe("StocksDistributionWidget", () => {
	it("renders empty state when no assets or zero total value", () => {
		render(
			<StocksDistributionWidget
				assets={[]}
				totalValue={0}
				sectorValueMap={new Map()}
				formatCurrency={mockFormatCurrency}
			/>,
		);

		expect(screen.getByText(/No distribution data available/i)).toBeInTheDocument();
	});

	it("renders asset distribution list with calculated percentages", () => {
		render(
			<StocksDistributionWidget
				assets={mockAssets}
				totalValue={4000}
				sectorValueMap={mockSectorValueMap}
				formatCurrency={mockFormatCurrency}
			/>,
		);

		// Total value is 4000:
		// GOOGL: 2000 / 4000 = 50.0%
		// NVDA: 1200 / 4000 = 30.0%
		// SPY: 800 / 4000 = 20.0%
		expect(screen.getByText("GOOGL")).toBeInTheDocument();
		expect(screen.getByText("50.0%")).toBeInTheDocument();
		expect(screen.getByText("NVDA")).toBeInTheDocument();
		expect(screen.getByText("30.0%")).toBeInTheDocument();
		expect(screen.getByText("SPY")).toBeInTheDocument();
		expect(screen.getByText("20.0%")).toBeInTheDocument();

		// Check allocation title
		expect(screen.getByText(/Allocation/i)).toBeInTheDocument();
		expect(screen.getByText(/Total Value/i)).toBeInTheDocument();
		expect(screen.getByText("$4,000")).toBeInTheDocument();
	});

	it("switches to Treemap and Ranked Bars views", () => {
		render(
			<StocksDistributionWidget
				assets={mockAssets}
				totalValue={4000}
				sectorValueMap={mockSectorValueMap}
				formatCurrency={mockFormatCurrency}
			/>,
		);

		// Switch to Treemap
		const treemapBtn = screen.getByTitle("Treemap Grid");
		fireEvent.click(treemapBtn);
		expect(screen.getByTestId("echarts-distribution")).toBeInTheDocument();

		// Switch to Ranked Bars
		const barsBtn = screen.getByTitle("Ranked List Breakdown");
		fireEvent.click(barsBtn);
		expect(screen.getByText("#1")).toBeInTheDocument();
		expect(screen.getByText("#2")).toBeInTheDocument();
		expect(screen.getByText("#3")).toBeInTheDocument();
	});

	it("triggers onSetFilter and onSelectAsset when an item is clicked", () => {
		const handleSetFilter = vi.fn();
		const handleSelectAsset = vi.fn();

		render(
			<StocksDistributionWidget
				assets={mockAssets}
				totalValue={4000}
				sectorValueMap={mockSectorValueMap}
				formatCurrency={mockFormatCurrency}
				onSetFilter={handleSetFilter}
				onSelectAsset={handleSelectAsset}
			/>,
		);

		const googlButton = screen.getByRole("button", { name: /GOOGL/i });
		fireEvent.click(googlButton);

		expect(handleSetFilter).toHaveBeenCalledWith({
			mode: "asset",
			value: "GOOGL",
			label: "GOOGL",
		});
		expect(handleSelectAsset).toHaveBeenCalledWith("GOOGL");
	});

	it("displays active filter state and allows reset", () => {
		const handleSetFilter = vi.fn();

		render(
			<StocksDistributionWidget
				assets={mockAssets}
				totalValue={4000}
				sectorValueMap={mockSectorValueMap}
				formatCurrency={mockFormatCurrency}
				activeFilter={{ mode: "asset", value: "GOOGL", label: "GOOGL" }}
				onSetFilter={handleSetFilter}
			/>,
		);

		expect(screen.getByText(/Filtered: GOOGL/i)).toBeInTheDocument();
		const resetBtn = screen.getByRole("button", { name: /Reset/i });
		fireEvent.click(resetBtn);

		expect(handleSetFilter).toHaveBeenCalledWith(null);
	});

	it("calculates concentration and shows balance indicator", () => {
		render(
			<StocksDistributionWidget
				assets={mockAssets}
				totalValue={4000}
				sectorValueMap={mockSectorValueMap}
				formatCurrency={mockFormatCurrency}
			/>,
		);

		// Top 3 = 50% + 30% + 20% = 100%
		expect(screen.getByText(/Top 3 Concentration:/i)).toBeInTheDocument();
		expect(screen.getByText("100.0%")).toBeInTheDocument();
		expect(screen.getByText(/Concentrated/i)).toBeInTheDocument();
	});
});
