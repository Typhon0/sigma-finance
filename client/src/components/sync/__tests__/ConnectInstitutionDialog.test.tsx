import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectInstitutionDialog } from "../ConnectInstitutionDialog";

describe("ConnectInstitutionDialog", () => {
	it("renders provider options for Kraken, Trade Republic, and European Banks", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);
		expect(screen.getByText(/Kraken/i)).toBeInTheDocument();
		expect(screen.getByText(/Trade Republic/i)).toBeInTheDocument();
		expect(screen.getByText(/European Banks/i)).toBeInTheDocument();
	});

	it("renders Kraken API credentials form with key and secret fields", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const apiKeyInput = screen.getByLabelText(/API Key \*/i);
		const apiSecretInput = screen.getByLabelText(/Private Key \(Secret\) \*/i);

		expect(apiKeyInput).toBeInTheDocument();
		expect(apiSecretInput).toBeInTheDocument();
		expect(apiSecretInput).toHaveAttribute("type", "password");

		// Toggle secret visibility
		const toggleBtn = screen.getByRole("button", { name: /show secret/i });
		fireEvent.click(toggleBtn);
		expect(apiSecretInput).toHaveAttribute("type", "text");
	});

	it("renders account mapping radio controls", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		expect(
			screen.getByText(/Auto-create a dedicated exchange account in this portfolio/i),
		).toBeInTheDocument();
	});

	it("switches tabs to Trade Republic and shows connection portal button", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const tradeRepublicTab = screen.getByRole("tab", { name: /Trade Republic/i });
		fireEvent.click(tradeRepublicTab);

		expect(screen.getByRole("button", { name: /Connect.*SnapTrade/i })).toBeInTheDocument();
		expect(screen.getByText(/Interactive Brokers, Robinhood, Degiro/i)).toBeInTheDocument();
	});

	it("switches tabs to European Banks and shows open banking gateway button", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const banksTab = screen.getByRole("tab", { name: /European Banks/i });
		fireEvent.click(banksTab);

		expect(screen.getByRole("button", { name: /Connect via Open Banking/i })).toBeInTheDocument();
		expect(screen.getByText(/2,500\+ financial institutions in 31 countries/i)).toBeInTheDocument();
	});

	it("invokes onOpenChange(false) when clicking Cancel", () => {
		const onOpenChange = vi.fn();
		render(
			<ConnectInstitutionDialog open={true} onOpenChange={onOpenChange} portfolioId="port-1" />,
		);

		const cancelButtons = screen.getAllByRole("button", { name: /Cancel/i });
		fireEvent.click(cancelButtons[0]);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders waiting for authorization step when pendingSession is restored from sessionStorage", () => {
		sessionStorage.setItem(
			"sigma_pending_aggregator_auth",
			JSON.stringify({
				provider: "SNAPTRADE",
				sessionToken: "session-xyz",
				link: "https://example.com/portal",
				portfolioId: "port-1",
			}),
		);

		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		expect(screen.getByText(/Waiting for authorization\.\.\./i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Complete Connection/i })).toBeInTheDocument();

		sessionStorage.removeItem("sigma_pending_aggregator_auth");
	});
});
