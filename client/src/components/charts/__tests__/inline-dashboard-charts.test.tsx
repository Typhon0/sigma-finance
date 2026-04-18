import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetAllocationChart } from "../../dashboard/asset-allocation-chart";
import {
	CompactAllocationChart,
	CompactPerformanceChart,
	MiniAllocationDonut,
	MiniPerformanceSparkline,
} from "../CompactCharts";
import { RealTimeChart } from "../RealTimeChart";

// Mock echarts-for-react to avoid canvas issues in tests
vi.mock("echarts-for-react", () => ({
	default: function MockReactECharts({
		option,
		style,
		onEvents,
		_opts,
	}: {
		option: any;
		style: any;
		onEvents?: any;
		opts?: any;
	}) {
		return (
			<div
				data-testid="mock-chart"
				data-chart-type={option?.series?.[0]?.type || "unknown"}
				data-chart-title={option?.title?.text || ""}
				style={style}
				onClick={() => onEvents?.click?.()}
			>
				{JSON.stringify(option, null, 2)}
			</div>
		);
	},
}));

// Mock lightweight charts
vi.mock("lightweight-charts", () => ({
	createChart: vi.fn(() => ({
		addAreaSeries: vi.fn(() => ({
			setData: vi.fn(),
			applyOptions: vi.fn(),
		})),
		addLineSeries: vi.fn(() => ({
			setData: vi.fn(),
			applyOptions: vi.fn(),
		})),
		timeScale: vi.fn(() => ({
			fitContent: vi.fn(),
			setVisibleRange: vi.fn(),
		})),
		priceScale: vi.fn(() => ({
			applyOptions: vi.fn(),
		})),
		applyOptions: vi.fn(),
		subscribeCrosshairMove: vi.fn(),
		remove: vi.fn(),
		resize: vi.fn(),
	})),
	ColorType: {
		Solid: "solid",
		VerticalGradient: "verticalGradient",
	},
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}));

// Mock data
const mockPerformanceData = [
	{ date: "2024-01-01", value: 10000, time: 1704067200 },
	{ date: "2024-01-02", value: 10250, time: 1704153600 },
	{ date: "2024-01-03", value: 10100, time: 1704240000 },
	{ date: "2024-01-04", value: 10400, time: 1704326400 },
	{ date: "2024-01-05", value: 10650, time: 1704412800 },
	{ date: "2024-01-06", value: 10500, time: 1704499200 },
	{ date: "2024-01-07", value: 10800, time: 1704585600 },
];

const mockAllocationData = [
	{
		name: "Stocks",
		value: 45000,
		percentage: 45,
		assetType: "STOCK",
		color: "#3b82f6",
	},
	{
		name: "Crypto",
		value: 25000,
		percentage: 25,
		assetType: "CRYPTO",
		color: "#f59e0b",
	},
	{
		name: "Bonds",
		value: 20000,
		percentage: 20,
		assetType: "BOND",
		color: "#10b981",
	},
	{
		name: "Cash",
		value: 10000,
		percentage: 10,
		assetType: "BANK_ACCOUNT",
		color: "#6b7280",
	},
];

const mockRealTimeData = [
	{ timestamp: Date.now() - 300000, value: 10500 }, // 5 minutes ago
	{ timestamp: Date.now() - 240000, value: 10520 }, // 4 minutes ago
	{ timestamp: Date.now() - 180000, value: 10480 }, // 3 minutes ago
	{ timestamp: Date.now() - 120000, value: 10550 }, // 2 minutes ago
	{ timestamp: Date.now() - 60000, value: 10580 }, // 1 minute ago
	{ timestamp: Date.now(), value: 10600 }, // now
];

