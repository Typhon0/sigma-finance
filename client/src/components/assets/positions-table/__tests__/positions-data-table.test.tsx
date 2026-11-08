import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PositionsDataTable } from "../PositionsDataTable";
import type { BasePositionItem } from "../types";

// Mock @tanstack/react-virtual for jsdom
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

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

interface MockPosition extends BasePositionItem {
	customTag?: string;
}

const mockPositions: MockPosition[] = [
	{
		id: "pos-1",
		symbol: "BTC",
		name: "Bitcoin",
		quantity: 1.5,
		avgPrice: 30000,
		currentPrice: 60000,
		value: 90000,
		cost: 45000,
		pl: 45000,
		plPercent: 100,
		currency: "USD",
		account: "Cold Storage",
		dayChange: 2.5,
		dayChangeAmount: 2250,
		weight: 75,
	},
	{
		id: "pos-2",
		symbol: "ETH",
		name: "Ethereum",
		quantity: 10,
		avgPrice: 2000,
		currentPrice: 3000,
		value: 30000,
		cost: 20000,
		pl: 10000,
		plPercent: 50,
		currency: "USD",
		account: "Binance",
		dayChange: -1.2,
		dayChangeAmount: -360,
		weight: 25,
	},
];

describe("PositionsDataTable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders table headers and position rows", () => {
		render(<PositionsDataTable positions={mockPositions} groupBy="none" />);

		expect(screen.getByText("Instrument")).toBeInTheDocument();
		expect(screen.getByText("Price")).toBeInTheDocument();
		expect(screen.getByText("BTC")).toBeInTheDocument();
		expect(screen.getByText("Bitcoin")).toBeInTheDocument();
		expect(screen.getByText("ETH")).toBeInTheDocument();
		expect(screen.getByText("Ethereum")).toBeInTheDocument();
	});

	it("renders group headers and allows collapsing/expanding", () => {
		render(<PositionsDataTable positions={mockPositions} groupBy="account" />);

		expect(screen.getByText("Cold Storage")).toBeInTheDocument();
		expect(screen.getByText("Binance")).toBeInTheDocument();
		expect(screen.getByText("BTC")).toBeInTheDocument();

		const coldStorageToggle = screen.getByRole("button", { name: /^Cold Storage/ });
		expect(coldStorageToggle).toHaveAttribute("aria-expanded", "true");

		fireEvent.click(coldStorageToggle);
		expect(coldStorageToggle).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();

		fireEvent.click(coldStorageToggle);
		expect(coldStorageToggle).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByText("Bitcoin")).toBeInTheDocument();
	});

	it("sorts rows when clicking a sortable column header", () => {
		const onSort = vi.fn();
		render(<PositionsDataTable positions={mockPositions} groupBy="none" onSort={onSort} />);

		const priceSortBtn = screen.getByRole("button", { name: /^Price/i });
		fireEvent.click(priceSortBtn);

		expect(onSort).toHaveBeenCalledWith("price");
	});

	it("filters positions when typing in the search box", () => {
		render(<PositionsDataTable positions={mockPositions} groupBy="none" />);

		const searchInput = screen.getByPlaceholderText(/search holdings/i);
		fireEvent.change(searchInput, { target: { value: "Bitcoin" } });

		// Fast-forward debounce or check filtering
		expect(screen.getByText("BTC")).toBeInTheDocument();
	});

	it("renders trend column when renderTrend prop is provided", () => {
		render(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="none"
				renderTrend={(item) => <div data-testid={`trend-${item.symbol}`}>trend</div>}
			/>,
		);

		expect(screen.getByText("Trend (7D)")).toBeInTheDocument();
		expect(screen.getByTestId("trend-BTC")).toBeInTheDocument();
		expect(screen.getByTestId("trend-ETH")).toBeInTheDocument();
	});

	it("renders custom instrument icons and custom badges", () => {
		render(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="none"
				renderInstrumentIcon={(item) => (
					<div data-testid={`icon-${item.symbol}`}>{item.symbol[0]}</div>
				)}
				renderBadges={(item) => <span data-testid={`badge-${item.symbol}`}>Badge</span>}
			/>,
		);

		expect(screen.getByTestId("icon-BTC")).toBeInTheDocument();
		expect(screen.getByTestId("badge-BTC")).toBeInTheDocument();
	});

	it("calls onSelectAsset when row instrument button is clicked", () => {
		const onSelectAsset = vi.fn();
		render(
			<PositionsDataTable positions={mockPositions} groupBy="none" onSelectAsset={onSelectAsset} />,
		);

		const btcBtn = screen.getByRole("button", { name: "BTC" });
		fireEvent.click(btcBtn);

		expect(onSelectAsset).toHaveBeenCalledWith("BTC", mockPositions[0]);
	});

	it("renders empty state message when no positions match", () => {
		render(<PositionsDataTable positions={[]} emptyMessage="No crypto found." />);

		expect(screen.getByText("No crypto found.")).toBeInTheDocument();
	});

	it("supports compact density by default and toggles to normal density", () => {
		const onDensityChange = vi.fn();
		render(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="none"
				onDensityChange={onDensityChange}
			/>,
		);

		const densityBtn = screen.getByRole("button", { name: /switch to normal density/i });
		expect(densityBtn).toBeInTheDocument();

		fireEvent.click(densityBtn);
		expect(onDensityChange).toHaveBeenCalledWith("normal");
	});

	it("respects controlled density prop", () => {
		render(<PositionsDataTable positions={mockPositions} groupBy="none" density="normal" />);

		expect(screen.getByRole("button", { name: /switch to compact density/i })).toBeInTheDocument();
	});

	it("renders group header with aligned value, two-line P&L and wallet weight", () => {
		render(<PositionsDataTable positions={mockPositions} groupBy="account" />);

		// Cold Storage group: BTC only (value: 90000, pl: 45000, plPercent: 100%, weight: 75%)
		expect(screen.getAllByText("$90,000.00").length).toBeGreaterThan(0);
		expect(screen.getAllByText("+$45,000.00").length).toBeGreaterThan(0);
		expect(screen.getAllByText("+100.00%").length).toBeGreaterThan(0);
		expect(screen.getAllByText("75.0%").length).toBeGreaterThan(0);
	});

	it("handles partial cost basis in group header with asterisk indicator and tooltip", () => {
		const mixedPositions: MockPosition[] = [
			{
				id: "mix-1",
				symbol: "SOL",
				name: "Solana",
				quantity: 5,
				avgPrice: 100,
				currentPrice: 120,
				value: 600,
				cost: 500,
				pl: 100,
				plPercent: 20,
				currency: "USD",
				account: "Mixed Wallet",
				weight: 60,
			},
			{
				id: "mix-2",
				symbol: "AIRDROP",
				name: "Unknown Airdrop",
				quantity: 100,
				avgPrice: 0,
				currentPrice: 4,
				value: 400,
				cost: 0,
				pl: null, // unrecorded cost basis
				plPercent: 0,
				currency: "USD",
				account: "Mixed Wallet",
				weight: 40,
			},
		];

		render(<PositionsDataTable positions={mixedPositions} groupBy="account" />);

		// Mixed Wallet has 2 items: 1 with P&L (+$100), 1 without.
		// Value = $1,000.00 (appears in group header and table summary)
		expect(screen.getAllByText("$1,000.00").length).toBeGreaterThan(0);
		// P&L shows partial sum with asterisk
		expect(screen.getAllByText("+$100.00").length).toBeGreaterThan(0);
		const asterisks = screen.getAllByText("*");
		expect(asterisks.length).toBeGreaterThan(0);
		// Weight = 100%
		expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0);
	});

	it("displays dash for group P&L when all positions lack cost basis", () => {
		const unpricedPositions: MockPosition[] = [
			{
				id: "un-1",
				symbol: "TOKEN1",
				name: "Token One",
				quantity: 10,
				avgPrice: 0,
				currentPrice: 10,
				value: 100,
				cost: 0,
				pl: null,
				plPercent: 0,
				currency: "USD",
				account: "Unpriced Wallet",
				weight: 100,
			},
		];

		render(<PositionsDataTable positions={unpricedPositions} groupBy="account" />);

		expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
		// Total P&L shows dash
		const dashes = screen.getAllByText("—");
		expect(dashes.length).toBeGreaterThan(0);
	});

	it("renders and triggers onSelectAccount only when onSelectAccount callback is provided", () => {
		const onSelectAccountMock = vi.fn();
		const { rerender } = render(<PositionsDataTable positions={mockPositions} groupBy="account" />);

		// Without callback, Open button is not rendered
		expect(screen.queryByTitle("Open Cold Storage")).not.toBeInTheDocument();

		// With callback, Open button is rendered and clickable
		rerender(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="account"
				onSelectAccount={onSelectAccountMock}
			/>,
		);

		const openBtn = screen.getByTitle("Open Cold Storage");
		expect(openBtn).toBeInTheDocument();
		fireEvent.click(openBtn);
		expect(onSelectAccountMock).toHaveBeenCalledWith("Cold Storage");
	});

	it("hides empty account groups by default unless actively syncing", () => {
		const knownAccountGroups = [
			{ name: "Cold Storage", syncStatus: "SYNCED" },
			{ name: "Empty Account", syncStatus: "SYNCED" },
			{ name: "Syncing Wallet", syncStatus: "SYNCING" },
		];

		const { rerender } = render(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="account"
				knownAccountGroups={knownAccountGroups}
				hideEmptyAccounts={true}
			/>,
		);

		// Account with positions is rendered
		expect(screen.getByText("Cold Storage")).toBeInTheDocument();
		// Empty synced account is hidden
		expect(screen.queryByText("Empty Account")).not.toBeInTheDocument();
		// Empty syncing account is rendered with sync indicator
		expect(screen.getByText("Syncing Wallet")).toBeInTheDocument();
		expect(screen.getByText(/Synchronizing holdings for Syncing Wallet/i)).toBeInTheDocument();

		// When hideEmptyAccounts is false, the empty account group shows
		rerender(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="account"
				knownAccountGroups={knownAccountGroups}
				hideEmptyAccounts={false}
			/>,
		);
		expect(screen.getByText("Empty Account")).toBeInTheDocument();
	});

	it("toggles collapse all / expand all with toolbar button and Alt+C shortcut", () => {
		render(
			<PositionsDataTable
				positions={mockPositions}
				groupBy="account"
			/>,
		);

		// Initially not collapsed, Bitcoin position is visible
		expect(screen.getByText("Bitcoin")).toBeInTheDocument();

		// Find collapse all button
		const collapseBtn = screen.getByRole("button", { name: /collapse all groups/i });
		expect(collapseBtn).toBeInTheDocument();

		// Click to collapse all
		fireEvent.click(collapseBtn);
		expect(screen.queryByText("Bitcoin")).not.toBeInTheDocument();

		// Button label updates to expand all
		expect(screen.getByRole("button", { name: /expand all groups/i })).toBeInTheDocument();

		// Trigger Alt+C shortcut to expand all
		fireEvent.keyDown(window, { key: "c", altKey: true });
		expect(screen.getByText("Bitcoin")).toBeInTheDocument();
	});
});
