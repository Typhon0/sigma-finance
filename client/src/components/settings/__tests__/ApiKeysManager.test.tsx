import "@testing-library/jest-dom";
import { MockedProvider } from "@apollo/client/testing";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	UPSERT_MARKET_DATA_CREDENTIAL,
	VALIDATE_PROVIDER_CREDENTIALS,
} from "@/graphql/mutations/market-data";
import { CONFIGURE_ALCHEMY_KEY } from "@/graphql/mutations/wallets";
import { GET_MARKET_DATA_SETTINGS } from "@/graphql/queries/market-data";
import { GET_SYNC_CREDENTIALS } from "@/graphql/queries/sync";
import { GET_WALLET_CU_USAGE } from "@/graphql/queries/wallets";
import { ApiKeysManager } from "../ApiKeysManager";

const mockMarketDataSettings = {
	marketDataCredentials: [
		{
			id: "cred-tiingo",
			provider: "TIINGO",
			isEnabled: true,
			priority: 10,
			source: "DATABASE",
			lastValidatedAt: "2026-10-29T10:00:00Z",
			createdAt: "2026-10-25T10:00:00Z",
			updatedAt: "2026-10-29T10:00:00Z",
		},
	],
	supportedProviders: [
		{
			id: "TIINGO",
			name: "Tiingo",
			type: "MARKET_DATA",
			requiresKey: true,
			intervals: ["1d", "1h"],
			rateLimit: {
				requestsPerMinute: 60,
				requestsPerDay: 500,
				burstLimit: 10,
			},
			supportsRealtime: true,
		},
		{
			id: "FINNHUB",
			name: "Finnhub",
			type: "MARKET_DATA",
			requiresKey: true,
			intervals: ["1d"],
			rateLimit: {
				requestsPerMinute: 60,
				requestsPerDay: 1000,
				burstLimit: 15,
			},
			supportsRealtime: false,
		},
	],
	providerHealth: [
		{
			provider: "TIINGO",
			assetType: "STOCKS",
			healthy: true,
			apiKeyValid: true,
			lastChecked: "2026-10-29T10:00:00Z",
		},
	],
};

const mockSyncCredentials = {
	syncCredentials: [
		{
			id: "sc-kraken",
			provider: "KRAKEN",
			status: "ACTIVE",
			source: "DATABASE",
			createdAt: "2026-10-25T10:00:00Z",
			updatedAt: "2026-10-29T10:00:00Z",
		},
	],
};

const mockCUUsage = {
	walletCUUsage: {
		billingMonth: "2026-10",
		consumedUnits: 1250000,
		maxQuota: 30000000,
		isThrottled: false,
		hasKey: true,
		keySource: "ENV",
		maskedKey: "alch_6Qn••••••••iBCf",
	},
};

const mocks = [
	{
		request: {
			query: GET_MARKET_DATA_SETTINGS,
			variables: { assetType: null },
		},
		result: {
			data: mockMarketDataSettings,
		},
	},
	{
		request: {
			query: GET_SYNC_CREDENTIALS,
		},
		result: {
			data: mockSyncCredentials,
		},
	},
	{
		request: {
			query: GET_WALLET_CU_USAGE,
		},
		result: {
			data: mockCUUsage,
		},
	},
	{
		request: {
			query: VALIDATE_PROVIDER_CREDENTIALS,
			variables: {
				provider: "FINNHUB",
				apiKey: "test-finnhub-key",
			},
		},
		result: {
			data: {
				validateProviderCredentials: {
					valid: true,
					message: "Connection verified",
				},
			},
		},
	},
	{
		request: {
			query: UPSERT_MARKET_DATA_CREDENTIAL,
			variables: {
				provider: "FINNHUB",
				apiKey: "test-finnhub-key",
				priority: 100,
				isEnabled: true,
			},
		},
		result: {
			data: {
				upsertMarketDataCredential: {
					id: "cred-finnhub",
					provider: "FINNHUB",
					isEnabled: true,
					priority: 100,
					lastValidatedAt: null,
					createdAt: "2026-10-29T11:00:00Z",
					updatedAt: "2026-10-29T11:00:00Z",
				},
			},
		},
	},
];

