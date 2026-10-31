import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConnectedAccountsManager } from "../ConnectedAccountsManager";
import { GET_SYNC_CONNECTIONS } from "@/graphql/queries/sync";
import {
	GET_WALLET_ACCOUNTS,
	GET_WALLET_CU_USAGE,
	GET_PENDING_WALLET_REVIEWS,
} from "@/graphql/queries/wallets";
import { TRIGGER_ACCOUNT_SYNC } from "@/graphql/mutations/sync";
import { TRIGGER_WALLET_SYNC } from "@/graphql/mutations/wallets";

// Mock usePortfolio
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		currentPortfolio: { id: "port-123", name: "Crypto Portfolio" },
		portfolios: [{ id: "port-123", name: "Crypto Portfolio" }],
	}),
}));

const mockSyncConnections = [
	{
		id: "conn-1",
		portfolioId: "port-123",
		accountId: "acc-tradfi-1",
		provider: "KRAKEN",
		externalInstitutionId: "kraken-main",
		externalAccountId: "kraken-spot",
		institutionName: "Kraken Exchange",
		syncStatus: "SUCCESS",
		lastSyncAt: "2026-10-29T10:00:00Z",
		lastError: null,
		createdAt: "2026-10-25T12:00:00Z",
		updatedAt: "2026-10-29T10:00:00Z",
		account: {
			id: "acc-tradfi-1",
			name: "Kraken Spot Account",
			institution: "Kraken",
		},
	},
];

const mockWalletAccounts = [
	{
		id: "wacc-sol-1",
		portfolioId: "port-123",
		network: "SOLANA",
		addressOrXpub: "6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx",
		isXpub: false,
		label: "Phantom Main",
		isActive: true,
		lastSyncAt: "2026-10-29T00:06:26Z",
		historyStatus: "SYNCED",
		lastSyncError: null,
		balances: [
			{
				id: "bal-sol",
				symbol: "SOL",
				name: "Solana",
				decimals: 9,
				formattedQuantity: 5.625,
				rawBalance: "5625000000",
				tokenAddress: null,
				isSpam: false,
				isHidden: false,
				isStale: false,
				lastUpdatedAt: "2026-10-29T00:06:26Z",
			},
			{
				id: "bal-usdc",
				symbol: "USDC",
				name: "USD Coin",
				decimals: 6,
				formattedQuantity: 384.42,
				rawBalance: "384420000",
				tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				isSpam: false,
				isHidden: false,
				isStale: false,
				lastUpdatedAt: "2026-10-29T00:06:26Z",
			},
		],
		createdAt: "2026-10-28T22:00:00Z",
		updatedAt: "2026-10-29T00:06:26Z",
	},
];

const mockCUUsage = {
	billingMonth: "2026-10",
	consumedUnits: 1500000,
	maxQuota: 30000000,
	isThrottled: false,
	hasKey: true,
	keySource: "ENV",
	maskedKey: "alch_6Qn••••••••iBCf",
};

const mocks = [
	{
		request: {
			query: GET_SYNC_CONNECTIONS,
			variables: { portfolioId: "port-123" },
		},
		result: {
			data: {
				syncConnections: mockSyncConnections,
			},
		},
	},
	{
		request: {
			query: GET_WALLET_ACCOUNTS,
			variables: { portfolioId: "port-123" },
		},
		result: {
			data: {
				walletAccounts: mockWalletAccounts,
			},
		},
	},
	{
		request: {
			query: GET_WALLET_CU_USAGE,
		},
		result: {
			data: {
				walletCUUsage: mockCUUsage,
			},
		},
	},
	{
		request: {
			query: GET_PENDING_WALLET_REVIEWS,
			variables: { portfolioId: "port-123" },
		},
		result: {
			data: {
				pendingWalletReviews: [],
			},
		},
	},
	{
		request: {
			query: TRIGGER_WALLET_SYNC,
			variables: { id: "wacc-sol-1" },
		},
		result: {
			data: {
				triggerWalletSync: true,
			},
		},
	},
	{
		request: {
			query: TRIGGER_ACCOUNT_SYNC,
			variables: { accountId: "acc-tradfi-1" },
		},
		result: {
			data: {
				triggerAccountSync: {
					id: "run-1",
					connectionId: "conn-1",
					status: "COMPLETED",
					itemsImported: 2,
					itemsUpdated: 0,
					errorMessage: null,
					startedAt: "2026-10-29T10:00:00Z",
					completedAt: "2026-10-29T10:01:00Z",
				},
			},
		},
	},
];

