import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { AccountsList } from "../AccountsList";

// Mock resize-observer and echarts
vi.mock("echarts-for-react", () => ({
	default: () => <div data-testid="echarts-mock" />,
}));

vi.mock("@/hooks/use-currency", () => ({
	useCurrency: () => ({
		currency: "USD",
		formatCurrency: (val: number) => `$${val}`,
		formatCurrencyCompact: (val: number) => `$${val}`,
		formatCurrencyAdaptive: (val: number) => `$${val}`,
	}),
}));

// Mock PortfolioProvider
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		assets: [],
		currentPortfolio: "port-1",
		refetch: vi.fn(),
	}),
}));

describe("AccountsList actions", () => {
	const mockAccounts = [
		{
			id: "acc-1",
			portfolioId: "port-1",
			name: "Main Brokerage",
			type: "BROKER",
			taxWrapper: "STANDARD_TAXABLE",
			institution: "Interactive Brokers",
			accountNumber: "U1234567",
			currency: "EUR",
			syncProvider: null,
			externalId: null,
			syncConnection: null,
			positionsCount: 3,
			totalValue: 15000,
			createdAt: "2026-01-01T00:00:00Z",
			updatedAt: "2026-01-01T00:00:00Z",
		},
	];

	const createMocks = () => [
		{
			request: {
				query: GET_ACCOUNTS,
				variables: { portfolioId: "port-1" },
			},
			result: {
				data: { accounts: mockAccounts },
			},
		},
		{
			request: {
				query: GET_ACCOUNTS,
				variables: { portfolioId: "port-1" },
			},
			result: {
				data: { accounts: mockAccounts },
			},
		},
	];

	it("renders accounts and allows opening the action menu", async () => {
		const onSelectAccount = vi.fn();

		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<AccountsList onSelectAccount={onSelectAccount} />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText(/U1234567/)).toBeInTheDocument();
		});

		// Find more options trigger button
		const moreBtn = screen.getByRole("button", { name: /Account actions/i });
		expect(moreBtn).toBeDefined();

		fireEvent.keyDown(moreBtn, { key: "Enter" });
		await waitFor(() => {
			expect(screen.getByText("View Details")).toBeInTheDocument();
			expect(screen.getByText("Edit Account")).toBeInTheDocument();
			expect(screen.getByText("Delete")).toBeInTheDocument();
		});
	});

	it("opens Edit Account dialog when Edit Account is clicked", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<AccountsList onSelectAccount={vi.fn()} />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText(/U1234567/)).toBeInTheDocument();
		});

		const moreBtn = screen.getByRole("button", { name: /Account actions/i });
		fireEvent.keyDown(moreBtn, { key: "Enter" });

		await waitFor(() => {
			expect(screen.getByText("Edit Account")).toBeInTheDocument();
		});

		const editItem = screen.getByText("Edit Account");
		fireEvent.click(editItem);

		await waitFor(() => {
			expect(
				screen.getByText("Update details and classification for this financial account."),
			).toBeInTheDocument();
		});
	});

	it("opens Delete Account dialog when Delete is clicked", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<AccountsList onSelectAccount={vi.fn()} />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText(/U1234567/)).toBeInTheDocument();
		});

		const moreBtn = screen.getByRole("button", { name: /Account actions/i });
		fireEvent.keyDown(moreBtn, { key: "Enter" });

		await waitFor(() => {
			expect(screen.getByText("Delete")).toBeInTheDocument();
		});

		const deleteItem = screen.getByText("Delete");
		fireEvent.click(deleteItem);

		await waitFor(() => {
			expect(
				screen.getByText(
					/All associated positions and holdings in this account will be permanently removed/i,
				),
			).toBeInTheDocument();
		});
	});
});
