import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/lib/auth-context";
import { usePortfolioDetail } from "../use-portfolio-detail";
import { usePortfolioManagement } from "../use-portfolio-management";

// Mock dependencies
vi.mock("../use-portfolio-management");
vi.mock("@/lib/auth-context");
vi.mock("sonner");
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => vi.fn(),
}));
vi.mock("@apollo/client", () => ({
	useQuery: () => ({
		data: {
			portfolio: {
				id: "1",
				name: "Test Portfolio",
				user: { id: "user1" },
				assets: [{ id: "asset1" }],
				transactions: [{ id: "tx1" }],
			},
		},
		loading: false,
		error: null,
		refetch: vi.fn(),
	}),
}));

const mockDeletePortfolio = vi.fn();
const mockUpdatePortfolio = vi.fn();
const mockNavigate = vi.fn();

describe("usePortfolioDetail - Delete Functionality", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Mock useAuth
		(useAuth as any).mockReturnValue({
			user: { id: "user1" },
		});

		// Mock usePortfolioManagement
		(usePortfolioManagement as any).mockReturnValue({
			deletePortfolio: mockDeletePortfolio,
			updatePortfolio: mockUpdatePortfolio,
		});

		// Mock toast
		(toast as any).success = vi.fn();
		(toast as any).error = vi.fn();
	});

	it("should handle successful portfolio deletion", async () => {
		mockDeletePortfolio.mockResolvedValue("1");

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		// Open delete dialog
		act(() => {
			result.current.handleDeleteClick();
		});

		expect(result.current.showDeleteDialog).toBe(true);

		// Confirm deletion
		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(mockDeletePortfolio).toHaveBeenCalledWith("1");
			expect(toast.success).toHaveBeenCalledWith(
				'Portfolio "Test Portfolio" has been deleted',
				expect.objectContaining({
					description: "All associated positions and data have been removed.",
				}),
			);
			expect(result.current.showDeleteDialog).toBe(false);
		});
	});

	it("should handle deletion error with positions", async () => {
		const error = new Error("Cannot delete portfolio that contains positions");
		mockDeletePortfolio.mockRejectedValue(error);

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Cannot delete portfolio with positions",
				expect.objectContaining({
					description:
						"Please remove all assets from this portfolio before deleting it.",
				}),
			);
		});
	});

	it("should handle unauthorized deletion error", async () => {
		const error = new Error(
			"You don't have permission to delete this portfolio",
		);
		mockDeletePortfolio.mockRejectedValue(error);

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Not authorized to delete this portfolio",
				expect.objectContaining({
					description: "You don't have permission to delete this portfolio.",
				}),
			);
		});
	});

	it("should handle portfolio not found error", async () => {
		const error = new Error("Portfolio not found");
		mockDeletePortfolio.mockRejectedValue(error);

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Portfolio not found",
				expect.objectContaining({
					description: "This portfolio may have already been deleted.",
				}),
			);
		});
	});

	it("should handle generic deletion error", async () => {
		const error = new Error("Network error");
		mockDeletePortfolio.mockRejectedValue(error);

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(toast.error).toHaveBeenCalledWith(
				"Failed to delete portfolio. Please try again.",
				expect.objectContaining({
					description: "Network error",
				}),
			);
		});
	});

	it("should call onDeleteSuccess callback when provided", async () => {
		mockDeletePortfolio.mockResolvedValue("1");
		const onDeleteSuccess = vi.fn();

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
				onDeleteSuccess,
			}),
		);

		await act(async () => {
			await result.current.handleDeleteConfirm();
		});

		await waitFor(() => {
			expect(onDeleteSuccess).toHaveBeenCalled();
		});
	});

	it("should manage loading state during deletion", async () => {
		let resolveDelete: (value: string) => void;
		const deletePromise = new Promise<string>((resolve) => {
			resolveDelete = resolve;
		});
		mockDeletePortfolio.mockReturnValue(deletePromise);

		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		// Start deletion
		act(() => {
			result.current.handleDeleteConfirm();
		});

		// Should be in loading state
		expect(result.current.isDeleting).toBe(true);

		// Complete deletion
		await act(async () => {
			resolveDelete!("1");
			await deletePromise;
		});

		// Should no longer be loading
		await waitFor(() => {
			expect(result.current.isDeleting).toBe(false);
		});
	});

	it("should handle cancel delete dialog", () => {
		const { result } = renderHook(() =>
			usePortfolioDetail({
				portfolioId: "1",
			}),
		);

		// Open dialog
		act(() => {
			result.current.handleDeleteClick();
		});

		expect(result.current.showDeleteDialog).toBe(true);

		// Cancel dialog
		act(() => {
			result.current.handleDeleteCancel();
		});

		expect(result.current.showDeleteDialog).toBe(false);
	});
});
