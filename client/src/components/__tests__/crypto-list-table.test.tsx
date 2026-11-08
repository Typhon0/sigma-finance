import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CryptoList } from "../assets/crypto/CryptoList";

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
	},
}));

// Mock echarts-for-react
vi.mock("@/components/charts/EChart", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "USD",
		formatCurrency: (value: number) =>
			`$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
				scopedPerformanceHistory: [{ date: "2024-01-01T00:00:00Z", value: 42800 }],
				walletAccounts: [
					{
						id: "w-sol-1",
						portfolioId: "port-1",
						network: "SOLANA",
						addressOrXpub: "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx",
						isXpub: false,
						label: "Phantom Wallet",
						isActive: true,
						lastSyncAt: "2026-10-29T12:00:00Z",
						historyStatus: "SYNCED",
						lastSyncError: null,
						balances: [
							{
								id: "bal-sol",
								symbol: "SOL",
								name: "Solana",
								decimals: 9,
								formattedQuantity: 5.5,
								rawBalance: "5500000000",
								tokenAddress: null,
								isSpam: false,
								isHidden: false,
								isStale: false,
								lastUpdatedAt: "2026-10-29T12:00:00Z",
							},
							{
								id: "bal-spl-usdc",
								symbol: "SPL",
								name: "SPL (EPjF...)",
								decimals: 6,
								formattedQuantity: 384.418392,
								rawBalance: "384418392",
								tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
								isSpam: false,
								isHidden: false,
								isStale: false,
								lastUpdatedAt: "2026-10-29T12:00:00Z",
							},
						],
					},
				],
			},
			loading: false,
			refetch: vi.fn(),
		}),
	};
});

// Mock AssetHeroChart
vi.mock("@/components/charts/AssetHeroChart", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/components/charts/AssetHeroChart")>();
	return {
		...actual,
		AssetHeroChart: () => <div data-testid="asset-hero-chart-mock" />,
	};
});

// Mock PortfolioProvider with sample crypto assets
const deleteAsset = vi.fn().mockResolvedValue(undefined);
const updateAsset = vi.fn().mockResolvedValue(undefined);

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
				institution: "Hardware Wallet",
				dayChangePercent: 2.5,
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
				dayChangePercent: -1.2,
				sparklineData: [3000, 3100, 3200],
			},
		],
		allAssets: [
			{
				id: "crypto-1",
				name: "Bitcoin",
				symbol: "BTC",
				currentPrice: 60000,
				dayChangePercent: 2.5,
			},
			{
				id: "crypto-2",
				name: "Ethereum",
				symbol: "ETH",
				currentPrice: 3200,
				dayChangePercent: -1.2,
			},
			{
				id: "market-sol",
				name: "Solana",
				symbol: "SOL",
				currentPrice: 140,
				dayChangePercent: 3.5,
				sparklineData: [130, 135, 140],
			},
		],
		currentPortfolio: "port-1",
		deleteAsset,
		updateAsset,
		refetch: vi.fn(),
		loading: false,
		transactions: [],
	}),
}));

// Mock @tanstack/react-virtual
vi.mock("@tanstack/react-virtual", () => ({
	useVirtualizer: ({
		count,
		estimateSize,
	}: {
		count: number;
		estimateSize: (index: number) => number;
	}) => {
		let offset = 0;
		const items = [];
		for (let index = 0; index < count; index += 1) {
			const size = estimateSize(index);
			items.push({ index, key: index, start: offset, end: offset + size, size });
			offset += size;
		}
		return {
			getVirtualItems: () => items,
			getTotalSize: () => offset,
			measureElement: () => {},
		};
	},
}));

describe("CryptoList Table Integration", () => {
	it("renders crypto assets in the table with Account grouping by default", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		// Group headers for accounts
		expect(screen.getByRole("button", { name: /^Hardware Wallet/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Binance/ })).toBeInTheDocument();

		// Asset rows
		expect(screen.getAllByText("BTC").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Bitcoin").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("ETH").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);

		// Table columns
		expect(screen.getByText("Instrument")).toBeInTheDocument();
		expect(screen.getByText("Price")).toBeInTheDocument();
		expect(screen.getByText("Change (1D)")).toBeInTheDocument();
		expect(screen.getByText("Total P&L")).toBeInTheDocument();
	});

	it("switches to Asset grouping mode when Asset button is clicked", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		const assetGroupBtn = screen.getByRole("button", { name: "Asset" });
		fireEvent.click(assetGroupBtn);

		// Expandable group headers for tokens exist (with aria-expanded="true")
		expect(screen.getByRole("button", { name: /^BTC/, expanded: true })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^ETH/, expanded: true })).toBeInTheDocument();
	});

	it("switches to Custody grouping mode when Custody button is clicked", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		const custodyGroupBtn = screen.getByRole("button", { name: "Custody" });
		fireEvent.click(custodyGroupBtn);

		expect(
			screen.getByRole("button", { name: /^Self-Custody \(Hot Wallet\)/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^Centralized Exchange \(CEX\)/ }),
		).toBeInTheDocument();
	});

	it("switches to flat None grouping mode when None button is clicked", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		const noneGroupBtn = screen.getByRole("button", { name: "None" });
		fireEvent.click(noneGroupBtn);

		// Account group toggle buttons should be gone
		expect(screen.queryByRole("button", { name: /^Hardware Wallet/ })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Binance/ })).not.toBeInTheDocument();

		// Coins still visible in row buttons
		expect(screen.getByRole("button", { name: "BTC" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "ETH" })).toBeInTheDocument();
	});

	it("renders row action triggers for each position", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		expect(screen.getByRole("button", { name: "Actions for BTC" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions for ETH" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions for SOL" })).toBeInTheDocument();
	});

	it("omits the trend sparkline column from the table for compact clarity", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		expect(screen.queryByText("Trend (7D)")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Tendance 7 jours")).not.toBeInTheDocument();
	});

	it("renders on-chain wallet accounts and balances directly in the table under Account grouping", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		// Phantom Wallet account group header is present in the table
		expect(
			screen.getByRole("button", { name: /^Phantom Wallet/, expanded: true }),
		).toBeInTheDocument();

		// SOL token from Phantom Wallet is rendered
		expect(screen.getByRole("button", { name: "SOL" })).toBeInTheDocument();

		// Set Cost Basis button is displayed for unrecorded wallet token
		expect(screen.getAllByRole("button", { name: "Set Cost Basis" }).length).toBeGreaterThanOrEqual(
			1,
		);
	});

	it("renders wallet row actions including View on Explorer and Copy Address", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		const solActionsBtn = screen.getByRole("button", { name: "Actions for SOL" });
		fireEvent.pointerDown(solActionsBtn);
		fireEvent.keyDown(solActionsBtn, { key: "Enter", code: "Enter" });

		expect(screen.getByText("View on Explorer")).toBeInTheDocument();
		expect(screen.getByText("Copy Address")).toBeInTheDocument();
		expect(screen.getByText("Hide Token")).toBeInTheDocument();
	});

	it("resolves Solana SPL token with USDC mint address to USDC instead of generic SPL", () => {
		render(<CryptoList onSelectCrypto={vi.fn()} />);

		// Should resolve mint EPjF... to USDC and USD Coin
		expect(screen.getByRole("button", { name: "USDC" })).toBeInTheDocument();
		expect(screen.getByText("USD Coin")).toBeInTheDocument();

		// Should NOT show generic SPL, Price Err or Unlisted
		expect(screen.queryByRole("button", { name: "SPL" })).not.toBeInTheDocument();
		expect(screen.queryByText(/Price Err/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Unlisted/i)).not.toBeInTheDocument();
	});
});
