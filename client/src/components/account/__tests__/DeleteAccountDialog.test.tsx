import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DELETE_ACCOUNT } from "@/graphql/mutations/accounts";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { DeleteAccountDialog } from "../DeleteAccountDialog";

describe("DeleteAccountDialog", () => {
	it("renders confirmation title and account name warning", () => {
		render(
			<DeleteAccountDialog
				open={true}
				onOpenChange={vi.fn()}
				accountId="acc-123"
				accountName="Main Brokerage"
				portfolioId="port-1"
			/>,
		);

		expect(screen.getByRole("heading", { name: "Delete Account" })).toBeInTheDocument();
		expect(screen.getByText("Main Brokerage")).toBeInTheDocument();
		expect(
			screen.getByText(
				/All associated positions and holdings in this account will be permanently removed/i,
			),
		).toBeInTheDocument();
	});

	it("calls onOpenChange(false) when cancel button is clicked", () => {
		const onOpenChange = vi.fn();
		render(
			<DeleteAccountDialog
				open={true}
				onOpenChange={onOpenChange}
				accountId="acc-123"
				accountName="Main Brokerage"
				portfolioId="port-1"
			/>,
		);

		const cancelBtn = screen.getByRole("button", { name: /cancel/i });
		fireEvent.click(cancelBtn);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("calls deleteAccount mutation and onSuccess callback on confirm", async () => {
		const onSuccess = vi.fn();
		const onOpenChange = vi.fn();

		const mocks = [
			{
				request: {
					query: DELETE_ACCOUNT,
					variables: { id: "acc-123" },
				},
				result: {
					data: { deleteAccount: true },
				},
			},
			{
				request: {
					query: GET_ACCOUNTS,
					variables: { portfolioId: "port-1" },
				},
				result: {
					data: { accounts: [] },
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<DeleteAccountDialog
					open={true}
					onOpenChange={onOpenChange}
					accountId="acc-123"
					accountName="Main Brokerage"
					portfolioId="port-1"
					onSuccess={onSuccess}
				/>
			</MockedProvider>,
		);

		const deleteBtn = screen.getByRole("button", { name: "Delete Account" });
		fireEvent.click(deleteBtn);

		await waitFor(() => {
			expect(onSuccess).toHaveBeenCalled();
			expect(onOpenChange).toHaveBeenCalledWith(false);
		});
	});
});
