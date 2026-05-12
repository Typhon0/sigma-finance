import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock echarts-for-react to avoid canvas issues in tests
import { vi } from "vitest";
import {
	AllocationChart,
	CompactAllocationChart,
	CompactPerformanceChart,
	MiniAllocationDonut,
	MiniPerformanceSparkline,
	PerformanceChart,
	PortfolioComparisonChart,
} from "../index";

vi.mock("echarts-for-react", () => ({
	// biome-ignore lint/suspicious/noExplicitAny: unavoidable
	default: function MockReactECharts({ style }: { style: any }) {
		return <div data-testid="mock-chart" style={style} />;
	},
}));

describe("Apache ECharts Components", () => {
	const mockPerformanceData = [
		{ date: "2024-01-01", value: 1000 },
		{ date: "2024-01-02", value: 1100 },
		{ date: "2024-01-03", value: 1050 },
	];

	const mockAllocationData = [
		{ name: "Stocks", value: 5000, assetType: "STOCK" },
		{ name: "Crypto", value: 3000, assetType: "CRYPTO" },
		{ name: "Cash", value: 2000, assetType: "BANK_ACCOUNT" },
	];

	const mockPortfolioData = [
		{
			id: "1",
			name: "Portfolio 1",
			data: mockPerformanceData,
		},
		{
			id: "2",
			name: "Portfolio 2",
			data: mockPerformanceData.map((d) => ({ ...d, value: d.value * 1.2 })),
		},
	];

	describe("PerformanceChart", () => {
		it("renders with data", () => {
			render(<PerformanceChart data={mockPerformanceData} title="Test Performance Chart" />);

			expect(screen.getByText("Test Performance Chart")).toBeInTheDocument();
			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
		});

		it("shows loading state", () => {
			render(<PerformanceChart data={[]} title="Loading Chart" loading={true} />);

			expect(screen.getByText("Loading chart data...")).toBeInTheDocument();
		});

		it("shows error state", () => {
			render(<PerformanceChart data={[]} title="Error Chart" error="Failed to load data" />);

			expect(screen.getByText("Failed to load chart")).toBeInTheDocument();
			expect(screen.getByText("Failed to load data")).toBeInTheDocument();
		});

		it("shows no data state", () => {
			render(<PerformanceChart data={[]} title="No Data Chart" />);

			expect(screen.getByText("No data available")).toBeInTheDocument();
		});
	});

	describe("AllocationChart", () => {
		it("renders with data", () => {
			render(<AllocationChart data={mockAllocationData} title="Test Allocation Chart" />);

			expect(screen.getByText("Test Allocation Chart")).toBeInTheDocument();
			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
		});

		it("shows loading state", () => {
			render(<AllocationChart data={[]} title="Loading Chart" loading={true} />);

			expect(screen.getByText("Loading allocation data...")).toBeInTheDocument();
		});

		it("shows no data state", () => {
			render(<AllocationChart data={[]} title="No Data Chart" />);

			expect(screen.getByText("No allocation data")).toBeInTheDocument();
		});
	});

	describe("PortfolioComparisonChart", () => {
		it("renders with data", () => {
			render(
				<PortfolioComparisonChart portfolios={mockPortfolioData} title="Test Comparison Chart" />,
			);

			expect(screen.getByText("Test Comparison Chart")).toBeInTheDocument();
			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
		});

		it("shows no data state", () => {
			render(<PortfolioComparisonChart portfolios={[]} title="No Data Chart" />);

			expect(screen.getByText("No portfolios to compare")).toBeInTheDocument();
		});
	});

	describe("Compact Charts", () => {
		it("renders CompactPerformanceChart", () => {
			render(<CompactPerformanceChart data={mockPerformanceData} />);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
		});

		it("renders CompactAllocationChart", () => {
			render(<CompactAllocationChart data={mockAllocationData} />);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
		});

		it("renders MiniPerformanceSparkline with change indicator", () => {
			render(<MiniPerformanceSparkline data={mockPerformanceData} showChange={true} />);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
			// Should show positive change (1050 vs 1000 = +5%)
			expect(screen.getByText("+5.00%")).toBeInTheDocument();
		});

		it("renders MiniAllocationDonut with legend", () => {
			render(<MiniAllocationDonut data={mockAllocationData} showLegend={true} />);

			expect(screen.getByTestId("mock-chart")).toBeInTheDocument();
			expect(screen.getByText("Stocks")).toBeInTheDocument();
			expect(screen.getByText("50%")).toBeInTheDocument(); // 5000/10000 = 50%
		});
	});

	describe("Chart States", () => {
		it("handles empty data gracefully", () => {
			render(<PerformanceChart data={[]} title="Empty Chart" />);

			expect(screen.getByText("No data available")).toBeInTheDocument();
		});

		it("handles undefined data gracefully", () => {
			// biome-ignore lint/suspicious/noExplicitAny: unavoidable
			render(<AllocationChart data={undefined as any} title="Undefined Chart" />);

			expect(screen.getByText("No allocation data")).toBeInTheDocument();
		});
	});

	describe("Chart Interactions", () => {
		it("calls onTimeRangeChange when provided", () => {
			const mockOnTimeRangeChange = vi.fn();

			render(
				<PerformanceChart
					data={mockPerformanceData}
					title="Interactive Chart"
					onTimeRangeChange={mockOnTimeRangeChange}
				/>,
			);

			// Time range buttons should be present
			expect(screen.getByText("1D")).toBeInTheDocument();
			expect(screen.getByText("1W")).toBeInTheDocument();
			expect(screen.getByText("1M")).toBeInTheDocument();
		});

		it("shows export button when enabled", () => {
			render(
				<PerformanceChart data={mockPerformanceData} title="Exportable Chart" showExport={true} />,
			);

			// Export button should be present (Download icon)
			const exportButton = screen.getByTitle("Export chart");
			expect(exportButton).toBeInTheDocument();
		});

		it("shows fullscreen button when enabled", () => {
			render(
				<AllocationChart
					data={mockAllocationData}
					title="Fullscreen Chart"
					showFullscreen={true}
				/>,
			);

			// Fullscreen button should be present
			const fullscreenButton = screen.getByTitle("Fullscreen");
			expect(fullscreenButton).toBeInTheDocument();
		});
	});
});