describe("ApiKeysManager", () => {
	it("renders header, KPI ribbon, and provider cards", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ApiKeysManager />
			</MockedProvider>,
		);

		// Check header title
		expect(await screen.findByText("API Keys & Integrations")).toBeInTheDocument();

		// Check KPI cards
		expect(screen.getByText("Configured Providers")).toBeInTheDocument();
		expect(screen.getByText("Alchemy Web3 CU Quota")).toBeInTheDocument();
		expect(screen.getByText("System Integration Health")).toBeInTheDocument();

		// Check providers
		expect(await screen.findByText("Tiingo")).toBeInTheDocument();
		expect(screen.getByText("Finnhub")).toBeInTheDocument();
		expect(screen.getByText("Alchemy API & Compute Unit Meter")).toBeInTheDocument();
		expect(screen.getByText("Kraken Direct API Key")).toBeInTheDocument();

		// Check Tiingo has Configured (Database) badge
		expect(screen.getByText(/Configured \(Database\)/i)).toBeInTheDocument();
		// Check Alchemy has Configured (Env) badge
		expect(screen.getByText(/Configured \(Env\)/i)).toBeInTheDocument();
		// Check Kraken has Active badge
		expect(screen.getByText("Active")).toBeInTheDocument();
	});

	it("toggles key input reveal visibility", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ApiKeysManager />
			</MockedProvider>,
		);

		await screen.findByText("Finnhub");

		const input = screen.getByPlaceholderText("Enter Finnhub API Key") as HTMLInputElement;
		expect(input.type).toBe("password");

		// Find the toggle button specifically for Finnhub
		const toggleBtn = screen.getByTestId("toggle-reveal-FINNHUB");
		expect(toggleBtn).toBeDefined();

		fireEvent.click(toggleBtn);
		expect(input.type).toBe("text");
		fireEvent.click(toggleBtn);
		expect(input.type).toBe("password");
	});

	it("validates an API key and displays success feedback", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ApiKeysManager />
			</MockedProvider>,
		);

		await screen.findByText("Finnhub");

		const input = screen.getByPlaceholderText("Enter Finnhub API Key");
		fireEvent.change(input, { target: { value: "test-finnhub-key" } });

		const testButtons = screen.getAllByRole("button", { name: /Test Key/i });
		// Click the test button for Finnhub
		fireEvent.click(testButtons[1]);

		await waitFor(() => {
			expect(
				screen.getByText(/Valid API key: Connection successfully established/i),
			).toBeInTheDocument();
		});
	});

	it("switches tabs between Market Data, Web3, and Exchange Sync", async () => {
		render(
			<MockedProvider mocks={mocks} addTypename={false}>
				<ApiKeysManager />
			</MockedProvider>,
		);

		await screen.findByText("API Keys & Integrations");

		// Switch to Web3 tab
		const web3Tab = screen.getByRole("tab", { name: /Blockchain Node \(Alchemy\)/i });
		fireEvent.click(web3Tab);

		expect(screen.getByText("Alchemy API & Compute Unit Meter")).toBeInTheDocument();
		expect(screen.queryByText("Tiingo")).not.toBeInTheDocument();

		// Switch to Exchange & Bank Sync tab
		const syncTab = screen.getByRole("tab", { name: /Exchange.*Sync/i });
		fireEvent.click(syncTab);

		expect(screen.getByText("Kraken Direct API Key")).toBeInTheDocument();
		expect(screen.getByText("Enable Banking (European Open Banking)")).toBeInTheDocument();
		expect(screen.queryByText("Alchemy API & Compute Unit Meter")).not.toBeInTheDocument();
	});
});
