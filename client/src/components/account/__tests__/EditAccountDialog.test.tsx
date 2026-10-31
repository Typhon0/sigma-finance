import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UPDATE_ACCOUNT } from "@/graphql/mutations/accounts";
import { EditAccountDialog } from "../EditAccountDialog";

describe("EditAccountDialog", () => {
	const mockAccount = {
		id: "acc-456",
		name: "Kraken Trading",
		type: "CEX",
		taxWrapper: "CRYPTO_VAULT",
		institution: "Kraken",
		accountNumber: "KRAKEN-01",
		currency: "EUR",
	};

	it("pre-populates form fields with account data", () => {
		render(
			<EditAccountDialog
				open={true}
				onOpenChange={vi.fn()}
				account={mockAccount}
				portfolioId="port-1"
			/>,
		);

		expect(screen.getByLabelText(/Account Name \*/i)).toHaveValue("Kraken Trading");
		expect(screen.getByLabelText(/Institution/i)).toHaveValue("Kraken");
		expect(screen.getByLabelText(/Account Number \/ ID/i)).toHaveValue("KRAKEN-01");
	});

	it("submits updateAccount mutation with modified values", async () => {
		const onSuccess = vi.fn();
		const onOpenChange = vi.fn();

		const mocks = [
			{
				request: {
					query: UPDATE_ACCOUNT,
					variables: {
						id: "acc-456",
						input: {
							name: "Kraken Prime",
							type: "CRYPTO_EXCHANGE",
							taxWrapper: "CRYPTO_VAULT",
							institution: "Kraken Global",
							accountNumber: "KRAKEN-01",
							currency: "EUR",
						},
					},
				},
				result: {
					data: {
						updateAccount: {
							id: "acc-456",
							name: "Kraken Prime",
							type: "CRYPTO_EXCHANGE",
							taxWrapper: "CRYPTO_VAULT",
							institution: "Kraken Global",
							accountNumber: "KRAKEN-01",
							currency: "EUR",
							syncProvider: "KRAKEN",
							externalId: "ext-1",
							syncConnection: null,
							positionsCount: 2,
							totalValue: 5000,
							createdAt: "2026-01-01T00:00:00Z",
							updatedAt: "2026-01-01T00:00:00Z",
							portfolioId: "port-1",
						},
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<EditAccountDialog
					open={true}
					onOpenChange={onOpenChange}
					account={mockAccount}
					portfolioId="port-1"
					onSuccess={onSuccess}
				/>
			</MockedProvider>,
		);

		const nameInput = screen.getByLabelText(/Account Name \*/i);
		fireEvent.change(nameInput, { target: { value: "Kraken Prime" } });

		const instInput = screen.getByLabelText(/Institution/i);
		fireEvent.change(instInput, { target: { value: "Kraken Global" } });

		const submitBtn = screen.getByRole("button", { name: /Save Changes/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled();
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});
});
