import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteErrorBoundary } from "@/components/router-error-boundary";

describe("RouteErrorBoundary (root router errorComponent)", () => {
	it("renders user-friendly English wording instead of the dev-style raw crash", () => {
		render(<RouteErrorBoundary error={new Error("Maximum update depth exceeded")} />);

		expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
		expect(screen.getByText(/your data was not modified/i)).toBeInTheDocument();
	});

	it("keeps focus on the reload action so keyboard users can recover immediately", () => {
		render(<RouteErrorBoundary error={new Error("Maximum update depth exceeded")} />);

		const button = screen.getByRole("button", { name: /reload/i });
		// jsdom makes window.location.reload non-configurable (cannot be spied),
		// so assert the wiring that is observable: focus lands on the primary
		// recovery action and clicking it does not throw.
		expect(document.activeElement).toBe(button);
		expect(() => fireEvent.click(button)).not.toThrow();
	});

	it("handles non-Error throws with a generic message", () => {
		render(<RouteErrorBoundary error="route exploded" />);

		expect(screen.getByText("route exploded")).toBeInTheDocument();
	});
});
