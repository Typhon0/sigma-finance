import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	GET_PENDING_WALLET_REVIEWS,
	GET_WALLET_CU_USAGE,
	GET_WALLET_DEVICES,
} from "@/graphql/queries/wallets";
import { ADD_MULTI_CHAIN_WALLET } from "@/graphql/mutations/wallets";
import { BlockchainNetwork, WalletDeviceType } from "@/gql/graphql";
import { AddWalletDialog, toSafeAddressString } from "../components/AddWalletDialog";
import { AlchemySettingsCard } from "../components/AlchemySettingsCard";
import { DeFiReviewQueueBanner } from "../components/DeFiReviewQueueBanner";

// Mock usePortfolio
let mockPortfoliosState = {
	currentPortfolio: "port-123",
	portfolios: [
		{ id: "port-123", name: "Crypto Portfolio" },
		{ id: "port-456", name: "Savings Portfolio" },
	],
	data: {
		portfolios: [
			{ id: "port-123", name: "Crypto Portfolio" },
			{ id: "port-456", name: "Savings Portfolio" },
		],
	},
};

vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => mockPortfoliosState,
}));

describe("AlchemySettingsCard", () => {
	it("renders CU consumption and quota progress correctly", async () => {
		const mocks = [
			{
				request: {
					query: GET_WALLET_CU_USAGE,
				},
				result: {
					data: {
						walletCUUsage: {
							billingMonth: "2026-10",
							consumedUnits: 3000000,
							maxQuota: 30000000,
							isThrottled: false,
						},
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AlchemySettingsCard />
			</MockedProvider>,
		);

		expect(await screen.findByText(/Alchemy API & Compute Unit Meter/i)).toBeInTheDocument();
		expect(await screen.findByText(/Billing Cycle: 2026-10/i)).toBeInTheDocument();
		expect(screen.getByText(/3.0M \/ 30.0M CUs \(10%\)/i)).toBeInTheDocument();
		expect(screen.getByText(/Healthy Quota Headroom/i)).toBeInTheDocument();
	});

	it("renders throttled alert when quota exceeded", async () => {
		const mocks = [
			{
				request: {
					query: GET_WALLET_CU_USAGE,
				},
				result: {
					data: {
						walletCUUsage: {
							billingMonth: "2026-10",
							consumedUnits: 25000000,
							maxQuota: 30000000,
							isThrottled: true,
						},
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AlchemySettingsCard />
			</MockedProvider>,
		);

		expect(await screen.findByText(/Quota Conservation Active/i)).toBeInTheDocument();
		expect(screen.getByText(/25.0M \/ 30.0M CUs \(83%\)/i)).toBeInTheDocument();
	});
});

describe("DeFiReviewQueueBanner", () => {
	it("renders staged transactions when reviews exist", async () => {
		const mocks = [
			{
				request: {
					query: GET_PENDING_WALLET_REVIEWS,
					variables: { portfolioId: "port-123" },
				},
				result: {
					data: {
						pendingWalletReviews: [
							{
								id: "rev-1",
								walletActivityId: "act-1",
								reviewStatus: "PENDING",
								suggestedType: "COMPLEX_DEFI",
								notes: "Uniswap V3 LP mint transaction",
								createdAt: "2026-10-28T12:00:00Z",
							},
						],
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<DeFiReviewQueueBanner portfolioId="port-123" />
			</MockedProvider>,
		);

		expect(await screen.findByText(/DeFi Activity Review Queue/i)).toBeInTheDocument();
		expect(screen.getByText(/1 Pending/i)).toBeInTheDocument();
		expect(screen.getByText(/Uniswap V3 LP mint transaction/i)).toBeInTheDocument();
		expect(screen.getByText(/Approve/i)).toBeInTheDocument();
		expect(screen.getByText(/Dismiss/i)).toBeInTheDocument();
	});

	it("renders nothing when there are no reviews", async () => {
		const mocks = [
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
		];

		const { container } = render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<DeFiReviewQueueBanner portfolioId="port-123" />
			</MockedProvider>,
		);

		await waitFor(() => {
			expect(container.firstChild).toBeNull();
		});
	});
});

describe("AddWalletDialog", () => {
	it("renders tabs and validates EVM addresses", async () => {
		const mocks = [
			{
				request: {
					query: GET_WALLET_DEVICES,
				},
				result: {
					data: {
						walletDevices: [],
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AddWalletDialog open={true} onOpenChange={() => {}} portfolioId="port-123" />
			</MockedProvider>,
		);

		expect(screen.getByText(/Connect Crypto Wallet/i)).toBeInTheDocument();
		expect(screen.getByText(/Single Address/i)).toBeInTheDocument();
		expect(screen.getByText(/Multi-Chain Device/i)).toBeInTheDocument();

		const input = screen.getByPlaceholderText(/0x\.\.\./i);
		expect(input).toBeInTheDocument();

		// Enter invalid address
		fireEvent.change(input, { target: { value: "invalid-address" } });
		expect(await screen.findByText(/Must be a 42-character hex address/i)).toBeInTheDocument();

		// Enter valid EVM address
		fireEvent.change(input, { target: { value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" } });
		expect(await screen.findByText(/Valid EVM address/i)).toBeInTheDocument();
	});

	it("renders safely without crashing when no portfolios are available", async () => {
		mockPortfoliosState = {
			currentPortfolio: "",
			portfolios: [],
			data: { portfolios: [] },
		};

		const mocks = [
			{
				request: {
					query: GET_WALLET_DEVICES,
				},
				result: {
					data: {
						walletDevices: [],
					},
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AddWalletDialog open={true} onOpenChange={() => {}} />
			</MockedProvider>,
		);

		expect(screen.getByText(/Connect Crypto Wallet/i)).toBeInTheDocument();
		expect(screen.getAllByText(/Target Portfolio/i).length).toBeGreaterThan(0);
	});

	it("renders mobile wallet links and opens WalletConnect QR modal with 1-tap mobile options", async () => {
		mockPortfoliosState = {
			currentPortfolio: "port-123",
			portfolios: [{ id: "port-123", name: "Crypto Portfolio" }],
			data: { portfolios: [{ id: "port-123", name: "Crypto Portfolio" }] },
		};

		const mocks = [
			{
				request: {
					query: GET_WALLET_DEVICES,
				},
				result: {
					data: {
						walletDevices: [],
					},
				},
			},
		];

		const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AddWalletDialog open={true} onOpenChange={() => {}} portfolioId="port-123" />
			</MockedProvider>,
		);

		// Mobile deep linking hub should be rendered
		const toggleMobileBtn = screen.getByText(/Connexion Mobile \(Deep Links\)/i);
		expect(toggleMobileBtn).toBeInTheDocument();
		expect(screen.getByText(/14\+ wallets supportés/i)).toBeInTheDocument();

		// Click toggle to expand mobile direct links
		fireEvent.click(toggleMobileBtn);

		const phantomMobileBtn = screen.getByTitle(/Ouvrir dans l'application Phantom/i);
		expect(phantomMobileBtn).toBeInTheDocument();
		fireEvent.click(phantomMobileBtn);
		expect(windowOpenSpy).toHaveBeenCalled();

		// Click WalletConnect button
		const wcBtn = screen.getByText(/Scanner QR Code \(WalletConnect\)/i);
		expect(wcBtn).toBeInTheDocument();
		fireEvent.click(wcBtn);

		// Sub-modal should be visible
		expect(screen.getByText(/Scanner avec votre Wallet Mobile/i)).toBeInTheDocument();
		expect(screen.getByText(/Copier l'URI/i)).toBeInTheDocument();
		expect(screen.getByText(/App par défaut \(Universel\)/i)).toBeInTheDocument();
		expect(screen.getByTitle(/Ouvrir avec Phantom/i)).toBeInTheDocument();
		expect(screen.getByTitle(/Ouvrir avec MetaMask/i)).toBeInTheDocument();

		windowOpenSpy.mockRestore();
	});

	it("submits multi-chain wallet mutation successfully", async () => {
		mockPortfoliosState = {
			currentPortfolio: "port-123",
			portfolios: [{ id: "port-123", name: "Crypto Portfolio" }],
			data: { portfolios: [{ id: "port-123", name: "Crypto Portfolio" }] },
		};

		let mutationCalled = false;
		const mocks = [
			{
				request: {
					query: GET_WALLET_DEVICES,
				},
				result: {
					data: {
						walletDevices: [],
					},
				},
			},
			{
				request: {
					query: ADD_MULTI_CHAIN_WALLET,
					variables: {
						input: {
							portfolioId: "port-123",
							name: "Phantom Wallet",
							deviceType: WalletDeviceType.Software,
							evmAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
							evmNetworks: [
								BlockchainNetwork.Ethereum,
								BlockchainNetwork.Base,
								BlockchainNetwork.Arbitrum,
								BlockchainNetwork.Optimism,
								BlockchainNetwork.Polygon,
							],
							solanaAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
							bitcoinAddressOrXpub: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
						},
					},
				},
				result: () => {
					mutationCalled = true;
					return {
						data: {
							addMultiChainWallet: {
								id: "dev-123",
								name: "Phantom Multi-Chain",
								deviceType: WalletDeviceType.Software,
								accounts: [
									{
										id: "acc-1",
										network: BlockchainNetwork.Ethereum,
										addressOrXpub: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
										label: "Phantom (Ethereum)",
										capabilityLevel: "BALANCE_ONLY",
										lastSyncAt: null,
									},
								],
								createdAt: "2026-11-06T12:00:00Z",
								updatedAt: "2026-11-06T12:00:00Z",
							},
						},
					};
				},
			},
		];

		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<AddWalletDialog open={true} onOpenChange={() => {}} portfolioId="port-123" />
			</MockedProvider>,
		);

		// Enter EVM address
		const evmInput = screen.getByPlaceholderText(/0x\.\.\./i);
		fireEvent.change(evmInput, {
			target: { value: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
		});

		// Enter Solana address
		const solanaInput = screen.getByPlaceholderText(/Clé publique Solana/i);
		fireEvent.change(solanaInput, {
			target: { value: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" },
		});

		// Enter Bitcoin address
		const btcInput = screen.getByPlaceholderText(/bc1q\.\.\./i);
		fireEvent.change(btcInput, {
			target: { value: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" },
		});

		// Submit form
		const submitBtn = screen.getByText(/Ajouter le portefeuille multi-chaînes/i);
		expect(submitBtn).toBeEnabled();
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(mutationCalled).toBe(true);
		});
	});

	it("toSafeAddressString safely extracts string address and prevents multiBtcAddress.trim crash", () => {
		expect(toSafeAddressString("bc1qabc123")).toBe("bc1qabc123");
		expect(toSafeAddressString({ address: "bc1qxyz789" })).toBe("bc1qxyz789");
		expect(toSafeAddressString({ publicKey: "9WzDXwBbmkg8" })).toBe("9WzDXwBbmkg8");
		expect(toSafeAddressString(null)).toBe("");
		expect(toSafeAddressString(undefined)).toBe("");
		expect(toSafeAddressString(123)).toBe("");
		expect(toSafeAddressString({})).toBe("");
	});
});
