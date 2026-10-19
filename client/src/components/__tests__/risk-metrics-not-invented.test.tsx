import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskMetricRows } from "@/components/insights/RiskMetricRows";
import type { PortfolioRiskMetrics } from "@/hooks/use-portfolio-risk-metrics";

/**
 * Read a source file with comments stripped.
 *
 * These files document the formulas they replaced, quoting them verbatim. A
 * naive grep for the old expression matches the comment explaining its removal
 * and fails forever.
 */
function readCode(path: string): string {
	return readFileSync(path, "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^[\t ]*\/\/.*$/gm, "");
}

/**
 * Risk metrics are now measured by the performance service. Before this,
 * three separate places invented them:
 *
 * 1. `Analytics.tsx` risk tab: Beta 1.2, Sharpe 1.8, -8.5% max drawdown,
 *    literal numbers in the JSX. Every visitor saw the same values whatever
 *    they owned.
 * 2. `Analytics.tsx` overview: `riskMetrics?.volatility ?? Math.abs(gainPercent)` -
 *    the portfolio's total return relabelled "30-day volatility", and the
 *    fallback fired on every portfolio because analytics.riskMetrics is null on
 *    the valuation path.
 * 3. `Analytics.tsx` risk level: `Math.max(Math.min(Math.abs(gainPercent) * 2, 100), 20)`
 *    printed as Conservative/Moderate/Aggressive. A portfolio down 40% scored
 *    80 and read "Aggressive"; one up 10% scored 20 and read "Conservative" -
 *    the sign of the return decided the risk word.
 *
 * The invariant pinned here: a metric the server could not measure renders as
 * an explicit unavailable state, never as a number.
 */

function metrics(overrides: Partial<PortfolioRiskMetrics> = {}): PortfolioRiskMetrics {
	return {
		volatility: 14.2,
		sharpeRatio: 1.05,
		sortinoRatio: 1.63,
		maxDrawdown: -18.4,
		diversification: null,
		hasData: true,
		windowDays: 365,
		...overrides,
	};
}

describe("RiskMetricRows", () => {
	it("renders the measured values", () => {
		render(<RiskMetricRows metrics={metrics()} />);

		expect(screen.getByText("14.20%")).toBeDefined();
		expect(screen.getByText("1.05")).toBeDefined();
		expect(screen.getByText("1.63")).toBeDefined();
		expect(screen.getByText("-18.40%")).toBeDefined();
	});

	it("shows an unavailable state when the server measured nothing", () => {
		const empty = metrics({
			volatility: null,
			sharpeRatio: null,
			sortinoRatio: null,
			maxDrawdown: null,
			hasData: false,
		});
		render(<RiskMetricRows metrics={empty} />);

		expect(screen.getByText(/price history/i)).toBeDefined();
		// The specific failure: a formatted 0.00% volatility would tell the user
		// their portfolio is riskless.
		expect(screen.queryByText("0.00%")).toBeNull();
	});

	it("shows n/a per metric rather than zero for the ones it cannot measure", () => {
		// Max drawdown needs two data points; Sharpe needs a year of returns. A
		// young portfolio has the first and not the second.
		const partial = metrics({ sharpeRatio: null, sortinoRatio: null });
		render(<RiskMetricRows metrics={partial} />);

		expect(screen.getByText("14.20%")).toBeDefined(); // volatility still measured
		expect(screen.getByText("-18.40%")).toBeDefined(); // drawdown still measured
		// Two "n/a" cells for the two unmeasurable ratios, and crucially no 0.00.
		expect(screen.getAllByText("n/a").length).toBe(2);
		expect(screen.queryByText("0.00")).toBeNull();
	});

	it("explains what each unavailable metric would have meant", () => {
		const partial = metrics({ sharpeRatio: null, sortinoRatio: null });
		render(<RiskMetricRows metrics={partial} />);

		const titles = screen.getAllByText("n/a").map((node) => node.getAttribute("title") ?? "");
		expect(titles).toHaveLength(2);
		for (const title of titles) {
			expect(title.length).toBeGreaterThan(0);
		}
		expect(titles.join(" ")).toMatch(/volatility/i);
	});

	it("keeps a real zero distinct from an unmeasurable metric", () => {
		// A genuinely riskless cash portfolio has volatility 0.00%. That must
		// render as a measurement, not fall into the unavailable branch.
		render(<RiskMetricRows metrics={metrics({ volatility: 0 })} />);

		expect(screen.getByText("0.00%")).toBeDefined();
		expect(screen.queryByText(/needs a price history/i)).toBeNull();
	});
});

describe("risk band thresholds", () => {
	// Mirrors the RISK_BANDS table in Analytics.tsx. Duplicated deliberately:
	// this pins the thresholds as a contract, so a change to either copy shows
	// up as a diff rather than silently moving a word.
	const band = (volatility: number | null) => {
		if (volatility === null) return null;
		if (volatility < 10) return "Conservative";
		if (volatility < 20) return "Moderate";
		return "Aggressive";
	};

	it("reads from measured volatility, not from the direction of the return", () => {
		// The regression: a portfolio losing 40% was labelled "Aggressive" and one
		// gaining 10% "Conservative", because the score was |gain| * 2.
		expect(band(8)).toBe("Conservative");
		expect(band(15)).toBe("Moderate");
		expect(band(35)).toBe("Aggressive");
	});

	it("has no band at all when volatility is unmeasured", () => {
		expect(band(null)).toBeNull();
	});
});

describe("the module no longer invents a risk level", () => {
	it("has no return-derived risk score left in the Analytics page", async () => {
		// A source-level assertion. The bug was a formula, and a formula can be
		// reintroduced without any of the rendering tests noticing.
		const source = readCode(resolve(process.cwd(), "src/components/Analytics.tsx"));
		expect(source).not.toMatch(/Math\.abs\(gainPercent\)\s*\*\s*2/);
		expect(source).not.toMatch(/riskMetrics\?\.volatility\s*\?\?/);
	});
});

describe("PortfolioHealthCard concentration label", () => {
	it("does not present concentration as risk", async () => {
		const { resolve } = await import("node:path");
		const source = readCode(
			resolve(process.cwd(), "src/components/insights/PortfolioHealthCard.tsx"),
		);
		// "Risk: High" derived from the largest position told the reader
		// something about volatility that was never measured.
		expect(source).not.toMatch(/Risk:\s*\{/);
		expect(source).toMatch(/Concentration:/);
	});
});
