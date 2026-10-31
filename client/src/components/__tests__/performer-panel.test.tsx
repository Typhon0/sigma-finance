import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type PerformerAsset, PerformerPanel } from "../assets/stocks-funds/PerformerPanel";

const formatCurrency = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(2)}`;

const asset = (overrides: Partial<PerformerAsset> & { symbol: string }): PerformerAsset => ({
	id: overrides.symbol,
	name: `${overrides.symbol} Inc.`,
	totalValue: 1000,
	totalReturn: 100,
	totalReturnPercentage: 10,
	canShowPercentage: true,
	dayChangePercentage: 1,
	hasDayChange: true,
	...overrides,
});

const book: PerformerAsset[] = [
	asset({ symbol: "AAA", dayChangePercentage: 6.2 }),
	asset({ symbol: "BBB", dayChangePercentage: 4.1 }),
	asset({ symbol: "CCC", dayChangePercentage: 1.3 }),
	asset({ symbol: "DDD", dayChangePercentage: 0.2 }),
	asset({ symbol: "EEE", dayChangePercentage: -0.8 }),
	asset({ symbol: "FFF", dayChangePercentage: -2.4 }),
	asset({ symbol: "GGG", dayChangePercentage: -5.1 }),
	asset({ symbol: "HHH", dayChangePercentage: -9.7 }),
];

describe("PerformerPanel", () => {
	it("ranks both directions by today's percentage, best first", () => {
		render(<PerformerPanel assets={book} formatCurrency={formatCurrency} />);

		const rows = screen
			.getAllByRole("button")
			.filter((b) => /^[A-H]{3},/.test(b.getAttribute("aria-label") ?? ""));
		const symbols = rows.map((b) => (b.getAttribute("aria-label") ?? "").split(",")[0]);

		// Both columns read outward from zero: the best gain first, the worst loss first.
		expect(symbols).toEqual(["AAA", "BBB", "CCC", "DDD", "HHH", "GGG", "FFF", "EEE"]);
		expect(rows[0]).toHaveAccessibleName(/\+6\.20% today/);
		expect(rows[4]).toHaveAccessibleName(/-9\.70% today/);
	});

	it("re-ranks by money when the basis changes", () => {
		render(
			<PerformerPanel
				assets={[
					asset({ symbol: "BIG", totalValue: 100000, dayChangePercentage: 1 }),
					asset({ symbol: "SML", totalValue: 100, dayChangePercentage: 20 }),
				]}
				formatCurrency={formatCurrency}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Amount" }));

		const rows = screen
			.getAllByRole("button")
			.filter((b) => /^[A-Z]{3},/.test(b.getAttribute("aria-label") ?? ""));
		expect(rows[0]?.getAttribute("aria-label") ?? "").toMatch(/^BIG,/);
	});

	it("refuses to print a percentage when no holding has a display-currency cost basis", () => {
		render(
			<PerformerPanel
				assets={[asset({ symbol: "AAA", canShowPercentage: false })]}
				formatCurrency={formatCurrency}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Since purchase" }));

		expect(screen.getByText(/No cost basis in the display currency/i)).toBeInTheDocument();
	});

	it("opens the holding when a row is chosen", () => {
		const onSelectAsset = vi.fn();
		render(
			<PerformerPanel
				assets={book}
				formatCurrency={formatCurrency}
				onSelectAsset={onSelectAsset}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /^AAA,/ }));

		expect(onSelectAsset).toHaveBeenCalledWith("AAA");
	});
});
