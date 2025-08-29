import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PortfolioDeleteDialog } from "../portfolio-delete-dialog";
import type { Portfolio } from "@/gql/graphql";

// Mock portfolio data
const mockPortfolioEmpty: Portfolio = {
	id: "1",
	name: "Empty Portfolio",
	description: "A portfolio with no assets",
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
	sortOrder: 0,
	assets: [],
	transactions: [],
	analytics: null,
	tags: [],
	user: {
		id: "user1",
		name: "Test User",
		email: "test@example.com",
		emailVerified: true,
	},
};

const mockPortfolioWithAssets: Portfolio = {
	...mockPortfolioEmpty,
	id: "2",
	name: "Portfolio with Assets",
	description: "A portfolio with assets and transactions",
	assets: [
		{
			id: "asset1",
			portfolioId: "2",
			assetId: "stock1",
			quantity: 100,
			averagePurchasePrice: 50.0,
			ownershipPct: 100,
			asset: {
				id: "stock1",
				name: "Apple Inc.",
				symbol: "AAPL",
				assetType: {
					id: "type1",
					name: "Stock",
				},
				currentValue: 150.0,
			},
		},
		{
			id: "asset2",
			portfolioId: "2",
			assetId: "stock2",
			quantity: 50,
			averagePurchasePrice: 25.0,
			ownershipPct: 75,
			asset: {
				id: "stock2",
				name: "Microsoft Corp.",
				symbol: "MSFT",
				assetType: {
					id: "type1",
					name: "Stock",
				},
				currentValue: 300.0,
			},
		},
	],
	transactions: [
		{
			id: "tx1",
			type: "BUY",
			amount: 5000,
			quantity: 100,
			timestamp: "2024-01-01T00:00:00Z",
		},
		{
			id: "tx2",
			type: "BUY",
			amount: 1250,
			quantity: 50,
			timestamp: "2024-01-02T00:00:00Z",
		},
	],
	analytics: {
		totalValue: 22500,
		totalCost: 6250,
		totalGainLoss: 16250,
		totalGainLossPercent: 260,
	},
};

describe("PortfolioDeleteDialog", () => {
	const mockOnOpenChange = vi.fn();
	const mockOnConfirm = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should not render when portfolio is null", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={null}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.queryByText("Delete Portfolio")).not.toBeInTheDocument();
	});

	it("should render basic delete dialog for empty portfolio", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioEmpty}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		expect(screen.getByText('"Empty Portfolio"')).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Delete Portfolio" })).toBeInTheDocument();
	});

	it("should show warning for portfolio with assets", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioWithAssets}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(
			screen.getByText(/Warning: This portfolio contains data/),
		).toBeInTheDocument();
		expect(screen.getByText("Asset positions:")).toBeInTheDocument();
		expect(screen.getByText("Transaction records:")).toBeInTheDocument();
		
		// Check for the specific counts in their context
		const assetPositionsRow = screen.getByText("Asset positions:").closest("div");
		expect(assetPositionsRow).toHaveTextContent("2");
		
		const transactionRecordsRow = screen.getByText("Transaction records:").closest("div");
		expect(transactionRecordsRow).toHaveTextContent("2");
	});

	it("should display portfolio value when available", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioWithAssets}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.getByText("Portfolio value:")).toBeInTheDocument();
		expect(screen.getByText("$22,500.00")).toBeInTheDocument();
	});

	it("should show detailed deletion list", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioWithAssets}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(
			screen.getByText("The following will be permanently deleted:"),
		).toBeInTheDocument();
		expect(
			screen.getByText('• Portfolio "Portfolio with Assets"'),
		).toBeInTheDocument();
		expect(screen.getByText("• All 2 asset positions")).toBeInTheDocument();
		expect(
			screen.getByText("• All 2 transaction records"),
		).toBeInTheDocument();
		expect(
			screen.getByText("• Performance analytics and historical data"),
		).toBeInTheDocument();
		expect(
			screen.getByText("• Any associated tags and metadata"),
		).toBeInTheDocument();
	});

	it("should show warning about irreversible action", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioEmpty}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
	});

	it("should call onConfirm when delete button is clicked", async () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioEmpty}
				onConfirm={mockOnConfirm}
			/>,
		);

		const deleteButton = screen.getByRole("button", {
			name: "Delete Portfolio",
		});
		fireEvent.click(deleteButton);

		await waitFor(() => {
			expect(mockOnConfirm).toHaveBeenCalledTimes(1);
		});
	});

	it("should call onOpenChange when cancel button is clicked", async () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioEmpty}
				onConfirm={mockOnConfirm}
			/>,
		);

		const cancelButton = screen.getByRole("button", { name: "Cancel" });
		fireEvent.click(cancelButton);

		await waitFor(() => {
			expect(mockOnOpenChange).toHaveBeenCalledWith(false);
		});
	});

	it("should show loading state when deleting", () => {
		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={mockPortfolioEmpty}
				onConfirm={mockOnConfirm}
				isDeleting={true}
			/>,
		);

		expect(screen.getByText("Deleting...")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
	});

	it("should handle portfolio with no transactions", () => {
		const portfolioNoTransactions = {
			...mockPortfolioWithAssets,
			transactions: [],
		};

		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={portfolioNoTransactions}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.getByText("Asset positions:")).toBeInTheDocument();
		expect(screen.queryByText("Transaction records:")).not.toBeInTheDocument();
	});

	it("should handle portfolio with zero value", () => {
		const portfolioZeroValue = {
			...mockPortfolioWithAssets,
			analytics: {
				...mockPortfolioWithAssets.analytics!,
				totalValue: 0,
			},
		};

		render(
			<PortfolioDeleteDialog
				open={true}
				onOpenChange={mockOnOpenChange}
				portfolio={portfolioZeroValue}
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.queryByText("Portfolio value:")).not.toBeInTheDocument();
	});
});