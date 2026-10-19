import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Asset as StockAsset } from "@/components/stocks-funds/types";
import { StocksDistributionWidget } from "../assets/stocks-funds/StocksDistributionWidget";

/**
 * F-19: neither the allocation widget nor the insight cockpit had a loading
 * state. Both render "not enough data" copy while the portfolio fetch is still
 * in flight, which reads as a real, permanent result and then snaps to content.
 */

vi.mock("echarts-for-react", () => ({
	default: () => <div data-testid="echarts-distribution">ECharts Distribution</div>,
}));

const assets: StockAsset[] = [
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
];

const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

function renderWidget(loading: boolean) {
	return render(
		<StocksDistributionWidget
			assets={loading ? [] : assets}
			totalValue={loading ? 0 : 2000}
			sectorValueMap={new Map([["Technology", 2000]])}
			formatCurrency={formatCurrency}
			loading={loading}
		/>,
	);
}

describe("StocksDistributionWidget loading state (F-19)", () => {
	it("shows a busy placeholder while loading", () => {
		renderWidget(true);

		expect(screen.getByText("Loading portfolio allocation…")).toBeInTheDocument();
		expect(document.querySelector("[aria-busy='true']")).toBeTruthy();
	});

	it("does not claim there is no data while loading", () => {
		renderWidget(true);
		expect(screen.queryByText("No distribution data available")).not.toBeInTheDocument();
	});

	it("still shows the empty state once loading has finished with no data", () => {
		render(
			<StocksDistributionWidget
				assets={[]}
				totalValue={0}
				sectorValueMap={new Map()}
				formatCurrency={formatCurrency}
				loading={false}
			/>,
		);
		expect(screen.getByText("No distribution data available")).toBeInTheDocument();
		expect(screen.queryByText("Loading portfolio allocation…")).not.toBeInTheDocument();
	});

	it("renders the chart once loaded", () => {
		render(
			<StocksDistributionWidget
				assets={assets}
				totalValue={2000}
				sectorValueMap={new Map([["Technology", 2000]])}
				formatCurrency={formatCurrency}
				loading={false}
			/>,
		);
		expect(screen.getByTestId("echarts-distribution")).toBeInTheDocument();
	});
});
