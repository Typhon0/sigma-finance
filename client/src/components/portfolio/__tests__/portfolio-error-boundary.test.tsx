import { ApolloError } from "@apollo/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	PortfolioDetailErrorBoundary,
	PortfolioErrorBoundary,
	PortfolioListErrorBoundary,
} from "../portfolio-error-boundary";

// Test component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
	if (shouldThrow) {
		throw new Error("Test error");
	}
	return <div>No error</div>;
};

describe("Portfolio Error Boundaries", () => {
	// Suppress console.error for these tests
	// biome-ignore lint/suspicious/noConsole: test setup needs console
	const originalError = console.error;
	beforeAll(() => {
		console.error = vi.fn();
	});

	afterAll(() => {
		console.error = originalError;
	});

	describe("PortfolioErrorBoundary", () => {
		it("renders children when there is no error", () => {
			render(
				<PortfolioErrorBoundary>
					<ThrowError shouldThrow={false} />
				</PortfolioErrorBoundary>,
			);
			expect(screen.getByText("No error")).toBeInTheDocument();
		});

		it("renders error fallback when there is an error", () => {
			render(
				<PortfolioErrorBoundary>
					<ThrowError shouldThrow={true} />
				</PortfolioErrorBoundary>,
			);
			expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
			expect(screen.getByText("Test error")).toBeInTheDocument();
		});

		it("shows retry button when onRetry is provided", () => {
			const mockRetry = vi.fn();
			render(
				<PortfolioErrorBoundary onRetry={mockRetry}>
					<ThrowError shouldThrow={true} />
				</PortfolioErrorBoundary>,
			);

			const retryButton = screen.getByText("Try Again");
			expect(retryButton).toBeInTheDocument();

			fireEvent.click(retryButton);
			expect(mockRetry).toHaveBeenCalled();
		});

		it("shows reset button", () => {
			const mockReset = vi.fn();
			render(
				<PortfolioErrorBoundary onReset={mockReset}>
					<ThrowError shouldThrow={true} />
				</PortfolioErrorBoundary>,
			);

			const resetButton = screen.getByText("Reset");
			expect(resetButton).toBeInTheDocument();

			fireEvent.click(resetButton);
			expect(mockReset).toHaveBeenCalled();
		});
	});

	describe("PortfolioListErrorBoundary", () => {
		it("renders with list context", () => {
			render(
				<PortfolioListErrorBoundary>
					<ThrowError shouldThrow={true} />
				</PortfolioListErrorBoundary>,
			);
			expect(screen.getByText("Error Loading Portfolios")).toBeInTheDocument();
		});
	});

	describe("PortfolioDetailErrorBoundary", () => {
		it("renders with detail context", () => {
			render(
				<PortfolioDetailErrorBoundary>
					<ThrowError shouldThrow={true} />
				</PortfolioDetailErrorBoundary>,
			);
			expect(screen.getByText("Error Loading Portfolio Details")).toBeInTheDocument();
		});
	});

	describe("Apollo Error Handling", () => {
		it("handles network errors", () => {
			const NetworkErrorComponent = () => {
				throw new ApolloError({
					networkError: new Error("Network error"),
				});
			};

			render(
				<PortfolioErrorBoundary>
					<NetworkErrorComponent />
				</PortfolioErrorBoundary>,
			);

			expect(screen.getByText("Connection Error")).toBeInTheDocument();
		});

		it("handles GraphQL errors", () => {
			const GraphQlErrorComponent = () => {
				throw new ApolloError({
					graphQLErrors: [
						{
							message: "Portfolio not found",
							extensions: { code: "NOT_FOUND" },
						} as any,
					],
				});
			};

			render(
				<PortfolioErrorBoundary>
					<GraphQlErrorComponent />
				</PortfolioErrorBoundary>,
			);

			expect(screen.getByText("Portfolio Not Found")).toBeInTheDocument();
		});

		it("handles unauthorized errors", () => {
			const UnauthorizedErrorComponent = () => {
				throw new ApolloError({
					graphQLErrors: [
						{
							message: "Unauthorized",
							extensions: { code: "UNAUTHORIZED" },
						} as any,
					],
				});
			};

			render(
				<PortfolioErrorBoundary>
					<UnauthorizedErrorComponent />
				</PortfolioErrorBoundary>,
			);

			expect(screen.getByText("Access Denied")).toBeInTheDocument();
		});
	});
});
