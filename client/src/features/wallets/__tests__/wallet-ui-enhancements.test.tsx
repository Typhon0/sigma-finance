import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsList } from "@/components/AccountsList";
import { CreateAccountDialog } from "@/components/account/CreateAccountDialog";
import { CryptoList } from "@/components/assets/crypto/CryptoList";
import { ConnectInstitutionDialog } from "@/components/sync/ConnectInstitutionDialog";
import { GET_ACCOUNTS } from "@/graphql/queries/accounts";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import { GET_PENDING_WALLET_REVIEWS, GET_WALLET_ACCOUNTS } from "@/graphql/queries/wallets";

// Mock resize-observer and echarts
vi.mock("@/components/charts/EChart", () => ({
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

describe("Wallet UI Enhancements Integration", () => {
	const mockAccounts = [
		{
			id: "acc-1",
			portfolioId: "port-1",
			name: "Ledger Cold Storage",
			type: "CRYPTO_WALLET",
			taxWrapper: "STANDARD_TAXABLE",
			institution: "Ledger",
			accountNumber: "0x71C...3a9",
			currency: "EUR",
			syncProvider: "ALCHEMY",
			externalId: null,
			syncConnection: null,
			positionsCount: 2,
			totalValue: 25000,
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
				query: GET_WALLET_ACCOUNTS,
				variables: { portfolioId: "port-1" },
			},
			result: {
				data: {
					walletAccounts: [
						{
							id: "w-1",
							portfolioId: "port-1",
							network: "ETHEREUM",
							addressOrXpub: "0x71C...3a9",
							isXpub: false,
							label: "Ledger Cold Storage",
							isActive: true,
							lastSyncAt: "2026-10-28T22:00:00Z",
							historyStatus: "READY",
							lastSyncError: null,
							balances: [],
						},
					],
				},
			},
		},
		{
			request: {
				query: GET_PENDING_WALLET_REVIEWS,
				variables: { portfolioId: "port-1" },
			},
			result: {
				data: { pendingWalletReviews: [] },
			},
		},
		{
			request: {
				query: GET_SYNC_CONNECTIONS,
				variables: { portfolioId: "port-1" },
			},
			result: {
				data: { syncConnections: [] },
			},
		},
	];

	it("renders AccountsList with dedicated 'Wallet' type and 'On-Chain Wallets' filter", async () => {
		const onSelectAccount = vi.fn();

		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<AccountsList onSelectAccount={onSelectAccount} />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getAllByText("Ledger Cold Storage").length).toBeGreaterThanOrEqual(1);
		});

		// Check on-chain wallet categorization
		expect(screen.getByText(/On-Chain Wallet • Crypto/i)).toBeInTheDocument();
	});

	it("renders CreateAccountDialog with On-Chain Crypto Wallet option and quick connect banner", async () => {
		const onOpenChange = vi.fn();

		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<CreateAccountDialog open={true} onOpenChange={onOpenChange} portfolioId="port-1" />
			</MockedProvider>,
		);

		expect(screen.getByText("New Financial Account")).toBeInTheDocument();
		expect(screen.getByText("Want to sync balances & trades automatically?")).toBeInTheDocument();
	});

	it("renders ConnectInstitutionDialog with Crypto Wallets tab and 7 supported networks", async () => {
		const onOpenChange = vi.fn();

		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<ConnectInstitutionDialog open={true} onOpenChange={onOpenChange} portfolioId="port-1" />
			</MockedProvider>,
		);

		// Verify the Crypto Wallets tab trigger is present
		const walletTabTrigger = screen.getByRole("tab", { name: /Crypto Wallets/i });
		expect(walletTabTrigger).toBeInTheDocument();

		// Switch to Crypto Wallets tab
		fireEvent.click(walletTabTrigger);

		// Verify supported blockchains are showcased
		expect(screen.getByText("Supported Blockchains & Networks (7)")).toBeInTheDocument();
		expect(screen.getByText("Ethereum")).toBeInTheDocument();
		expect(screen.getByText("Base")).toBeInTheDocument();
		expect(screen.getByText("Arbitrum")).toBeInTheDocument();
		expect(screen.getByText("Optimism")).toBeInTheDocument();
		expect(screen.getByText("Polygon PoS")).toBeInTheDocument();
		expect(screen.getByText("Solana")).toBeInTheDocument();
		expect(screen.getByText("Bitcoin")).toBeInTheDocument();
		expect(screen.getByText("Connect On-Chain Wallet")).toBeInTheDocument();
	});

	it("renders CryptoList empty state with dual-path options to Connect On-Chain Wallet and Add Position Manually", async () => {
		render(
			<MockedProvider mocks={createMocks()} addTypename={false}>
				<CryptoList />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(screen.getByText("No crypto positions")).toBeInTheDocument();
		});

		expect(screen.getByText("Connect On-Chain Wallet")).toBeInTheDocument();
		expect(screen.getByText("Add Position Manually")).toBeInTheDocument();
		expect(screen.getByText("Supported Networks:")).toBeInTheDocument();
	});
});
