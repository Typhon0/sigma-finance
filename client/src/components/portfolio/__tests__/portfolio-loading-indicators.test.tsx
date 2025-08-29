import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	LoadingIndicator,
	AsyncOperationIndicator,
	PortfolioOperationStatus,
	InlineLoading,
} from "../portfolio-loading-indicators";

describe("Portfolio Loading Indicators", () => {
	describe("LoadingIndicator", () => {
		it("renders with default spinner variant", () => {
			render(<LoadingIndicator message="Loading..." />);
			expect(screen.getByText("Loading...")).toBeInTheDocument();
		});

		it("renders with dots variant", () => {
			render(<LoadingIndicator message="Processing..." variant="dots" />);
			expect(screen.getByText("Processing...")).toBeInTheDocument();
		});

		it("renders with pulse variant", () => {
			render(<LoadingIndicator message="Syncing..." variant="pulse" />);
			expect(screen.getByText("Syncing...")).toBeInTheDocument();
		});
	});

	describe("AsyncOperationIndicator", () => {
		it("shows loading state", () => {
			render(
				<AsyncOperationIndicator
					isLoading={true}
					loadingMessage="Creating portfolio..."
				/>,
			);
			expect(screen.getByText("Creating portfolio...")).toBeInTheDocument();
		});

		it("shows success state", () => {
			render(
				<AsyncOperationIndicator
					isLoading={false}
					success={true}
					successMessage="Portfolio created successfully"
				/>,
			);
			expect(
				screen.getByText("Portfolio created successfully"),
			).toBeInTheDocument();
		});

		it("shows error state with retry button", () => {
			const mockRetry = vi.fn();
			render(
				<AsyncOperationIndicator
					isLoading={false}
					error={new Error("Failed to create portfolio")}
					onRetry={mockRetry}
				/>,
			);
			expect(
				screen.getByText("Failed to create portfolio"),
			).toBeInTheDocument();
			expect(screen.getByText("Retry")).toBeInTheDocument();
		});
	});

	describe("PortfolioOperationStatus", () => {
		it("shows create operation status", () => {
			render(<PortfolioOperationStatus operations={{ create: true }} />);
			expect(screen.getByText("Creating portfolio...")).toBeInTheDocument();
		});

		it("shows update operation status", () => {
			render(<PortfolioOperationStatus operations={{ update: true }} />);
			expect(screen.getByText("Updating portfolio...")).toBeInTheDocument();
		});

		it("shows delete operation status", () => {
			render(<PortfolioOperationStatus operations={{ delete: true }} />);
			expect(screen.getByText("Deleting portfolio...")).toBeInTheDocument();
		});

		it("shows duplicate operation status", () => {
			render(<PortfolioOperationStatus operations={{ duplicate: true }} />);
			expect(screen.getByText("Duplicating portfolio...")).toBeInTheDocument();
		});

		it("shows loading operation status", () => {
			render(<PortfolioOperationStatus operations={{ loading: true }} />);
			expect(screen.getByText("Loading portfolios...")).toBeInTheDocument();
		});

		it("renders nothing when no operations are active", () => {
			const { container } = render(
				<PortfolioOperationStatus operations={{}} />,
			);
			expect(container.firstChild).toBeNull();
		});
	});

	describe("InlineLoading", () => {
		it("shows loading indicator when loading", () => {
			render(
				<InlineLoading isLoading={true} loadingText="Loading data...">
					<div>Content</div>
				</InlineLoading>,
			);
			expect(screen.getByText("Loading data...")).toBeInTheDocument();
			expect(screen.queryByText("Content")).not.toBeInTheDocument();
		});

		it("shows children when not loading", () => {
			render(
				<InlineLoading isLoading={false}>
					<div>Content</div>
				</InlineLoading>,
			);
			expect(screen.getByText("Content")).toBeInTheDocument();
		});
	});
});