describe("ConnectedAccountsManager", () => {
	it("renders connected accounts KPIs and unified connection list", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ConnectedAccountsManager />
			</MockedProvider>
		);

		// Page title
		expect(await screen.findByText(/Connected Accounts & Wallets/i)).toBeInTheDocument();

		// Total connections KPI (1 TradFi + 1 Wallet = 2)
		expect(await screen.findByText("2")).toBeInTheDocument();
		expect(screen.getByText(/1 institution\(s\) TradFi · 1 wallet\(s\) on-chain/i)).toBeInTheDocument();

		// Health status
		expect(screen.getByText(/100% Opérationnel/i)).toBeInTheDocument();

		// Both items appear in the "All" view
		expect(await screen.findByText("Phantom Main")).toBeInTheDocument();
		expect(screen.getByText("SOLANA")).toBeInTheDocument();
		expect(screen.getByText("Kraken Exchange")).toBeInTheDocument();
		expect(screen.getByText("KRAKEN")).toBeInTheDocument();
	});

	it("expands wallet details and displays tokens list", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ConnectedAccountsManager />
			</MockedProvider>
		);

		// Verify Phantom Main wallet is in the list
		expect(await screen.findByText("Phantom Main")).toBeInTheDocument();

		// Expand tokens list
		const tokensToggle = await screen.findByRole("button", { name: /2 token\(s\)/i });
		fireEvent.click(tokensToggle);

		expect(await screen.findByText("SOL")).toBeInTheDocument();
		expect(screen.getByText("USDC")).toBeInTheDocument();
	});

	it("triggers wallet sync when clicking Sync Now", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ConnectedAccountsManager />
			</MockedProvider>
		);

		// Find individual Sync Now button
		const syncButtons = await screen.findAllByRole("button", { name: /Sync Now/i });
		expect(syncButtons.length).toBeGreaterThan(0);

		fireEvent.click(syncButtons[0]);
		await waitFor(() => {
			expect(screen.getByText(/Phantom Main/i)).toBeInTheDocument();
		});
	});

	it("renders Syncing status instead of Error when wallet account historyStatus is IN_PROGRESS", async () => {
		const inProgressWalletMocks = [
			mocks[0],
			{
				request: {
					query: GET_WALLET_ACCOUNTS,
					variables: { portfolioId: "port-123" },
				},
				result: {
					data: {
						walletAccounts: [
							{
								...mockWalletAccounts[0],
								historyStatus: "IN_PROGRESS",
								lastSyncError: null,
							},
						],
					},
				},
			},
			mocks[2],
			mocks[3],
		];

		render(
			<MockedProvider mocks={inProgressWalletMocks} addTypename={false}>
				<ConnectedAccountsManager />
			</MockedProvider>
		);

		expect(await screen.findByText("Phantom Main")).toBeInTheDocument();
		expect(screen.getByText("Syncing")).toBeInTheDocument();
		expect(screen.queryByText("Error")).not.toBeInTheDocument();

		const syncBtn = screen.getByRole("button", { name: /Syncing\.\.\./i });
		expect(syncBtn).toBeInTheDocument();
		expect(syncBtn).toBeDisabled();
	});

	it("copies wallet address to clipboard when clicking copy icon", async () => {
		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: {
				writeText: writeTextMock,
			},
		});

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ConnectedAccountsManager />
			</MockedProvider>
		);

		expect(await screen.findByText("Phantom Main")).toBeInTheDocument();

		const copyBtn = screen.getByRole("button", { name: /Copier l'adresse/i });
		expect(copyBtn).toBeInTheDocument();

		fireEvent.click(copyBtn);
		expect(writeTextMock).toHaveBeenCalledWith("6WoNTaashF9TXynLt8PMqo3MEV9ofEu1kApZvH31srx");
	});
});
