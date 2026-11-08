import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectInstitutionDialog } from "../ConnectInstitutionDialog";

// Mock PortfolioProvider context
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: vi.fn(() => ({
		currentPortfolio: { id: "port-1", name: "Main Portfolio" },
		refetchPortfolio: vi.fn(),
	})),
}));

describe("ConnectInstitutionDialog", () => {
	it("renders provider options for Trade Republic, SnapTrade, Kraken, and European Banks", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);
		expect(screen.getByRole("tab", { name: /Trade Republic/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /SnapTrade \(IBKR, etc\.\)/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /Kraken/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /European Banks/i })).toBeInTheDocument();
	});

	it("renders Trade Republic credentials form with phone number and PIN fields", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const phoneInput = screen.getByLabelText(/Phone Number \*/i);
		const pinInput = screen.getByLabelText(/4-Digit App PIN \*/i);

		expect(phoneInput).toBeInTheDocument();
		expect(pinInput).toBeInTheDocument();
		expect(pinInput).toHaveAttribute("type", "password");

		// Toggle PIN visibility
		const toggleBtn = screen.getByRole("button", { name: /show pin/i });
		fireEvent.click(toggleBtn);
		expect(pinInput).toHaveAttribute("type", "text");
	});

	it("renders Kraken API credentials form with key and secret fields", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const krakenTab = screen.getByRole("tab", { name: /Kraken/i });
		fireEvent.click(krakenTab);

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

	it("switches tabs to SnapTrade broker aggregator and shows portal button", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const snapTradeTab = screen.getByRole("tab", { name: /SnapTrade/i });
		fireEvent.click(snapTradeTab);

		expect(screen.getByRole("button", { name: /Connect via SnapTrade/i })).toBeInTheDocument();
		expect(screen.getByText(/Interactive Brokers, Robinhood, Degiro/i)).toBeInTheDocument();
	});

	it("switches tabs to European Banks and shows open banking gateway button", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const banksTab = screen.getByRole("tab", { name: /European Banks/i });
		fireEvent.click(banksTab);

		expect(screen.getByRole("button", { name: /Connect via Open Banking/i })).toBeInTheDocument();
		expect(screen.getByText(/2,500\+ financial institutions in 31 countries/i)).toBeInTheDocument();
	});

	it("switches tabs to Enable Banking and shows institution search and country selector", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const ebTab = screen.getByRole("tab", { name: /Enable Banking/i });
		fireEvent.click(ebTab);

		expect(screen.getByText(/European Bank Aggregation \(Enable Banking\)/i)).toBeInTheDocument();
		expect(screen.getByText(/PSD2 Open Banking · €0\/mo Personal/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/BNP Paribas/i)).toBeInTheDocument();
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

	it("switches to Woob direct French banks tab and displays bank grid and credentials", () => {
		render(<ConnectInstitutionDialog open={true} onOpenChange={vi.fn()} portfolioId="port-1" />);

		const woobTab = screen.getByRole("tab", { name: /Banques FR \(Woob\)/i });
		fireEvent.click(woobTab);

		expect(screen.getByText(/Synchronisation Universelle & Patrimoine Complet \(Woob Engine\)/i)).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Rechercher une banque/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Identifiant client \*/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Mot de passe \/ Code d'accès \*/i)).toBeInTheDocument();
	});
});
