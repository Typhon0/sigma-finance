import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AssetHeroChart, buildPerformanceSeries, SignedDelta } from "../charts/AssetHeroChart";
import type { PerformancePoint, PortfolioHeroChartProps } from "../charts/PortfolioHeroChart";

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", () => ({
	motion: {
		div: ({
			children,
			layoutId: _l,
			...props
		}: ComponentPropsWithoutRef<"div"> & { layoutId?: string }) => <div {...props}>{children}</div>,
		span: ({
			children,
			layoutId: _l,
			...props
		}: ComponentPropsWithoutRef<"span"> & { layoutId?: string }) => (
			<span {...props}>{children}</span>
		),
	},
	useReducedMotion: () => false,
}));

// Mock the inner PortfolioHeroChart canvas
vi.mock("../charts/PortfolioHeroChart", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../charts/PortfolioHeroChart")>();
	return {
		...actual,
		PortfolioHeroChart: ({
			data,
			totalEquity,
			timeRange,
			benchmarkMode,
		}: PortfolioHeroChartProps) => (
			<div data-testid="portfolio-hero-chart-canvas">
				Canvas points: {data.length}, Equity: {totalEquity}, Range: {timeRange}, Bench:{" "}
				{benchmarkMode}
			</div>
		),
	};
});

describe("buildPerformanceSeries", () => {
	it("returns a single anchor point when input history is empty", () => {
		const series = buildPerformanceSeries([], 5000);
		expect(series.length).toBe(1);
		expect(series[0].portfolioValue).toBe(5000);
		expect(series[0].benchmarkValue).toBe(5000);
		expect(series[0].date).toBeInstanceOf(Date);
	});

	it("sorts history points chronologically and maps valid points", () => {
		const history = [
			{ date: "2024-03-01T00:00:00Z", value: 300 },
			{ date: "2024-01-01T00:00:00Z", value: 100 },
			{ date: "2024-02-01T00:00:00Z", value: 200 },
		];

		const series = buildPerformanceSeries(history, 300);
		expect(series.length).toBe(3);
		expect(series[0].portfolioValue).toBe(100);
		expect(series[1].portfolioValue).toBe(200);
		expect(series[2].portfolioValue).toBe(300);
	});

	it("filters out invalid dates", () => {
		const history = [
			{ date: "invalid-date", value: 50 },
			{ date: "2024-01-01T00:00:00Z", value: 100 },
		];

		const series = buildPerformanceSeries(history, 100);
		expect(series.length).toBe(1);
		expect(series[0].portfolioValue).toBe(100);
	});
});

describe("SignedDelta", () => {
	it("renders positive delta in text-gain", () => {
		render(
			<SignedDelta
				value={150.5}
				percent={3.25}
				label="1M"
				title="One month change"
				formatCurrency={(v) => `$${v.toFixed(2)}`}
			/>,
		);

		const el = screen.getByTitle("One month change");
		expect(el).toHaveClass("text-gain");
		expect(screen.getByText("+$150.50 (+3.25%)")).toBeInTheDocument();
		expect(screen.getByText("1M")).toBeInTheDocument();
	});

	it("renders negative delta in text-loss", () => {
		render(
			<SignedDelta
				value={-42}
				percent={-1.5}
				label="1D"
				title="One day change"
				formatCurrency={(v) => `$${v.toFixed(2)}`}
			/>,
		);

		const el = screen.getByTitle("One day change");
		expect(el).toHaveClass("text-loss");
		expect(screen.getByText("-$42.00 (-1.50%)")).toBeInTheDocument();
		expect(screen.getByText("1D")).toBeInTheDocument();
	});

	it("renders negative delta in text-gain when variant is liability (debt reduction)", () => {
		render(
			<SignedDelta
				value={-35372}
				percent={-17.52}
				label="ALL"
				title="Debt amortized"
				formatCurrency={(v) => `€${v.toLocaleString()}`}
				variant="liability"
			/>,
		);

		const el = screen.getByTitle("Debt amortized");
		expect(el).toHaveClass("text-gain");
		expect(screen.getByText("-€35,372 (-17.52%)")).toBeInTheDocument();
		expect(screen.getByText("ALL · AMORTIZED")).toBeInTheDocument();
	});

	it("renders positive delta in text-loss when variant is liability (new borrowing)", () => {
		render(
			<SignedDelta
				value={5000}
				percent={2.5}
				label="1M"
				title="New debt"
				formatCurrency={(v) => `€${v.toLocaleString()}`}
				variant="liability"
			/>,
		);

		const el = screen.getByTitle("New debt");
		expect(el).toHaveClass("text-loss");
		expect(screen.getByText("+€5,000 (+2.50%)")).toBeInTheDocument();
		expect(screen.getByText("1M")).toBeInTheDocument();
	});
});

