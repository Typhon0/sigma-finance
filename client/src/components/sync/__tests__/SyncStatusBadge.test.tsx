import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatRelativeSyncTime, SyncStatusBadge } from "../SyncStatusBadge";

describe("formatRelativeSyncTime", () => {
	it("returns 'Never synced' when input is null or undefined", () => {
		expect(formatRelativeSyncTime(null)).toBe("Never synced");
		expect(formatRelativeSyncTime(undefined)).toBe("Never synced");
	});

	it("returns relative string for recent timestamp", () => {
		const justNow = new Date(Date.now() - 10 * 1000);
		expect(formatRelativeSyncTime(justNow)).toBe("just now");

		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
		expect(formatRelativeSyncTime(fiveMinAgo)).toBe("5m ago");

		const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
		expect(formatRelativeSyncTime(twoHoursAgo)).toBe("2h ago");
	});
});

describe("SyncStatusBadge", () => {
	it("renders 'Ready to sync' when idle with no lastSyncAt", () => {
		render(<SyncStatusBadge accountId="acc-1" syncStatus="IDLE" />);
		expect(screen.getByText(/Ready to sync/i)).toBeInTheDocument();
	});

	it("renders synced relative time when status is SUCCESS", () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
		render(
			<SyncStatusBadge
				accountId="acc-1"
				syncStatus="SUCCESS"
				lastSyncAt={fiveMinAgo}
			/>,
		);
		expect(screen.getByText(/Synced 5m ago/i)).toBeInTheDocument();
	});

	it("renders 'Syncing...' when status is SYNCING", () => {
		render(<SyncStatusBadge accountId="acc-1" syncStatus="SYNCING" />);
		expect(screen.getByText(/Syncing.../i)).toBeInTheDocument();
	});

	it("renders 'Sync Failed' when status is FAILED", () => {
		render(
			<SyncStatusBadge
				accountId="acc-1"
				syncStatus="FAILED"
				lastError="Rate limit exceeded"
			/>,
		);
		expect(screen.getByText(/Sync Failed/i)).toBeInTheDocument();
	});

	it("renders a 1-click 'Sync Now' refresh button", () => {
		render(<SyncStatusBadge accountId="acc-1" syncStatus="IDLE" />);
		const syncBtn = screen.getByRole("button", { name: /Sync Now/i });
		expect(syncBtn).toBeInTheDocument();
		expect(syncBtn).not.toBeDisabled();
	});
});
