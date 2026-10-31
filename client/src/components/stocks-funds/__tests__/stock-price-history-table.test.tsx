import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock market data — the marker under test is a pure function of the
// hook's revalidation state, so the mock only varies that flag.
const mockMarketDataState = {
	data: [] as Array<{
		timestamp: string;
		open: number;
		high: number;
		low: number;
		close: number;
		volume?: number;
	}>,
	loading: false,
	error: null as string | null,
	isRefetching: false,
	refetch: () => Promise.resolve({} as never),
};

vi.mock("@/hooks/useMarketData", () => ({
	useMarketData: () => mockMarketDataState,
}));

import { StockPriceHistoryTable } from "@/components/assets/stocks-funds/StockPriceHistoryTable";

const seedCandles = () => {
	mockMarketDataState.data = [
		{
			timestamp: "2026-10-19T00:00:00Z",
			open: 148,
			high: 152,
			low: 147,
			close: 150.25,
			volume: 1200,
		},
		{
			timestamp: "2026-10-16T00:00:00Z",
			open: 146,
			high: 149,
			low: 145,
			close: 148,
			volume: 900,
		},
	];
};

describe("StockPriceHistoryTable staleness honesty", () => {
	it("counts the ledger instead of promising a window", () => {
		seedCandles();
		mockMarketDataState.isRefetching = false;

		render(<StockPriceHistoryTable symbol="AAPL" />);

		expect(screen.getByText("Last 2 recorded daily candles for AAPL")).toBeInTheDocument();
		expect(screen.queryByText(/refreshing/i)).not.toBeInTheDocument();
	});

	it("marks rows on screen as previous-fetch data while a refresh is in flight", async () => {
		seedCandles();
		mockMarketDataState.isRefetching = true;

		render(<StockPriceHistoryTable symbol="AAPL" />);

		// The rows still render (nothing recently loaded), but they are
		// labelled as refreshing rather than reading as current.
		expect(screen.getByText("Last 2 recorded daily candles for AAPL")).toBeInTheDocument();
		await waitFor(() => expect(screen.getByText(/refreshing/i)).toBeInTheDocument());
	});
});