describe("AssetHeroChart", () => {
	const mockData: PerformancePoint[] = [
		{
			date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
			portfolioValue: 1000,
			benchmarkValue: 1000,
		},
		{
			date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
			portfolioValue: 1100,
			benchmarkValue: 1050,
		},
		{ date: new Date(), portfolioValue: 1250, benchmarkValue: 1100 },
	];

	it("renders title, formatted equity, and inner chart canvas", () => {
		render(
			<AssetHeroChart
				title="Crypto Value"
				titleTooltip="Total crypto holdings"
				data={mockData}
				totalEquity={1250}
				formatCurrency={(v) => `$${v.toLocaleString()}`}
				timeRange="1M"
				onTimeRangeChange={vi.fn()}
			/>,
		);

		expect(screen.getByText("Crypto Value")).toBeInTheDocument();
		expect(screen.getByText("$1,250")).toBeInTheDocument();
		expect(screen.getByTestId("portfolio-hero-chart-canvas")).toBeInTheDocument();
	});

	it("triggers onTimeRangeChange when a time range button is clicked", () => {
		const onTimeRangeChange = vi.fn();
		render(
			<AssetHeroChart
				title="Stocks & Funds Value"
				data={mockData}
				totalEquity={1250}
				formatCurrency={(v) => `$${v}`}
				timeRange="1M"
				onTimeRangeChange={onTimeRangeChange}
			/>,
		);

		const button7D = screen.getByRole("button", { name: /show 7D performance/i });
		fireEvent.click(button7D);
		expect(onTimeRangeChange).toHaveBeenCalledWith("7D");
	});

	it("displays all-time delta fallback when data has fewer than 2 points and ALL is active", () => {
		render(
			<AssetHeroChart
				title="Crypto Value"
				data={[{ date: new Date(), portfolioValue: 500, benchmarkValue: 500 }]}
				totalEquity={500}
				totalGain={120}
				totalGainPercent={31.5}
				formatCurrency={(v) => `$${v.toFixed(2)}`}
				timeRange="ALL"
				onTimeRangeChange={vi.fn()}
			/>,
		);

		expect(screen.getByText("+$120.00 (+31.50%)")).toBeInTheDocument();
		expect(screen.getByText("All-Time")).toBeInTheDocument();
	});

	it("hides benchmark selector when variant is liability", () => {
		render(
			<AssetHeroChart
				title="Total Debt Outstanding"
				data={mockData}
				totalEquity={166449}
				formatCurrency={(v) => `€${v.toLocaleString()}`}
				timeRange="ALL"
				onTimeRangeChange={vi.fn()}
				variant="liability"
			/>,
		);

		expect(screen.queryByText(/No Benchmark/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/vs S&P 500/i)).not.toBeInTheDocument();
	});

	it("renders liability multi-year time ranges (1Y, 3Y, 5Y, 10Y, ALL) and hides 1D/7D", () => {
		render(
			<AssetHeroChart
				title="Total Debt Outstanding"
				data={mockData}
				totalEquity={166449}
				formatCurrency={(v) => `€${v.toLocaleString()}`}
				timeRange="1Y"
				onTimeRangeChange={vi.fn()}
				variant="liability"
			/>,
		);

		expect(screen.getByRole("button", { name: /Show 1Y performance/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Show 3Y performance/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Show 5Y performance/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Show 10Y performance/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Show ALL performance/i })).toBeInTheDocument();

		expect(screen.queryByRole("button", { name: /Show 1D performance/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Show 7D performance/i })).not.toBeInTheDocument();
	});
});