describe("Inline Dashboard Charts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("CompactPerformanceChart", () => {
		it("should render with performance data", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					height={200}
					showControls={false}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
			expect(chart).toHaveAttribute("data-chart-type", "line");
		});

		it("should display current value and change", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					showMetrics={true}
				/>,
			);

			expect(screen.getByText("$10,800.00")).toBeInTheDocument(); // Current value
			expect(screen.getByText("+$800.00")).toBeInTheDocument(); // Change from first to last
			expect(screen.getByText("+8.00%")).toBeInTheDocument(); // Percentage change
		});

		it("should handle empty data gracefully", () => {
			render(<CompactPerformanceChart data={[]} showMetrics={true} />);

			expect(screen.getByText("No performance data")).toBeInTheDocument();
		});

		it("should show loading state", () => {
			render(<CompactPerformanceChart data={[]} loading={true} />);

			expect(screen.getByText("Loading chart...")).toBeInTheDocument();
		});

		it("should handle click events", async () => {
			const mockOnClick = vi.fn();

			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					onClick={mockOnClick}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			fireEvent.click(chart);

			await waitFor(() => {
				expect(mockOnClick).toHaveBeenCalled();
			});
		});

		it("should apply custom styling", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					height={150}
					className="custom-chart"
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toHaveStyle({ height: "150px" });
		});
	});

	describe("CompactAllocationChart", () => {
		it("should render with allocation data", () => {
			render(<CompactAllocationChart data={mockAllocationData} height={200} />);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
			expect(chart).toHaveAttribute("data-chart-type", "pie");
		});

		it("should display allocation percentages", () => {
			render(
				<CompactAllocationChart data={mockAllocationData} showLegend={true} />,
			);

			expect(screen.getByText("Stocks")).toBeInTheDocument();
			expect(screen.getByText("45%")).toBeInTheDocument();
			expect(screen.getByText("Crypto")).toBeInTheDocument();
			expect(screen.getByText("25%")).toBeInTheDocument();
			expect(screen.getByText("Bonds")).toBeInTheDocument();
			expect(screen.getByText("20%")).toBeInTheDocument();
			expect(screen.getByText("Cash")).toBeInTheDocument();
			expect(screen.getByText("10%")).toBeInTheDocument();
		});

		it("should handle asset type colors correctly", () => {
			render(
				<CompactAllocationChart data={mockAllocationData} showLegend={true} />,
			);

			const chartData = screen.getByTestId("mock-chart");
			const chartOption = JSON.parse(chartData.textContent || "{}");

			expect(chartOption.series[0].data).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: "Stocks",
						itemStyle: { color: "#3b82f6" },
					}),
					expect.objectContaining({
						name: "Crypto",
						itemStyle: { color: "#f59e0b" },
					}),
					expect.objectContaining({
						name: "Bonds",
						itemStyle: { color: "#10b981" },
					}),
					expect.objectContaining({
						name: "Cash",
						itemStyle: { color: "#6b7280" },
					}),
				]),
			);
		});

		it("should handle empty allocation data", () => {
			render(<CompactAllocationChart data={[]} showLegend={true} />);

			expect(screen.getByText("No allocation data")).toBeInTheDocument();
		});

		it("should show total value when provided", () => {
			render(
				<CompactAllocationChart
					data={mockAllocationData}
					totalValue={100000}
					showTotal={true}
				/>,
			);

			expect(screen.getByText("Total: $100,000.00")).toBeInTheDocument();
		});
	});

	describe("MiniPerformanceSparkline", () => {
		it("should render minimal sparkline chart", () => {
			render(
				<MiniPerformanceSparkline
					data={mockPerformanceData}
					width={120}
					height={40}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
			expect(chart).toHaveStyle({ width: "120px", height: "40px" });
		});

		it("should show change indicator when enabled", () => {
			render(
				<MiniPerformanceSparkline
					data={mockPerformanceData}
					showChange={true}
				/>,
			);

			expect(screen.getByText("+8.00%")).toBeInTheDocument();
		});

		it("should apply positive/negative styling to change indicator", () => {
			const negativeData = [
				{ date: "2024-01-01", value: 10000 },
				{ date: "2024-01-02", value: 9500 },
			];

			render(
				<MiniPerformanceSparkline data={negativeData} showChange={true} />,
			);

			const changeIndicator = screen.getByText("-5.00%");
			expect(changeIndicator).toHaveClass("text-red-600");
		});

		it("should handle single data point", () => {
			const singlePoint = [{ date: "2024-01-01", value: 10000 }];

			render(<MiniPerformanceSparkline data={singlePoint} showChange={true} />);

			expect(screen.getByText("0.00%")).toBeInTheDocument();
		});
	});

	describe("MiniAllocationDonut", () => {
		it("should render mini donut chart", () => {
			render(<MiniAllocationDonut data={mockAllocationData} size={80} />);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
			expect(chart).toHaveStyle({ width: "80px", height: "80px" });
		});

		it("should show center value when provided", () => {
			render(
				<MiniAllocationDonut
					data={mockAllocationData}
					size={80}
					centerValue="$100K"
				/>,
			);

			expect(screen.getByText("$100K")).toBeInTheDocument();
		});

		it("should display top allocation when showTopAllocation is true", () => {
			render(
				<MiniAllocationDonut
					data={mockAllocationData}
					showTopAllocation={true}
				/>,
			);

			expect(screen.getByText("Stocks 45%")).toBeInTheDocument();
		});
	});

	describe("AssetAllocationChart (Dashboard Integration)", () => {
		it("should render full allocation chart for dashboard", () => {
			render(
				<AssetAllocationChart
					allocationData={mockAllocationData}
					title="Portfolio Allocation"
				/>,
			);

			expect(screen.getByText("Portfolio Allocation")).toBeInTheDocument();
			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
		});

		it("should show allocation breakdown table", () => {
			render(
				<AssetAllocationChart
					allocationData={mockAllocationData}
					showBreakdown={true}
				/>,
			);

			expect(screen.getByText("Asset Type")).toBeInTheDocument();
			expect(screen.getByText("Value")).toBeInTheDocument();
			expect(screen.getByText("Allocation")).toBeInTheDocument();

			expect(screen.getByText("$45,000.00")).toBeInTheDocument();
			expect(screen.getByText("$25,000.00")).toBeInTheDocument();
			expect(screen.getByText("$20,000.00")).toBeInTheDocument();
			expect(screen.getByText("$10,000.00")).toBeInTheDocument();
		});

		it("should handle chart interactions", async () => {
			const mockOnSegmentClick = vi.fn();

			render(
				<AssetAllocationChart
					allocationData={mockAllocationData}
					onSegmentClick={mockOnSegmentClick}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			fireEvent.click(chart);

			await waitFor(() => {
				expect(mockOnSegmentClick).toHaveBeenCalled();
			});
		});
	});

	describe("RealTimeChart", () => {
		it("should render real-time performance chart", () => {
			render(
				<RealTimeChart
					data={mockRealTimeData}
					title="Live Portfolio Value"
					updateInterval={5000}
				/>,
			);

			expect(screen.getByText("Live Portfolio Value")).toBeInTheDocument();
			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
		});

		it("should show live indicator when data is updating", () => {
			render(<RealTimeChart data={mockRealTimeData} isLive={true} />);

			expect(screen.getByText("LIVE")).toBeInTheDocument();
			expect(screen.getByTestId("live-indicator")).toHaveClass("animate-pulse");
		});

		it("should display current value and change", () => {
			render(<RealTimeChart data={mockRealTimeData} showMetrics={true} />);

			expect(screen.getByText("$10,600.00")).toBeInTheDocument(); // Latest value
			expect(screen.getByText("+$100.00")).toBeInTheDocument(); // Change from first to last
		});

		it("should handle connection status", () => {
			render(
				<RealTimeChart
					data={mockRealTimeData}
					connectionStatus="disconnected"
				/>,
			);

			expect(screen.getByText("Disconnected")).toBeInTheDocument();
			expect(screen.getByTestId("connection-status")).toHaveClass(
				"text-red-600",
			);
		});

		it("should show last update timestamp", () => {
			render(<RealTimeChart data={mockRealTimeData} showLastUpdate={true} />);

			expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
		});
	});

	describe("Chart Performance and Optimization", () => {
		it("should handle large datasets efficiently", () => {
			const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
				date: `2024-01-${String(i + 1).padStart(2, "0")}`,
				value: 10000 + Math.random() * 1000,
			}));

			render(
				<CompactPerformanceChart
					data={largeDataset}
					enableDataSampling={true}
					maxDataPoints={100}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toBeInTheDocument();
		});

		it("should implement lazy loading for chart components", async () => {
			const LazyChart = vi.fn(() => (
				<div data-testid="lazy-chart">Lazy Chart</div>
			));

			render(
				<div>
					<CompactPerformanceChart
						data={mockPerformanceData}
						lazy={true}
						LazyComponent={LazyChart}
					/>
				</div>,
			);

			await waitFor(() => {
				expect(screen.getByTestId("lazy-chart")).toBeInTheDocument();
			});
		});

		it("should handle chart resize events", () => {
			const { rerender } = render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					width={400}
					height={200}
				/>,
			);

			let chart = screen.getByTestId("mock-chart");
			expect(chart).toHaveStyle({ width: "400px", height: "200px" });

			rerender(
				<CompactPerformanceChart
					data={mockPerformanceData}
					width={600}
					height={300}
				/>,
			);

			chart = screen.getByTestId("mock-chart");
			expect(chart).toHaveStyle({ width: "600px", height: "300px" });
		});
	});

	describe("Chart Error Handling", () => {
		it("should handle chart rendering errors gracefully", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			// Mock ECharts to throw an error
			vi.mocked(require("echarts-for-react").default).mockImplementationOnce(
				() => {
					throw new Error("Chart rendering failed");
				},
			);

			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					fallback={<div data-testid="chart-error">Chart Error</div>}
				/>,
			);

			expect(screen.getByTestId("chart-error")).toBeInTheDocument();

			consoleSpy.mockRestore();
		});

		it("should show error message for invalid data", () => {
			const invalidData = [{ date: "invalid-date", value: "not-a-number" }];

			render(<CompactPerformanceChart data={invalidData as any} />);

			expect(screen.getByText("Invalid chart data")).toBeInTheDocument();
		});

		it("should handle network errors for real-time charts", () => {
			render(<RealTimeChart data={[]} error="Network connection failed" />);

			expect(screen.getByText("Chart Error")).toBeInTheDocument();
			expect(screen.getByText("Network connection failed")).toBeInTheDocument();
		});
	});

	describe("Chart Accessibility", () => {
		it("should provide proper ARIA labels", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					ariaLabel="Portfolio performance chart showing 8% growth"
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toHaveAttribute(
				"aria-label",
				"Portfolio performance chart showing 8% growth",
			);
		});

		it("should support keyboard navigation", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					enableKeyboardNavigation={true}
				/>,
			);

			const chart = screen.getByTestId("mock-chart");
			expect(chart).toHaveAttribute("tabindex", "0");
		});

		it("should provide alternative text for screen readers", () => {
			render(
				<CompactAllocationChart
					data={mockAllocationData}
					altText="Asset allocation: 45% Stocks, 25% Crypto, 20% Bonds, 10% Cash"
				/>,
			);

			expect(
				screen.getByText(
					"Asset allocation: 45% Stocks, 25% Crypto, 20% Bonds, 10% Cash",
				),
			).toBeInTheDocument();
		});
	});

	describe("Chart Theming and Customization", () => {
		it("should apply dark theme correctly", () => {
			render(
				<CompactPerformanceChart data={mockPerformanceData} theme="dark" />,
			);

			const chartData = screen.getByTestId("mock-chart");
			const chartOption = JSON.parse(chartData.textContent || "{}");

			expect(chartOption.backgroundColor).toBe("#1f2937");
			expect(chartOption.textStyle?.color).toBe("#f9fafb");
		});

		it("should support custom color schemes", () => {
			const customColors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4"];

			render(
				<CompactAllocationChart
					data={mockAllocationData}
					colorScheme={customColors}
				/>,
			);

			const chartData = screen.getByTestId("mock-chart");
			const chartOption = JSON.parse(chartData.textContent || "{}");

			expect(chartOption.color).toEqual(customColors);
		});

		it("should handle responsive font sizes", () => {
			render(
				<CompactPerformanceChart
					data={mockPerformanceData}
					responsive={true}
					minFontSize={10}
					maxFontSize={16}
				/>,
			);

			const chartData = screen.getByTestId("mock-chart");
			const chartOption = JSON.parse(chartData.textContent || "{}");

			expect(chartOption.textStyle?.fontSize).toBeGreaterThanOrEqual(10);
			expect(chartOption.textStyle?.fontSize).toBeLessThanOrEqual(16);
		});
	});
});
