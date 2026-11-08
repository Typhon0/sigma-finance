import { useMutation, useQuery } from "@apollo/client";
import { toast } from "sonner";
import {
	ADMIN_CREATE_USER,
	ADMIN_DELETE_USER,
	ADMIN_SET_USER_EMAIL_VERIFIED,
	ADMIN_SET_USER_LOCK,
	ADMIN_SET_USER_PASSWORD,
	ADMIN_SET_USER_ROLE,
	ADMIN_UPDATE_USER,
} from "@/graphql/mutations/admin-users.mutations";
import { ADMIN_USER_STATS_QUERY, ADMIN_USERS_QUERY } from "@/graphql/queries/admin-users.queries";

export interface AdminUserItem {
	id: string;
	username: string;
	email: string;
	role: string;
	emailVerified: boolean;
	lastLoginAt?: string | null;
	failedLoginCount: number;
	lockedUntil?: string | null;
	isLocked: boolean;
	displayCurrency: string;
	taxJurisdiction: string;
	createdAt: string;
	updatedAt: string;
	portfolios: Array<{ id: string; name: string }>;
	watchlists: Array<{ id: string; name: string }>;
}

export interface AdminUserStatsData {
	totalUsers: number;
	activeUsers: number;
	lockedUsers: number;
	adminUsers: number;
	unverifiedUsers: number;
}

export interface AdminUserFilterInput {
	search?: string;
	role?: string;
	isLocked?: boolean;
	emailVerified?: boolean;
}

export interface PaginationParams {
	limit: number;
	offset: number;
}

export interface OrderByParams {
	field: "CREATED_AT" | "EMAIL" | "USERNAME";
	direction: "ASC" | "DESC";
}

export function useAdminUsers(
	filter?: AdminUserFilterInput,
	pagination?: PaginationParams,
	orderBy?: OrderByParams,
) {
	const { data, loading, error, refetch } = useQuery(ADMIN_USERS_QUERY, {
		variables: {
			filter: {
				search: filter?.search || undefined,
				role: filter?.role || undefined,
				isLocked: filter?.isLocked,
				emailVerified: filter?.emailVerified,
			},
			pagination: {
				limit: pagination?.limit ?? 20,
				offset: pagination?.offset ?? 0,
			},
			orderBy: orderBy
				? {
						field: orderBy.field,
						direction: orderBy.direction,
					}
				: {
						field: "CREATED_AT",
						direction: "DESC",
					},
		},
		fetchPolicy: "cache-and-network",
	});

	return {
		users: (data?.adminUsers?.users ?? []) as AdminUserItem[],
		totalCount: (data?.adminUsers?.totalCount ?? 0) as number,
		loading,
		error,
		refetch,
	};
}

export function useAdminUserStats() {
	const { data, loading, error, refetch } = useQuery(ADMIN_USER_STATS_QUERY, {
		fetchPolicy: "cache-and-network",
	});

	return {
		stats: (data?.adminUserStats ?? null) as AdminUserStatsData | null,
		loading,
		error,
		refetch,
	};
}

