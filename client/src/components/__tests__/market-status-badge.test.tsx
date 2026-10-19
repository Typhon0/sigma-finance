import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	calculateMarketStatus,
	GLOBAL_MARKETS,
	MarketStatusBadge,
} from "../assets/stocks-funds/MarketStatusBadge";

describe("Global Market Status Engine", () => {
	it("includes 27 authentic global stock exchanges and separates crypto by category", () => {
		const stockMarkets = GLOBAL_MARKETS.filter((m) => m.marketCategory === "stock");
		expect(stockMarkets.length).toBe(27);

		const regions = new Set(stockMarkets.map((m) => m.region));
		expect(regions).toContain("Americas");
		expect(regions).toContain("Europe");
		expect(regions).toContain("Asia-Pacific");
		expect(regions).toContain("Middle East & Africa");
		// Stock markets do NOT contain "Global"
		expect(regions).not.toContain("Global");

		// Check critical stock exchanges exist
		const ids = stockMarkets.map((m) => m.id);
		expect(ids).toContain("us_nyse_nasdaq");
		expect(ids).toContain("fr_euronext_paris");
		expect(ids).toContain("gb_lse");
		expect(ids).toContain("de_xetra");
		expect(ids).toContain("jp_tse");
		expect(ids).toContain("hk_hkex");
		expect(ids).toContain("cn_sse");
		expect(ids).toContain("in_nse");
		expect(ids).toContain("au_asx");
		expect(ids).toContain("sa_tadawul");
	});

	it("correctly identifies Tadawul (Saudi Arabia) Sunday-Thursday trading days", () => {
		const tadawul = GLOBAL_MARKETS.find((m) => m.id === "sa_tadawul")!;
		expect(tadawul.tradingDays).toEqual([0, 1, 2, 3, 4]); // Sunday through Thursday

		// A Sunday at 11:00 AM Riyadh time (UTC 08:00) -> Should be OPEN
		const sunday11amRiyadh = new Date("2026-09-06T08:00:00Z"); // 2026-09-06 is Sunday
		const status = calculateMarketStatus(tadawul, sunday11amRiyadh);
		expect(status.session).toBe("regular");
		expect(status.label).toBe("Open");

		// A Friday at 11:00 AM Riyadh time -> Should be CLOSED (Weekend in Saudi Arabia)
		const friday11amRiyadh = new Date("2026-09-04T08:00:00Z"); // 2026-09-04 is Friday
		const friStatus = calculateMarketStatus(tadawul, friday11amRiyadh);
		expect(friStatus.session).toBe("closed");
	});

	it("correctly handles Tokyo TSE midday lunch break", () => {
		const tokyo = GLOBAL_MARKETS.find((m) => m.id === "jp_tse")!;

		// Wednesday 12:00 PM JST (UTC 03:00) -> Lunch break (11:30 - 12:30 JST)
		const wednesdayNoonTokyo = new Date("2026-09-02T03:00:00Z");
		const status = calculateMarketStatus(tokyo, wednesdayNoonTokyo);
		expect(status.session).toBe("lunch");
		expect(status.label).toBe("Lunch Halt");
	});
});

describe("MarketStatusBadge Component UI - Stock Page Scoping", () => {
	it("renders only stock exchanges on the stock page and excludes crypto", () => {
		const holdings = [
			{ symbol: "OR.PA", currency: "EUR" }, // Euronext Paris
			{ symbol: "7203.T", currency: "JPY" }, // Tokyo TSE
			{ symbol: "AAPL", currency: "USD" }, // US
		];

		render(<MarketStatusBadge holdings={holdings} assetType="stock" />);

		const button = screen.getByRole("button");
		expect(button).toBeInTheDocument();
		fireEvent.click(button);

		// Header reflects stock exchanges exclusively
		expect(screen.getByText("Worldwide Stock Exchanges")).toBeInTheDocument();
		expect(screen.getByText(/27 world equity & fund exchanges/i)).toBeInTheDocument();

		// Region filter tabs for stocks
		expect(screen.getByRole("button", { name: /^All \(27\)/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /My Portfolio/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Americas/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Europe/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Asia-Pacific/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Middle East & Africa/i })).toBeInTheDocument();

		// Crypto is strictly NOT present in the stock page list
		expect(screen.queryByText(/Cryptocurrency/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/Crypto 24\/7/i)).not.toBeInTheDocument();
	});

	it("allows searching equity markets on the stock page", () => {
		render(<MarketStatusBadge assetType="stock" />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		const searchInput = screen.getByPlaceholderText(/Search stock exchange/i);
		fireEvent.change(searchInput, { target: { value: "Tokyo" } });

		expect(screen.getByText("Tokyo Stock Exchange (TSE)")).toBeInTheDocument();
	});

	it("switches to crypto scope when assetType='crypto'", () => {
		render(<MarketStatusBadge assetType="crypto" />);

		const button = screen.getByRole("button");
		fireEvent.click(button);

		expect(screen.getByText("Global Crypto Markets")).toBeInTheDocument();
		expect(screen.getAllByText(/Cryptocurrency/i).length).toBeGreaterThan(0);
		expect(screen.queryByText("NYSE & NASDAQ")).not.toBeInTheDocument();
	});
});
