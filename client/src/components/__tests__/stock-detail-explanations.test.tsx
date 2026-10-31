import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FxResolution } from "../../stocks-funds/fx-valuation";
import type { Asset } from "../../stocks-funds/types";
import { StockPerformanceBreakdown } from "../assets/stocks-funds/StockPerformanceBreakdown";
import { StockPositionSummaryBanner } from "../assets/stocks-funds/StockPositionSummaryBanner";
import { Explained } from "../shared/info-hint";
import { Badge } from "../ui/badge";

const FX_REASON =
	"Cost basis is recorded in EUR; the execution-date FX rate needed to express it in USD is not available, so the return percentage is unavailable.";

function fx(overrides: Partial<FxResolution> = {}): FxResolution {
	return {
		canShowPercentage: false,
		basis: "unknown",
		isStale: false,
		costBasisCurrency: "EUR",
		quoteCurrency: "USD",
		fxAsOf: null,
		reason: FX_REASON,
		displayValue: null,
		costBasisDisplay: null,
		...overrides,
	};
}

function position(overrides: Partial<Asset> = {}): Asset {
	return {
		id: "position-1",
		portfolioId: "p-1",
		symbol: "AAPL",
		name: "Apple Inc.",
		type: "STOCK",
		quantity: 10,
		avgCost: 100,
		currentPrice: 150,
		totalValue: 1500,
		totalReturn: null,
		totalReturnPercentage: 0,
		dayChangePercentage: 0,
		hasDayChange: false,
		account: "Main",
		sector: "Technology",
		currency: "EUR",
		fx: fx(),
		portfolioWeight: 0.2,
		sparklineData: [],
		...overrides,
	} as Asset;
}

describe("Sheet explanations are reachable without a pointer", () => {
	it("names the performance panel's explanation buttons and exposes their text", () => {
		render(
			<StockPerformanceBreakdown
				position={position()}
				currentPrice={150}
				resolvedCurrency="EUR"
				realizedCurrencyBasis="EUR"
				open={140}
				high={155}
				low={138}
				close={150}
			/>,
		);

		// Each explanation is a real button with a name — not a hover-only
		// icon that a keyboard or screen-reader user can never reach.
		const priceReturnHint = screen.getByRole("button", { name: "What is Price Return?" });
		expect(priceReturnHint).toHaveAccessibleDescription(
			"Price change relative to the average purchase cost basis.",
		);
		expect(
			screen.getByRole("button", { name: "What is Realized Fiscal P&L?" }),
		).toBeInTheDocument();

		// The explanation itself is in the document (announced as the
		// button's description on focus), not withheld behind a hover.
		expect(
			screen.getByText("Price change relative to the average purchase cost basis."),
		).toBeInTheDocument();
	});

	it("explains an unavailable percentage through a named, focusable affordance", () => {
		render(
			<StockPositionSummaryBanner
				position={position()}
				resolvedPrice={150}
				currency="EUR"
				formatCurrency={(v) => `$${v.toFixed(2)}`}
				formatQuantity={(v) => String(v)}
			/>,
		);

		expect(screen.getByText("% n/a")).toBeInTheDocument();
		const hint = screen.getByRole("button", { name: "Why the percentage is unavailable" });
		expect(hint).toBeInTheDocument();
		// The reason rides the trigger's DESCRIPTION — announced on focus —
		// not a title attribute no keyboard user can reach.
		expect(hint).toHaveAccessibleDescription(FX_REASON);
		// The reason rides a description, not a title attribute that no
		// keyboard user can reach.
		expect(screen.getByText(FX_REASON)).toBeInTheDocument();
	});

	it("keeps a badge's visible text as its name and attaches the reason as its description", () => {
		render(
			<Explained description={FX_REASON}>
				<Badge variant="secondary">EUR</Badge>
			</Explained>,
		);

		// The name stays what the user reads; the explanation rides the
		// description, so it is announced without a pointer.
		expect(screen.getByRole("button", { name: "EUR" })).toHaveAccessibleDescription(FX_REASON);
	});

	it("offers no explanation affordance when the percentage is available", () => {
		render(
			<StockPositionSummaryBanner
				position={position({
					fx: fx({
						canShowPercentage: true,
						basis: "same-currency",
						costBasisCurrency: "USD",
						quoteCurrency: "USD",
						displayValue: 1500,
						costBasisDisplay: 1000,
						reason: "Cost basis was converted at each lot's execution-date rate.",
					}),
				})}
				resolvedPrice={150}
				currency="EUR"
				formatCurrency={(v) => `$${v.toFixed(2)}`}
				formatQuantity={(v) => String(v)}
			/>,
		);

		expect(
			screen.queryByRole("button", { name: "Why the percentage is unavailable" }),
		).not.toBeInTheDocument();
	});
});
