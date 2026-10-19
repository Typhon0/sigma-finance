import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { BenchmarkMetricsBar } from "../BenchmarkMetricsBar";

vi.mock("@apollo/client", () => ({
	useQuery: vi.fn().mockReturnValue({ data: undefined, loading: false }),
	gql: (strings: TemplateStringsArray) => strings.join(""),
}));

vi.mock("@/hooks/useBenchmarkInstrumentId", () => ({
	useBenchmarkInstrumentId: (mode: string) => ({
		id: mode !== "none" ? "instrument-sp500-uuid" : null,
		symbol: "SPX",
		name: "S&P 500",
		loading: false,
	}),
}));

import { useQuery } from "@apollo/client";

describe("BenchmarkMetricsBar", () => {
	it("renders null when benchmarkMode is none", () => {
		const { container } = render(
			<BenchmarkMetricsBar portfolioID="port-123" benchmarkMode="none" />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders Excess Return, Jensen Alpha, Beta, Correlation, TE, and IR", () => {
		vi.mocked(useQuery).mockReturnValue({
			data: {
				benchmarkComparison: {
					portfolioReturn: 5.25,
					benchmarkReturn: 3.1,
					alpha: 2.15, // Excess Return (TWR)
					riskAdjustedAlpha: 1.84, // Jensen's Alpha (CAPM annualized)
					beta: 1.05,
					correlation: 0.92,
					trackingError: 3.45,
					informationRatio: 0.62,
					outperformancePeriods: [],
				},
			},
			loading: false,
			error: undefined,
			// biome-ignore lint/suspicious/noExplicitAny: mock
		} as any);

		render(<BenchmarkMetricsBar portfolioID="port-123" benchmarkMode="sp500" />);

		// Verify Excess Return
		expect(screen.getByText("Excess Return")).toBeInTheDocument();
		expect(screen.getByText("+2.15%")).toBeInTheDocument();

		// Verify Jensen's Alpha
		expect(screen.getByText("Alpha (α)")).toBeInTheDocument();
		expect(screen.getByText("+1.84%/yr")).toBeInTheDocument();

		// Verify Beta, Correlation, TE, IR
		expect(screen.getByText("β")).toBeInTheDocument();
		expect(screen.getByText("1.05")).toBeInTheDocument();

		expect(screen.getByText("ρ")).toBeInTheDocument();
		expect(screen.getByText("0.92")).toBeInTheDocument();

		expect(screen.getByText("TE")).toBeInTheDocument();
		expect(screen.getByText("3.45%")).toBeInTheDocument();

		expect(screen.getByText("IR")).toBeInTheDocument();
		expect(screen.getByText("+0.62")).toBeInTheDocument();
	});

	it("renders negative values with loss styling", () => {
		vi.mocked(useQuery).mockReturnValue({
			data: {
				benchmarkComparison: {
					portfolioReturn: 2.0,
					benchmarkReturn: 5.0,
					alpha: -3.0,
					riskAdjustedAlpha: -2.5,
					beta: 0.85,
					correlation: 0.75,
					trackingError: 4.1,
					informationRatio: -0.73,
					outperformancePeriods: [],
				},
			},
			loading: false,
			error: undefined,
			// biome-ignore lint/suspicious/noExplicitAny: mock
		} as any);

		render(<BenchmarkMetricsBar portfolioID="port-123" benchmarkMode="sp500" />);

		const excessReturnEl = screen.getByText("-3.00%");
		expect(excessReturnEl).toHaveClass("text-loss");

		const alphaEl = screen.getByText("-2.50%/yr");
		expect(alphaEl).toHaveClass("text-loss");
	});
});
