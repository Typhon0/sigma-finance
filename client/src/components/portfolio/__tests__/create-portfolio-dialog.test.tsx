import { MockedProvider } from "@apollo/client/testing";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePortfolioManagement } from "@/hooks/use-portfolio-management";
import { useAuth } from "@/lib/auth-context";
import { CreatePortfolioDialog } from "../create-portfolio-dialog";

// Mock the hooks
vi.mock("@/lib/auth-context");
vi.mock("@/hooks/use-portfolio-management");

const mockUser = {
	id: "user-1",
	name: "Test User",
	email: "test@example.com",
	emailVerified: true,
};

const mockCreatePortfolio = vi.fn();
const mockPortfolios = [{ id: "1", name: "Existing Portfolio", description: "Test portfolio" }];

describe("CreatePortfolioDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(useAuth).mockReturnValue({
			user: mockUser,
			isLoading: false,
			isAuthenticated: true,
			login: vi.fn(),
			register: vi.fn(),
			logout: vi.fn(),
			confirmPasswordReset: vi.fn(),
			requestPasswordReset: vi.fn(),
			resendVerification: vi.fn(),
			refreshToken: vi.fn(),
			clearError: vi.fn(),
			error: null,
		});

		vi.mocked(usePortfolioManagement).mockReturnValue({
			portfolios: mockPortfolios,
			loading: false,
			operationLoading: {
				create: false,
				update: false,
				delete: false,
				duplicate: false,
			},
			error: null,
			hasError: false,
			canRetry: false,
			retryCount: 0,
			createPortfolio: mockCreatePortfolio,
			updatePortfolio: vi.fn(),
			deletePortfolio: vi.fn(),
			duplicatePortfolio: vi.fn(),
			refetch: vi.fn(),
			retry: vi.fn(),
			clearError: vi.fn(),
			isCreating: false,
			isUpdating: false,
			isDeleting: false,
			isDuplicating: false,
		});
	});

	it("renders the dialog trigger", () => {
		render(
			<MockedProvider>
				<CreatePortfolioDialog>
					<button type="button">Create Portfolio</button>
				</CreatePortfolioDialog>
			</MockedProvider>,
		);

		expect(screen.getAllByText("Create Portfolio")[0]).toBeInTheDocument();
	});

	it("opens dialog when trigger is clicked", async () => {
		render(
			<MockedProvider>
				<CreatePortfolioDialog>
					<button type="button">Create Portfolio</button>
				</CreatePortfolioDialog>
			</MockedProvider>,
		);

		fireEvent.click(screen.getAllByText("Create Portfolio")[0]);

		await waitFor(() => {
			expect(screen.getByText("Enter the details for your new portfolio.")).toBeInTheDocument();
		});
	});

	it("calls createPortfolio when form is submitted", async () => {
		const mockResult = {
			id: "new-portfolio-id",
			name: "New Portfolio",
			description: "Test description",
		};

		mockCreatePortfolio.mockResolvedValue(mockResult);

		render(
			<MockedProvider>
				<CreatePortfolioDialog>
					<button type="button">Create Portfolio</button>
				</CreatePortfolioDialog>
			</MockedProvider>,
		);

		// Open dialog - use [0] for trigger button
		fireEvent.click(screen.getAllByText("Create Portfolio")[0]);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		// Fill form and submit - wrap in act to flush state updates
		await act(async () => {
			fireEvent.change(screen.getByLabelText(/Portfolio Name/), {
				target: { value: "New Portfolio" },
			});
			fireEvent.change(screen.getByLabelText(/Description/), {
				target: { value: "Test description" },
			});
		});

		// Submit form - use [2] for submit button (index 1 is dialog title)
		await act(async () => {
			fireEvent.click(screen.getAllByText("Create Portfolio")[2]);
		});

		await waitFor(() => {
			expect(mockCreatePortfolio).toHaveBeenCalledWith({
				userID: mockUser.id,
				name: "New Portfolio",
				description: "Test description",
			});
		});
	});

	it("shows error message when creation fails", async () => {
		const errorMessage = "Portfolio creation failed";
		mockCreatePortfolio.mockRejectedValue(new Error(errorMessage));

		render(
			<MockedProvider>
				<CreatePortfolioDialog showErrorToast={false}>
					<button type="button">Create Portfolio</button>
				</CreatePortfolioDialog>
			</MockedProvider>,
		);

		// Open dialog
		fireEvent.click(screen.getAllByText("Create Portfolio")[0]);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		// Fill form
		await act(async () => {
			fireEvent.change(screen.getByLabelText(/Portfolio Name/), {
				target: { value: "New Portfolio" },
			});
		});

		// Submit form - use [2] for submit button (index 1 is dialog title)
		await act(async () => {
			fireEvent.click(screen.getAllByText("Create Portfolio")[2]);
		});

		await waitFor(() => {
			expect(screen.getByText(errorMessage)).toBeInTheDocument();
		});
	});

	it("validates unique portfolio names", async () => {
		render(
			<MockedProvider>
				<CreatePortfolioDialog>
					<button type="button">Create Portfolio</button>
				</CreatePortfolioDialog>
			</MockedProvider>,
		);

		// Open dialog
		fireEvent.click(screen.getAllByText("Create Portfolio")[0]);

		await waitFor(() => {
			expect(screen.getByLabelText(/Portfolio Name/)).toBeInTheDocument();
		});

		// Try to use existing portfolio name
		fireEvent.change(screen.getByLabelText(/Portfolio Name/), {
			target: { value: "Existing Portfolio" },
		});

		await waitFor(() => {
			expect(screen.getByText(/already exists/)).toBeInTheDocument();
		});
	});
});
