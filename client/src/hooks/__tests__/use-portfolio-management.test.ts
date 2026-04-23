import { MockedProvider } from "@apollo/client/testing";
import { renderHook } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";
import { GET_PORTFOLIOS_WITH_ANALYTICS } from "@/graphql/queries";
import { useAuth } from "@/lib/auth-context";
import {
	usePortfolioCreation,
	usePortfolioManagement,
	usePortfolioOperations,
} from "../use-portfolio-management";

// Mock the auth context
vi.mock("@/lib/auth-context", () => ({
	useAuth: vi.fn(),
}));

const mockUser = {
	id: "user-1",
	name: "Test User",
	email: "test@example.com",
	emailVerified: true,
};

const mockPortfolio = {
	id: "portfolio-1",
	name: "Test Portfolio",
	description: "Test Description",
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	sortOrder: 1,
	assets: [],
	analytics: null,
	tags: [],
	transactions: [],
	user: mockUser,
};

const mocks = [
	{
		request: {
			query: GET_PORTFOLIOS_WITH_ANALYTICS,
			variables: { userID: "user-1" },
		},
		result: {
			data: {
				portfolios: [mockPortfolio],
			},
		},
	},
];

describe("usePortfolioManagement", () => {
	beforeEach(() => {
		vi.mocked(useAuth).mockReturnValue({
			user: mockUser,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should provide portfolio management functionality", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			React.createElement(MockedProvider, { mocks, addTypename: false }, children);

		const { result } = renderHook(() => usePortfolioManagement(), { wrapper });

		expect(result.current.createPortfolio).toBeDefined();
		expect(result.current.updatePortfolio).toBeDefined();
		expect(result.current.deletePortfolio).toBeDefined();
		expect(result.current.duplicatePortfolio).toBeDefined();
		expect(result.current.loading).toBeDefined();
		expect(result.current.error).toBeDefined();
	});
});

describe("usePortfolioCreation", () => {
	beforeEach(() => {
		vi.mocked(useAuth).mockReturnValue({
			user: mockUser,
		});
	});

	it("should provide form-friendly creation interface", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			React.createElement(MockedProvider, { mocks, addTypename: false }, children);

		const { result } = renderHook(() => usePortfolioCreation(), { wrapper });

		expect(result.current.createPortfolio).toBeDefined();
		expect(result.current.isCreating).toBe(false);
		expect(result.current.createdPortfolio).toBeNull();
	});
});

describe("usePortfolioOperations", () => {
	beforeEach(() => {
		vi.mocked(useAuth).mockReturnValue({
			user: mockUser,
		});
	});

	it("should provide single portfolio operations", () => {
		const wrapper = ({ children }: { children: React.ReactNode }) =>
			React.createElement(MockedProvider, { mocks, addTypename: false }, children);

		const { result } = renderHook(() => usePortfolioOperations("portfolio-1"), {
			wrapper,
		});

		expect(result.current.updatePortfolio).toBeDefined();
		expect(result.current.deletePortfolio).toBeDefined();
		expect(result.current.duplicatePortfolio).toBeDefined();
	});
});
