import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSwitcherMenu } from "@/components/layout/AccountSwitcherMenu";
import type { AuthUser, StoredAccountSession } from "@/lib/types/auth.types";

const mockSwitchAccount = vi.fn();
const mockRemoveAccountSession = vi.fn();
const mockLogout = vi.fn();
const mockLogoutAllAccounts = vi.fn();
const mockAddAccount = vi.fn().mockResolvedValue({ success: true });

const mockActiveUser: AuthUser = {
	id: "user-1",
	email: "user1@example.com",
	name: "Alice Martin",
	emailVerified: true,
	role: "ADMIN",
};

const mockSecondaryUser: AuthUser = {
	id: "user-2",
	email: "user2@example.com",
	name: "Bob Dupont",
	emailVerified: true,
};

const mockSessions: StoredAccountSession[] = [
	{
		user: mockActiveUser,
		token: "token-1",
		refreshToken: "refresh-1",
		expiresAt: new Date(Date.now() + 3600000).toISOString(),
		lastActiveAt: Date.now(),
		isExpired: false,
	},
	{
		user: mockSecondaryUser,
		token: "token-2",
		refreshToken: "refresh-2",
		expiresAt: new Date(Date.now() + 3600000).toISOString(),
		lastActiveAt: Date.now() - 10000,
		isExpired: false,
	},
];

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({
		user: mockActiveUser,
		accounts: mockSessions,
		switchAccount: mockSwitchAccount,
		removeAccountSession: mockRemoveAccountSession,
		logout: mockLogout,
		logoutAllAccounts: mockLogoutAllAccounts,
		addAccount: mockAddAccount,
	}),
}));

describe("AccountSwitcherMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders accounts in dropdown when open", () => {
		render(
			<AccountSwitcherMenu open={true}>
				<button type="button">Open Switcher</button>
			</AccountSwitcherMenu>,
		);

		expect(screen.getByText("Comptes connectés")).toBeDefined();
		expect(screen.getByText("Bob Dupont")).toBeDefined();
		expect(screen.getByText("user2@example.com")).toBeDefined();
	});

	it("switches to secondary account when clicked", () => {
		render(
			<AccountSwitcherMenu open={true}>
				<button type="button">Open Switcher</button>
			</AccountSwitcherMenu>,
		);

		fireEvent.click(screen.getByText("Bob Dupont"));
		expect(mockSwitchAccount).toHaveBeenCalledWith("user-2");
	});

	it("displays option to disconnect current account and all accounts", () => {
		render(
			<AccountSwitcherMenu open={true}>
				<button type="button">Open Switcher</button>
			</AccountSwitcherMenu>,
		);

		expect(screen.getByText("Se déconnecter de ce compte")).toBeDefined();
		expect(screen.getByText("Se déconnecter de tous les comptes")).toBeDefined();

		fireEvent.click(screen.getByText("Se déconnecter de ce compte"));
		expect(mockLogout).toHaveBeenCalled();
	});

	it("triggers logoutAllAccounts when selected", () => {
		render(
			<AccountSwitcherMenu open={true}>
				<button type="button">Open Switcher</button>
			</AccountSwitcherMenu>,
		);

		fireEvent.click(screen.getByText("Se déconnecter de tous les comptes"));
		expect(mockLogoutAllAccounts).toHaveBeenCalled();
	});

	it("allows detaching a secondary account", () => {
		render(
			<AccountSwitcherMenu open={true}>
				<button type="button">Open Switcher</button>
			</AccountSwitcherMenu>,
		);

		const detachBtn = screen.getByTitle("Détacher ce compte");
		fireEvent.click(detachBtn);
		expect(mockRemoveAccountSession).toHaveBeenCalledWith("user-2");
	});
});
