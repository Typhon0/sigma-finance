import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CryptoList } from "../assets/crypto/CryptoList";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

// Mock echarts-for-react
vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "USD",
		formatCurrency: (value: number) => `$${value.toLocaleString()}`,
		preferredCurrency: "USD",
	}),
}));

// Mock Apollo client
vi.mock("@apollo/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@apollo/client")>();
	return {
		...actual,
		gql: vi.fn(),
		useMutation: () => [vi.fn(), { loading: false }],
		useQuery: () => ({
			data: {
				scopedPerformanceHistory: [
					{ date: "2024-01-01T00:00:00Z", value: 12000 },
					{ date: "2024-01-02T00:00:00Z", value: 13500 },
				],
			},
			loading: false,
		}),
	};
});

// Mock AssetHeroChart
vi.mock("@/components/charts/AssetHeroChart", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/components/charts/AssetHeroChart")>();
	return {
		...actual,
		AssetHeroChart: ({
			title,
			titleTooltip,
			totalEquity,
			timeRange,
			data,
			defaultBenchmark,
			layoutId,
		}: import("@/components/charts/AssetHeroChart").AssetHeroChartProps) => (
			<div data-testid="asset-hero-chart-mock">
				<span data-testid="hero-title">{title}</span>
				<span data-testid="hero-title-tooltip">{titleTooltip}</span>
				<span data-testid="hero-equity">{totalEquity}</span>
				<span data-testid="hero-timerange">{timeRange}</span>
				<span data-testid="hero-benchmark">{defaultBenchmark}</span>
				<span data-testid="hero-layoutid">{layoutId}</span>
				<span data-testid="hero-points-count">{data.length}</span>
			</div>
		),
	};
});

// Mock PortfolioProvider
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [
			{
				id: "crypto-1",
				name: "Bitcoin",
				symbol: "BTC",
				type: "crypto",
				quantity: 0.5,
				purchasePrice: 40000,
				currentPrice: 60000,
				currentValue: 30000,
				institution: "Ledger",
				sparklineData: [55000, 58000, 60000],
			},
			{
				id: "crypto-2",
				name: "Ethereum",
				symbol: "ETH",
				type: "crypto",
				quantity: 4,
				purchasePrice: 2500,
				currentPrice: 3200,
				currentValue: 12800,
				institution: "Binance",
				sparklineData: [3000, 3100, 3200],
			},
		],
		selectedPortfolio: {
			id: "portfolio-crypto-1",
			name: "Crypto Treasury",
			analytics: {
				performanceHistory: [],
			},
		},
		transactions: [],
		loading: false,
		addCrypto: vi.fn(),
		deleteAsset: vi.fn(),
		updateAsset: vi.fn(),
		refetch: vi.fn(),
	}),
}));

describe("CryptoList Hero Chart Integration", () => {
	it("renders the reusable AssetHeroChart with crypto scope props", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		const heroChart = screen.getByTestId("asset-hero-chart-mock");
		expect(heroChart).toBeInTheDocument();

		expect(screen.getByTestId("hero-title")).toHaveTextContent("Crypto Value");
		expect(screen.getByTestId("hero-title-tooltip")).toHaveTextContent(
			"Total value of crypto held in this portfolio",
		);
		expect(screen.getByTestId("hero-benchmark")).toHaveTextContent("sp500");
		expect(screen.getByTestId("hero-layoutid")).toHaveTextContent("cryptoHeroRangePillActive");
		expect(screen.getByTestId("hero-points-count")).toHaveTextContent("2");
	});
});
