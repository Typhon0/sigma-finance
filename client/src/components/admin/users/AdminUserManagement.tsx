import { Plus, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	type AdminUserFilterInput,
	type AdminUserItem,
	type OrderByParams,
	useAdminUserMutations,
	useAdminUserStats,
	useAdminUsers,
} from "@/hooks/use-admin-users";
import { useAuth } from "@/hooks/use-auth";
import { AdminUserDetailSheet } from "./AdminUserDetailSheet";
import {
	AdminChangeRoleDialog,
	AdminCreateUserDialog,
	AdminDeleteUserDialog,
	AdminEditUserDialog,
	AdminLockUserDialog,
	AdminResetPasswordDialog,
} from "./AdminUserDialogs";
import { AdminUserStatsCards } from "./AdminUserStatsCards";
import { AdminUserTable } from "./AdminUserTable";

export function AdminUserManagement() {
	const { user: currentAdmin } = useAuth();

	// Table & Filter state
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("ALL");
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [orderBy, setOrderBy] = useState<OrderByParams>({
		field: "CREATED_AT",
		direction: "DESC",
	});

	// Active dialog states
	const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
	const [detailSheetOpen, setDetailSheetOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [roleDialogOpen, setRoleDialogOpen] = useState(false);
	const [lockDialogOpen, setLockDialogOpen] = useState(false);
	const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

	// Construct backend filter query
	const queryFilter = useMemo<AdminUserFilterInput>(() => {
		const filter: AdminUserFilterInput = {};
		if (search.trim()) filter.search = search.trim();
		if (roleFilter !== "ALL") filter.role = roleFilter;
		if (statusFilter === "ACTIVE") filter.isLocked = false;
		if (statusFilter === "LOCKED") filter.isLocked = true;
		if (statusFilter === "UNVERIFIED") filter.emailVerified = false;
		return filter;
	}, [search, roleFilter, statusFilter]);

	// GraphQL data fetching
	const {
		users,
		totalCount,
		loading: usersLoading,
		refetch: refetchUsers,
	} = useAdminUsers(queryFilter, { limit: pageSize, offset: (page - 1) * pageSize }, orderBy);

	const { stats, loading: statsLoading, refetch: refetchStats } = useAdminUserStats();

	const currentStatsFilter = useMemo<"all" | "admin" | "locked" | "unverified" | undefined>(() => {
		if (roleFilter === "ADMIN") return "admin";
		if (statusFilter === "LOCKED") return "locked";
		if (statusFilter === "UNVERIFIED") return "unverified";
		if (roleFilter === "ALL" && statusFilter === "ALL") return "all";
		return undefined;
	}, [roleFilter, statusFilter]);

	// Mutations
	const {
		createUser,
		updateUser,
		setUserRole,
		setUserLock,
		setUserPassword,
		setUserEmailVerified,
		deleteUser,
	} = useAdminUserMutations();

	const handleRefresh = async () => {
		await Promise.all([refetchUsers(), refetchStats()]);
	};

	const handleFilterFromStats = (type: "all" | "admin" | "locked" | "unverified") => {
		setPage(1);
		if (type === "all") {
			setRoleFilter("ALL");
			setStatusFilter("ALL");
		} else if (type === "admin") {
			setRoleFilter("ADMIN");
			setStatusFilter("ALL");
		} else if (type === "locked") {
			setStatusFilter("LOCKED");
		} else if (type === "unverified") {
			setStatusFilter("UNVERIFIED");
		}
	};

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Users className="h-5 w-5 text-muted-foreground" />
						<h1 className="text-xl font-semibold tracking-tight text-foreground">Gestion des Utilisateurs</h1>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">
						Supervisez les comptes inscrits, contrôlez les privilèges d'accès et gérez la sécurité.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={usersLoading || statsLoading}
						className="h-8 gap-1.5 text-xs border-border/60 bg-card/30"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${usersLoading || statsLoading ? "animate-spin" : ""}`}
						/>
						Actualiser
					</Button>
					<Button
						size="sm"
						onClick={() => setCreateDialogOpen(true)}
						className="h-8 gap-1.5 text-xs font-medium"
					>
						<Plus className="h-3.5 w-3.5" />
						Nouvel utilisateur
					</Button>
				</div>
			</div>

			{/* KPI Stats Cards */}
			<AdminUserStatsCards
				stats={stats}
				loading={statsLoading}
				currentFilter={currentStatsFilter}
				onFilterClick={handleFilterFromStats}
			/>

			{/* Main Data Table */}
			<AdminUserTable
				users={users}
				totalCount={totalCount}
				loading={usersLoading}
				currentAdminId={currentAdmin?.id}
				search={search}
				onSearchChange={(val) => {
					setSearch(val);
					setPage(1);
				}}
				roleFilter={roleFilter}
				onRoleFilterChange={(val) => {
					setRoleFilter(val);
					setPage(1);
				}}
				statusFilter={statusFilter}
				onStatusFilterChange={(val) => {
					setStatusFilter(val);
					setPage(1);
				}}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				onPageSizeChange={setPageSize}
				orderBy={orderBy}
				onOrderByChange={setOrderBy}
				onSelectUser={(u) => {
					setSelectedUser(u);
					setDetailSheetOpen(true);
				}}
				onEditUser={(u) => {
					setSelectedUser(u);
					setEditDialogOpen(true);
				}}
				onChangeRole={(u) => {
					setSelectedUser(u);
					setRoleDialogOpen(true);
				}}
				onLockToggle={(u) => {
					setSelectedUser(u);
					setLockDialogOpen(true);
				}}
				onResetPassword={(u) => {
					setSelectedUser(u);
					setPasswordDialogOpen(true);
				}}
				onDeleteUser={(u) => {
					setSelectedUser(u);
					setDeleteDialogOpen(true);
				}}
				onVerifyEmailToggle={async (u, verified) => {
					await setUserEmailVerified(u.id, verified);
				}}
			/>

			{/* Detailed Sheet */}
			<AdminUserDetailSheet
				user={selectedUser}
				open={detailSheetOpen}
				onOpenChange={setDetailSheetOpen}
				currentAdminId={currentAdmin?.id}
				onEdit={(u) => {
					setSelectedUser(u);
					setEditDialogOpen(true);
				}}
				onChangeRole={(u) => {
					setSelectedUser(u);
					setRoleDialogOpen(true);
				}}
				onLockToggle={(u) => {
					setSelectedUser(u);
					setLockDialogOpen(true);
				}}
				onResetPassword={(u) => {
					setSelectedUser(u);
					setPasswordDialogOpen(true);
				}}
				onDelete={(u) => {
					setSelectedUser(u);
					setDeleteDialogOpen(true);
				}}
				onVerifyEmailToggle={async (u, verified) => {
					await setUserEmailVerified(u.id, verified);
					setSelectedUser((prev) => (prev ? { ...prev, emailVerified: verified } : null));
				}}
			/>

			{/* Dialogs */}
			<AdminCreateUserDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
				onSubmit={async (data) => {
					await createUser(data);
				}}
			/>

			<AdminEditUserDialog
				user={selectedUser}
				open={editDialogOpen}
				onOpenChange={setEditDialogOpen}
				onSubmit={async (id, data) => {
					await updateUser(id, data);
				}}
			/>

			<AdminChangeRoleDialog
				user={selectedUser}
				currentAdminId={currentAdmin?.id}
				open={roleDialogOpen}
				onOpenChange={setRoleDialogOpen}
				onSubmit={async (id, role) => {
					await setUserRole(id, role);
				}}
			/>

			<AdminLockUserDialog
				user={selectedUser}
				currentAdminId={currentAdmin?.id}
				open={lockDialogOpen}
				onOpenChange={setLockDialogOpen}
				onSubmit={async (id, locked, lockUntil) => {
					await setUserLock(id, locked, lockUntil);
				}}
			/>

			<AdminResetPasswordDialog
				user={selectedUser}
				open={passwordDialogOpen}
				onOpenChange={setPasswordDialogOpen}
				onSubmit={async (id, pwd) => {
					await setUserPassword(id, pwd);
				}}
			/>

			<AdminDeleteUserDialog
				user={selectedUser}
				currentAdminId={currentAdmin?.id}
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onSubmit={async (id, hard) => {
					await deleteUser(id, hard);
				}}
			/>
		</div>
	);
}
