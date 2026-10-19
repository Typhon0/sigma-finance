import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StocksFundsPositions } from "../assets/stocks-funds/StocksFundsPositions";

/**
 * F-12 / F-17: grouped mode used to render one Radix <Accordion> per group, each
 * wrapping its own virtualized <PositionsTable> that had a private
 * `max-h-[640px] overflow-auto` div. N groups meant N nested scroll containers
 * inside an outer `overflow-x-auto`, and the row height estimate was a
 * hardcoded 68px for headers and positions alike.
 *
 * Group headers and position rows now share one flattened stream behind a
 * single scroll container.
 */

const refreshAssetPrice = vi.fn().mockResolvedValue(undefined);
const deleteAsset = vi.fn().mockResolvedValue(undefined);

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [
			{
				id: "a1",
				portfolioId: "p1",
				type: "stock",
				symbol: "AAPL",
				name: "Apple Inc.",
				quantity: 10,
				purchasePrice: 100,
				currentPrice: 150,
				currentValue: 1500,
				currency: "USD",
				account: "Brokerage",
				sector: "Technology",
				dayChangePercent: 1.2,
			},
			{
				id: "a2",
				portfolioId: "p1",
				type: "stock",
				symbol: "MSFT",
				name: "Microsoft Corp.",
				quantity: 5,
				purchasePrice: 200,
				currentPrice: 250,
				currentValue: 1250,
				currency: "USD",
				account: "Brokerage",
				sector: "Technology",
				dayChangePercent: -0.5,
			},
			{
				id: "a3",
				portfolioId: "p1",
				type: "fund",
				symbol: "VT",
				name: "Vanguard Total World",
				quantity: 20,
				purchasePrice: 90,
				currentPrice: 100,
				currentValue: 2000,
				currency: "USD",
				account: "Pension",
				sector: "Broad Market",
				dayChangePercent: 0.3,
			},
		],
		currentPortfolio: "p1",
		deleteAsset,
		refreshAssetPrice,
		refetch: vi.fn(),
	}),
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		formatCurrency: (val: number) =>
			`$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
		formatCurrencyCompact: (val: number) => `$${val.toLocaleString("en-US")}`,
		currency: "USD",
	}),
}));

// The virtualizer needs real layout, which jsdom does not provide. Render every
// row, which is what these assertions want anyway.
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

beforeEach(() => {
	vi.clearAllMocks();
});

/** Elements that actually scroll, i.e. create a nested scroll area. */
function scrollContainers(): Element[] {
	return Array.from(document.querySelectorAll("*")).filter((el) => {
		const style = window.getComputedStyle(el);
		return /(auto|scroll)/.test(style.overflowY) || /(auto|scroll)/.test(style.overflow);
	});
}

describe("StocksFundsPositions (F-12 / F-17)", () => {
	it("uses a single scroll container in grouped mode", () => {
		render(<StocksFundsPositions />);

		// Two groups (Brokerage, Pension) used to mean two nested scrollers.
		expect(scrollContainers().length).toBeLessThanOrEqual(1);
	});

	it("renders group headers and positions in the same table", () => {
		render(<StocksFundsPositions />);

		expect(screen.getByText("Brokerage")).toBeInTheDocument();
		expect(screen.getByText("Pension")).toBeInTheDocument();
		expect(screen.getByText("AAPL")).toBeInTheDocument();
		expect(screen.getByText("VT")).toBeInTheDocument();
	});

	it("shows one column header, not one per group", () => {
		render(<StocksFundsPositions />);

		expect(screen.getAllByText("Total P&L")).toHaveLength(1);
		expect(screen.getAllByText("Instrument")).toHaveLength(1);
	});

	it("collapses and expands a group without unmounting the table", () => {
		render(<StocksFundsPositions />);

		// Anchored at the start so the "Open <account>" link does not also match.
		const toggle = screen.getByRole("button", { name: /^Brokerage/ });
		expect(toggle).toHaveAttribute("aria-expanded", "true");

		fireEvent.click(toggle);

		expect(screen.getByRole("button", { name: /^Brokerage/ })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		// AAPL and MSFT belong to Brokerage and are hidden while it is collapsed.
		expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
		expect(screen.queryByText("MSFT")).not.toBeInTheDocument();
		// The other group is untouched.
		expect(screen.getByText("VT")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /^Brokerage/ }));
		expect(screen.getByText("AAPL")).toBeInTheDocument();
	});

	it("keeps the sticky column header visible in ungrouped mode", () => {
		render(<StocksFundsPositions />);

		fireEvent.click(screen.getByRole("button", { name: "None" }));

		// Exactly one header row, and no group headers in "None" mode.
		expect(screen.getAllByText("Total P&L")).toHaveLength(1);
		expect(screen.queryByText("Brokerage")).not.toBeInTheDocument();
		expect(screen.getByText("AAPL")).toBeInTheDocument();
	});

	it("renders one working row action trigger per position", () => {
		render(<StocksFundsPositions />);

		// Regression guard: a stray sibling inside <DropdownMenuTrigger asChild>
		// makes Radix's Slot call React.Children.only and throw, which breaks the
		// row menu for every holding in the table.
		expect(screen.getByRole("button", { name: "Actions for AAPL" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions for MSFT" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Actions for VT" })).toBeInTheDocument();
	});

	it("sorts by clicking a column header button", () => {
		render(<StocksFundsPositions />);

		const header = screen.getByRole("button", { name: /Instrument/ });
		fireEvent.click(header);

		expect(header.closest("th")).toHaveAttribute("aria-sort", "descending");
		fireEvent.click(header);
		expect(header.closest("th")).toHaveAttribute("aria-sort", "ascending");
	});
});
