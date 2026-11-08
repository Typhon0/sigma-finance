import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminUserItem } from "@/hooks/use-admin-users";
import { AdminDeleteUserDialog } from "../AdminUserDialogs";
import { AdminUserStatsCards } from "../AdminUserStatsCards";
import { AdminUserTable } from "../AdminUserTable";

const mockUsers: AdminUserItem[] = [
	{
		id: "usr-1",
		username: "Alice Admin",
		email: "alice@example.com",
		role: "ADMIN",
		emailVerified: true,
		lastLoginAt: new Date().toISOString(),
		failedLoginCount: 0,
		lockedUntil: null,
		isLocked: false,
		displayCurrency: "USD",
		taxJurisdiction: "FR",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		portfolios: [{ id: "p-1", name: "Main Portfolio" }],
		watchlists: [],
	},
	{
		id: "usr-2",
		username: "Bob User",
		email: "bob@example.com",
		role: "USER",
		emailVerified: false,
		lastLoginAt: null,
		failedLoginCount: 3,
		lockedUntil: new Date(Date.now() + 3600000).toISOString(),
		isLocked: true,
		displayCurrency: "EUR",
		taxJurisdiction: "DE",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		portfolios: [],
		watchlists: [],
	},
];

describe("AdminUserStatsCards", () => {
	it("renders user statistics correctly", () => {
		const onFilterClick = vi.fn();
		render(
			<AdminUserStatsCards
				stats={{
					totalUsers: 10,
					activeUsers: 8,
					lockedUsers: 2,
					adminUsers: 3,
					unverifiedUsers: 4,
				}}
				loading={false}
				onFilterClick={onFilterClick}
			/>,
		);

		expect(screen.getByText("Total Utilisateurs")).toBeInTheDocument();
		expect(screen.getByText("10")).toBeInTheDocument();
		expect(screen.getByText("Utilisateurs Actifs")).toBeInTheDocument();
		expect(screen.getByText("8")).toBeInTheDocument();
		expect(screen.getByText("Administrateurs")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
		expect(screen.getByText("Comptes Verrouillés")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("Emails Non Vérifiés")).toBeInTheDocument();
		expect(screen.getByText("4")).toBeInTheDocument();

		// Clicking a card triggers onFilterClick
		fireEvent.click(screen.getByText("Administrateurs"));
		expect(onFilterClick).toHaveBeenCalledWith("admin");
	});
});

describe("AdminUserTable", () => {
	it("renders user rows and badges properly", () => {
		render(
			<AdminUserTable
				users={mockUsers}
				totalCount={2}
				loading={false}
				currentAdminId="usr-1"
				search=""
				onSearchChange={vi.fn()}
				roleFilter="ALL"
				onRoleFilterChange={vi.fn()}
				statusFilter="ALL"
				onStatusFilterChange={vi.fn()}
				page={1}
				pageSize={20}
				onPageChange={vi.fn()}
				onPageSizeChange={vi.fn()}
				orderBy={{ field: "CREATED_AT", direction: "DESC" }}
				onOrderByChange={vi.fn()}
				onSelectUser={vi.fn()}
				onEditUser={vi.fn()}
				onChangeRole={vi.fn()}
				onLockToggle={vi.fn()}
				onResetPassword={vi.fn()}
				onDeleteUser={vi.fn()}
				onVerifyEmailToggle={vi.fn()}
			/>,
		);

		expect(screen.getByText("Alice Admin")).toBeInTheDocument();
		expect(screen.getByText("alice@example.com")).toBeInTheDocument();
		expect(screen.getByText("Vous")).toBeInTheDocument(); // current admin indicator

		expect(screen.getByText("Bob User")).toBeInTheDocument();
		expect(screen.getByText("bob@example.com")).toBeInTheDocument();
		expect(screen.getByText("Verrouillé")).toBeInTheDocument();
		expect(screen.getByText("Non vérifié")).toBeInTheDocument();
	});
});

describe("AdminDeleteUserDialog", () => {
	it("enforces self-protection for logged-in admin", () => {
		render(
			<AdminDeleteUserDialog
				user={mockUsers[0]} // Alice Admin (current admin)
				currentAdminId="usr-1"
				open={true}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
			/>,
		);

		expect(
			screen.getByText(
				"Action impossible : vous ne pouvez pas supprimer ni désactiver votre propre compte.",
			),
		).toBeInTheDocument();
	});

	it("renders soft deactivate and hard delete options for other users", () => {
		render(
			<AdminDeleteUserDialog
				user={mockUsers[1]} // Bob User
				currentAdminId="usr-1"
				open={true}
				onOpenChange={vi.fn()}
				onSubmit={vi.fn()}
			/>,
		);

		expect(screen.getByText("Désactiver le compte (Recommandé)")).toBeInTheDocument();
		expect(screen.getByText("Supprimer définitivement (Irréversible)")).toBeInTheDocument();
	});
});