export function useAdminUserMutations() {
	const [createUserMutation, { loading: creating }] = useMutation(ADMIN_CREATE_USER, {
		refetchQueries: [{ query: ADMIN_USERS_QUERY }, { query: ADMIN_USER_STATS_QUERY }],
	});
	const [updateUserMutation, { loading: updating }] = useMutation(ADMIN_UPDATE_USER, {
		refetchQueries: [{ query: ADMIN_USERS_QUERY }],
	});
	const [setRoleMutation, { loading: settingRole }] = useMutation(ADMIN_SET_USER_ROLE, {
		refetchQueries: [{ query: ADMIN_USERS_QUERY }, { query: ADMIN_USER_STATS_QUERY }],
	});
	const [setLockMutation, { loading: settingLock }] = useMutation(ADMIN_SET_USER_LOCK, {
		refetchQueries: [{ query: ADMIN_USERS_QUERY }, { query: ADMIN_USER_STATS_QUERY }],
	});
	const [setPasswordMutation, { loading: settingPassword }] = useMutation(ADMIN_SET_USER_PASSWORD);
	const [setEmailVerifiedMutation, { loading: settingEmailVerified }] = useMutation(
		ADMIN_SET_USER_EMAIL_VERIFIED,
		{
			refetchQueries: [{ query: ADMIN_USERS_QUERY }, { query: ADMIN_USER_STATS_QUERY }],
		},
	);
	const [deleteUserMutation, { loading: deleting }] = useMutation(ADMIN_DELETE_USER, {
		refetchQueries: [{ query: ADMIN_USERS_QUERY }, { query: ADMIN_USER_STATS_QUERY }],
	});

	const createUser = async (input: {
		name: string;
		email: string;
		password: string;
		role?: string;
		emailVerified?: boolean;
	}) => {
		try {
			const res = await createUserMutation({ variables: { input } });
			toast.success("Utilisateur créé avec succès");
			return res.data?.adminCreateUser;
		} catch (err: any) {
			toast.error(err.message || "Échec de la création de l'utilisateur");
			throw err;
		}
	};

	const updateUser = async (
		id: string,
		input: {
			name?: string;
			email?: string;
			role?: string;
			taxJurisdiction?: string;
			displayCurrency?: string;
		},
	) => {
		try {
			const res = await updateUserMutation({ variables: { id, input } });
			toast.success("Utilisateur mis à jour");
			return res.data?.adminUpdateUser;
		} catch (err: any) {
			toast.error(err.message || "Échec de la mise à jour");
			throw err;
		}
	};

	const setUserRole = async (id: string, role: string) => {
		try {
			const res = await setRoleMutation({ variables: { id, role } });
			toast.success(`Rôle changé en ${role}`);
			return res.data?.adminSetUserRole;
		} catch (err: any) {
			toast.error(err.message || "Échec du changement de rôle");
			throw err;
		}
	};

	const setUserLock = async (id: string, locked: boolean, lockUntil?: string | null) => {
		try {
			const res = await setLockMutation({
				variables: { id, locked, lockUntil: lockUntil || null },
			});
			toast.success(locked ? "Compte verrouillé et sessions révoquées" : "Compte déverrouillé");
			return res.data?.adminSetUserLock;
		} catch (err: any) {
			toast.error(err.message || "Échec de la modification du verrou");
			throw err;
		}
	};

	const setUserPassword = async (id: string, password: string) => {
		try {
			await setPasswordMutation({ variables: { id, password } });
			toast.success("Mot de passe réinitialisé et sessions révoquées");
			return true;
		} catch (err: any) {
			toast.error(err.message || "Échec de la réinitialisation du mot de passe");
			throw err;
		}
	};

	const setUserEmailVerified = async (id: string, verified: boolean) => {
		try {
			const res = await setEmailVerifiedMutation({ variables: { id, verified } });
			toast.success(verified ? "Email marqué comme vérifié" : "Email marqué comme non-vérifié");
			return res.data?.adminSetUserEmailVerified;
		} catch (err: any) {
			toast.error(err.message || "Échec de la mise à jour de vérification");
			throw err;
		}
	};

	const deleteUser = async (id: string, hardDelete: boolean) => {
		try {
			await deleteUserMutation({ variables: { id, hardDelete } });
			toast.success(
				hardDelete
					? "Utilisateur définitivement supprimé"
					: "Utilisateur désactivé (accès révoqué)",
			);
			return true;
		} catch (err: any) {
			toast.error(err.message || "Échec de la suppression/désactivation");
			throw err;
		}
	};

	return {
		createUser,
		updateUser,
		setUserRole,
		setUserLock,
		setUserPassword,
		setUserEmailVerified,
		deleteUser,
		isMutating:
			creating ||
			updating ||
			settingRole ||
			settingLock ||
			settingPassword ||
			settingEmailVerified ||
			deleting,
	};
}
