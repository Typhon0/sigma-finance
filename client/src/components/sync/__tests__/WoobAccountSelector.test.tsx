import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type DiscoveredWoobConnection, WoobAccountSelector } from "../WoobAccountSelector";

describe("WoobAccountSelector", () => {
	const mockConnections: DiscoveredWoobConnection[] = [
		{
			id: "conn-1",
			externalAccountId: "chk-1",
			institutionName: "BoursoBank",
			accountName: "Compte Courant Principal",
			accountType: "CHECKING",
			balance: 4520.5,
			currency: "EUR",
			accountNumber: "00012345678",
		},
		{
			id: "conn-2",
			externalAccountId: "liv-1",
			institutionName: "BoursoBank",
			accountName: "Livret A",
			accountType: "SAVINGS",
			balance: 22950,
			currency: "EUR",
			accountNumber: "00087654321",
		},
		{
			id: "conn-3",
			externalAccountId: "pea-1",
			institutionName: "BoursoBank",
			accountName: "PEA BoursoBank",
			accountType: "BROKERAGE",
			balance: 38450.2,
			currency: "EUR",
			accountNumber: "PEA-98765",
		},
		{
			id: "conn-4",
			externalAccountId: "av-1",
			institutionName: "BoursoBank",
			accountName: "BoursoVie (Fonds Euros + UC)",
			accountType: "INSURANCE",
			balance: 15400,
			currency: "EUR",
			accountNumber: "AV-45678",
		},
		{
			id: "conn-5",
			externalAccountId: "loan-1",
			institutionName: "BoursoBank",
			accountName: "Crédit Immobilier Résidence Principale",
			accountType: "LOAN",
			balance: -178500,
			currency: "EUR",
			accountNumber: "PRET-001",
		},
	];

	it("renders all discovered products with badges and formatted balances", () => {
		render(
			<WoobAccountSelector
				connections={mockConnections}
				institutionName="BoursoBank"
				onConfirm={vi.fn()}
				onCancel={vi.fn()}
				isSubmitting={false}
			/>,
		);

		expect(screen.getByText("Compte Courant Principal")).toBeInTheDocument();
		expect(screen.getByText("Livret A")).toBeInTheDocument();
		expect(screen.getByText("PEA BoursoBank")).toBeInTheDocument();
		expect(screen.getByText("BoursoVie (Fonds Euros + UC)")).toBeInTheDocument();
		expect(screen.getByText("Crédit Immobilier Résidence Principale")).toBeInTheDocument();
		expect(screen.getByText("Passif / Dette")).toBeInTheDocument();
		expect(screen.getByText("5 sur 5 compte(s) sélectionné(s)")).toBeInTheDocument();
	});

	it("allows deselecting and re-selecting individual accounts", () => {
		const handleConfirm = vi.fn();
		render(
			<WoobAccountSelector
				connections={mockConnections}
				institutionName="BoursoBank"
				onConfirm={handleConfirm}
				onCancel={vi.fn()}
				isSubmitting={false}
			/>,
		);

		const deselectAllBtn = screen.getByText("Tout désélectionner");
		fireEvent.click(deselectAllBtn);
		expect(screen.getByText("0 sur 5 compte(s) sélectionné(s)")).toBeInTheDocument();

		// Click on Livret A card to select it
		const livretCard = screen.getByText("Livret A");
		fireEvent.click(livretCard);
		expect(screen.getByText("1 sur 5 compte(s) sélectionné(s)")).toBeInTheDocument();

		// Submit confirmation
		const confirmBtn = screen.getByRole("button", { name: /Importer les comptes/i });
		fireEvent.click(confirmBtn);
		expect(handleConfirm).toHaveBeenCalledWith(["conn-2"]);
	});
});
