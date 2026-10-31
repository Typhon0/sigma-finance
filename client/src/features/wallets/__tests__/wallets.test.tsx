import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddWalletDialog } from "../components/AddWalletDialog";
import { AlchemySettingsCard } from "../components/AlchemySettingsCard";
import { DeFiReviewQueueBanner } from "../components/DeFiReviewQueueBanner";
import { GET_WALLET_CU_USAGE, GET_PENDING_WALLET_REVIEWS, GET_WALLET_DEVICES } from "@/graphql/queries/wallets";

// Mock usePortfolio
vi.mock("@/components/PortfolioProvider", () => ({
	usePortfolio: () => ({
		currentPortfolio: "port-123",
		data: {
			portfolios: [
				{ id: "port-123", name: "Crypto Portfolio" },
				{ id: "port-456", name: "Savings Portfolio" },
			],
		},
	}),
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
			</MockedProvider>
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
			</MockedProvider>
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
			</MockedProvider>
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
			</MockedProvider>
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
			</MockedProvider>
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
});
