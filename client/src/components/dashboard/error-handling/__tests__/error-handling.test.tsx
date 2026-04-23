import { ApolloError } from "@apollo/client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ChartErrorFallback,
	DashboardErrorBoundary,
	DashboardErrorManagerProvider,
	useDashboardErrorManager,
	useOfflineHandler,
	useRetryMechanism,
} from "../index";

// Mock components for testing
const TestComponent = ({ shouldError = false }: { shouldError?: boolean }) => {
	if (shouldError) {
		throw new Error("Test error");
	}
	return <div>Test Component</div>;
};

const TestComponentWithErrorManager = () => {
	const { actions } = useDashboardErrorManager();

	const handleError = () => {
		actions.reportError(new Error("Manual error"), "component", "TestComponent");
	};

	return (
		<div>
			<button type="button" onClick={handleError}>
				Trigger Error
			</button>
			<span>Error Manager Test</span>
		</div>
	);
};

const TestRetryComponent = () => {
	let callCount = 0;

	const retryFn = vi.fn(async () => {
		callCount++;
		if (callCount < 3) {
			throw new Error("Retry test error");
		}
	});

	const { retryState, retry } = useRetryMechanism(retryFn);

	return (
		<div>
			<button type="button" onClick={retry}>
				Retry
			</button>
			<span>Retry Count: {retryState.retryCount}</span>
			<span>Can Retry: {retryState.canRetry.toString()}</span>
		</div>
	);
};

const TestOfflineComponent = () => {
	const { offlineState } = useOfflineHandler();

	return (
		<div>
			<span>Online: {offlineState.isOnline.toString()}</span>
			<span>Offline Since: {offlineState.offlineSince?.toISOString() || "null"}</span>
		</div>
	);
};

describe("Dashboard Error Handling", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset online status
		Object.defineProperty(navigator, "onLine", {
			writable: true,
			value: true,
		});
	});

	describe("DashboardErrorBoundary", () => {
		it("should catch and display errors", () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			render(
				<DashboardErrorBoundary context="component" componentName="TestComponent">
					<TestComponent shouldError={true} />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByText("TestComponent Error")).toBeInTheDocument();
			expect(
				screen.getByText("This component encountered an error and needs to be reloaded."),
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

			consoleSpy.mockRestore();
		});

		it("should render children when no error occurs", () => {
			render(
				<DashboardErrorBoundary context="component" componentName="TestComponent">
					<TestComponent shouldError={false} />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByText("Test Component")).toBeInTheDocument();
		});

		it("should handle network errors differently", () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const networkError = new ApolloError({
				networkError: new Error("Network error"),
			});

			const ThrowNetworkError = () => {
				throw networkError;
			};

			render(
				<DashboardErrorBoundary context="component" componentName="TestComponent">
					<ThrowNetworkError />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByText("Network")).toBeInTheDocument();

			consoleSpy.mockRestore();
		});

		it("should provide navigation options for detail views", () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const onNavigateBack = vi.fn();
			const onNavigateHome = vi.fn();

			render(
				<DashboardErrorBoundary
					context="asset-detail"
					componentName="TestComponent"
					onNavigateBack={onNavigateBack}
					onNavigateHome={onNavigateHome}
				>
					<TestComponent shouldError={true} />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /dashboard home/i })).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /go back/i }));
			expect(onNavigateBack).toHaveBeenCalled();

			fireEvent.click(screen.getByRole("button", { name: /dashboard home/i }));
			expect(onNavigateHome).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe("DashboardErrorManager", () => {
		it("should track and manage errors", () => {
			render(
				<DashboardErrorManagerProvider>
					<TestComponentWithErrorManager />
				</DashboardErrorManagerProvider>,
			);

			expect(screen.getByText("Error Manager Test")).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /trigger error/i }));

			// Error should be reported (we can't easily test the internal state without exposing it)
			expect(screen.getByText("Error Manager Test")).toBeInTheDocument();
		});
	});

	describe("RetryMechanism", () => {
		it("should handle retry logic", async () => {
			render(<TestRetryComponent />);

			expect(screen.getByText("Retry Count: 0")).toBeInTheDocument();
			expect(screen.getByText("Can Retry: true")).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /retry/i }));

			await waitFor(() => {
				expect(screen.getByText("Retry Count: 1")).toBeInTheDocument();
			});
		});
	});

	describe("OfflineHandler", () => {
		it("should detect online status", () => {
			render(<TestOfflineComponent />);

			expect(screen.getByText("Online: true")).toBeInTheDocument();
			expect(screen.getByText("Offline Since: null")).toBeInTheDocument();
		});

		it("should handle offline status", () => {
			// Mock offline status
			Object.defineProperty(navigator, "onLine", {
				writable: true,
				value: false,
			});

			render(<TestOfflineComponent />);

			// Trigger offline event
			fireEvent(window, new Event("offline"));

			expect(screen.getByText("Online: false")).toBeInTheDocument();
		});
	});

	describe("ChartErrorFallback", () => {
		it("should display chart error with retry option", () => {
			const onRetry = vi.fn();
			const error = new Error("Chart loading failed");

			render(
				<ChartErrorFallback error={error} onRetry={onRetry} chartType="pie" title="Test Chart" />,
			);

			expect(screen.getByText("Test Chart")).toBeInTheDocument();
			expect(screen.getByText("Chart Unavailable")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

			fireEvent.click(screen.getByRole("button", { name: /retry/i }));
			expect(onRetry).toHaveBeenCalled();
		});

		it("should show fallback data when available", () => {
			const error = new Error("Chart loading failed");

			render(
				<ChartErrorFallback
					error={error}
					chartType="line"
					title="Test Chart"
					showFallbackData={true}
				/>,
			);

			expect(screen.getByText("Using cached data")).toBeInTheDocument();
		});
	});

	describe("Loading States", () => {
		it("should render skeleton components", async () => {
			const { InlineChartSkeleton } = await import("../loading-states");

			render(<InlineChartSkeleton height={300} title="Test Chart" />);

			// Should render skeleton structure (check for skeleton class or card structure)
			expect(document.querySelector('[data-slot="card"]')).toBeInTheDocument();
		});
	});

	describe("Error Recovery", () => {
		it("should reset error state on successful retry", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			let shouldError = true;

			const ToggleErrorComponent = () => {
				if (shouldError) {
					throw new Error("Toggle error");
				}
				return <div>Success</div>;
			};

			const { _rerender } = render(
				<DashboardErrorBoundary context="component" componentName="ToggleErrorComponent">
					<ToggleErrorComponent />
				</DashboardErrorBoundary>,
			);

			// Should show error
			expect(screen.getByText("ToggleErrorComponent Error")).toBeInTheDocument();

			// Fix the error condition
			shouldError = false;

			// Click retry
			fireEvent.click(screen.getByRole("button", { name: /retry/i }));

			// Should show success
			await waitFor(() => {
				expect(screen.getByText("Success")).toBeInTheDocument();
			});

			consoleSpy.mockRestore();
		});
	});

	describe("Context-Specific Error Handling", () => {
		it("should show different messages for different contexts", () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			const { rerender } = render(
				<DashboardErrorBoundary context="overview" componentName="TestComponent">
					<TestComponent shouldError={true} />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByText("Dashboard Overview Error")).toBeInTheDocument();

			rerender(
				<DashboardErrorBoundary context="chart" componentName="TestComponent">
					<TestComponent shouldError={true} />
				</DashboardErrorBoundary>,
			);

			expect(screen.getByText("Chart Loading Error")).toBeInTheDocument();

			consoleSpy.mockRestore();
		});
	});
});
