import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
	ArrowUpDown,
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	Eye,
	KeyRound,
	Lock,
	MoreHorizontal,
	Pencil,
	Search,
	Shield,
	Trash2,
	Unlock,
	UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { AdminUserItem, OrderByParams } from "@/hooks/use-admin-users";

interface AdminUserTableProps {
	users: AdminUserItem[];
	totalCount: number;
	loading: boolean;
	currentAdminId?: string;
	search: string;
	onSearchChange: (search: string) => void;
	roleFilter: string;
	onRoleFilterChange: (role: string) => void;
	statusFilter: string;
	onStatusFilterChange: (status: string) => void;
	page: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
	orderBy: OrderByParams;
	onOrderByChange: (orderBy: OrderByParams) => void;
	onSelectUser: (user: AdminUserItem) => void;
	onEditUser: (user: AdminUserItem) => void;
	onChangeRole: (user: AdminUserItem) => void;
	onLockToggle: (user: AdminUserItem) => void;
	onResetPassword: (user: AdminUserItem) => void;
	onDeleteUser: (user: AdminUserItem) => void;
	onVerifyEmailToggle: (user: AdminUserItem, verified: boolean) => Promise<void>;
}

export function AdminUserTable({
	users,
	totalCount,
	loading,
	currentAdminId,
	search,
	onSearchChange,
	roleFilter,
	onRoleFilterChange,
	statusFilter,
	onStatusFilterChange,
	page,
	pageSize,
	onPageChange,
	onPageSizeChange,
	orderBy,
	onOrderByChange,
	onSelectUser,
	onEditUser,
	onChangeRole,
	onLockToggle,
	onResetPassword,
	onDeleteUser,
	onVerifyEmailToggle,
}: AdminUserTableProps) {
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const handleCopyId = (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		navigator.clipboard.writeText(id);
		setCopiedId(id);
		toast.success("ID copié");
		setTimeout(() => setCopiedId(null), 1500);
	};

	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

	const toggleSort = (field: "CREATED_AT" | "EMAIL" | "USERNAME") => {
		if (orderBy.field === field) {
			onOrderByChange({
				field,
				direction: orderBy.direction === "ASC" ? "DESC" : "ASC",
			});
		} else {
			onOrderByChange({
				field,
				direction: "ASC",
			});
		}
	};

	return (
		<div className="space-y-3.5">
			{/* Filters & Search Toolbar */}
			<div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative flex-1 sm:max-w-xs">
					<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
					<Input
						type="search"
						placeholder="Rechercher nom, email ou ID..."
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						className="h-9 pl-9 text-xs bg-card/30 border-border/60 placeholder:text-muted-foreground/60 focus-visible:bg-card/70"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{/* Role Filter */}
					<Select value={roleFilter} onValueChange={onRoleFilterChange}>
						<SelectTrigger className="h-9 w-[130px] text-xs bg-card/30 border-border/60">
							<SelectValue placeholder="Rôle" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Tous les rôles</SelectItem>
							<SelectItem value="USER">Utilisateur</SelectItem>
							<SelectItem value="ADMIN">Admin</SelectItem>
						</SelectContent>
					</Select>

					{/* Status Filter */}
					<Select value={statusFilter} onValueChange={onStatusFilterChange}>
						<SelectTrigger className="h-9 w-[145px] text-xs bg-card/30 border-border/60">
							<SelectValue placeholder="Statut" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="ALL">Tous les statuts</SelectItem>
							<SelectItem value="ACTIVE">Actif</SelectItem>
							<SelectItem value="LOCKED">Verrouillé</SelectItem>
							<SelectItem value="UNVERIFIED">Non vérifié</SelectItem>
						</SelectContent>
					</Select>

					{/* Clear filters if active */}
					{(search || roleFilter !== "ALL" || statusFilter !== "ALL") && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								onSearchChange("");
								onRoleFilterChange("ALL");
								onStatusFilterChange("ALL");
							}}
							className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
						>
							Réinitialiser
						</Button>
					)}
				</div>
			</div>

			{/* Main Data Table */}
			<div className="overflow-hidden rounded-xl border border-border/60 bg-card/30 backdrop-blur-xs">
				<Table>
					<TableHeader className="bg-muted/20">
						<TableRow className="border-b border-border/50 hover:bg-transparent">
							<TableHead className="w-[300px]">
								<button
									type="button"
									className="-ml-2 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
									onClick={() => toggleSort("USERNAME")}
								>
									Utilisateur
									<ArrowUpDown className="h-3 w-3 opacity-60" />
								</button>
							</TableHead>
							<TableHead className="w-[120px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Rôle
							</TableHead>
							<TableHead className="w-[160px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Statut
							</TableHead>
							<TableHead className="w-[180px]">
								<button
									type="button"
									className="-ml-2 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
									onClick={() => toggleSort("CREATED_AT")}
								>
									Activité
									<ArrowUpDown className="h-3 w-3 opacity-60" />
								</button>
							</TableHead>
							<TableHead className="w-[120px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Préférences
							</TableHead>
							<TableHead className="w-[50px] text-right" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading && users.length === 0 ? (
							Array.from({ length: 5 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows
								<TableRow key={i} className="border-b border-border/40">
									<TableCell>
										<div className="flex items-center gap-3">
											<Skeleton className="h-8 w-8 rounded-full" />
											<div className="space-y-1">
												<Skeleton className="h-3.5 w-28" />
												<Skeleton className="h-3 w-36" />
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-14 rounded-full" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-3.5 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-3.5 w-16" />
									</TableCell>
									<TableCell className="text-right">
										<Skeleton className="ml-auto h-7 w-7 rounded-md" />
									</TableCell>
								</TableRow>
							))
						) : users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="h-32 text-center text-xs text-muted-foreground">
									Aucun utilisateur ne correspond à vos critères de recherche.
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => {
								const isSelf = user.id === currentAdminId;
								const initials = (user.username || user.email)
									.split(" ")
									.map((p) => p[0])
									.join("")
									.slice(0, 2)
									.toUpperCase();

								return (
									<TableRow
										key={user.id}
										onClick={() => onSelectUser(user)}
										className="group cursor-pointer border-b border-border/40 transition-colors hover:bg-muted/30"
									>
										{/* User Identity */}
										<TableCell className="py-3">
											<div className="flex items-center gap-3">
												<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40 font-mono text-[11px] font-medium text-foreground/80">
													{initials}
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-1.5">
														<span className="truncate text-xs font-medium text-foreground group-hover:text-primary transition-colors">
															{user.username}
														</span>
														{isSelf && (
															<span className="rounded border border-border/70 bg-muted/30 px-1 py-0 text-[10px] text-muted-foreground">
																Vous
															</span>
														)}
													</div>
													<div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
														<span className="truncate">{user.email}</span>
														<button
															type="button"
															onClick={(e) => handleCopyId(e, user.id)}
															className="opacity-50 hover:opacity-100 transition-opacity"
															title="Copier l'ID"
														>
															{copiedId === user.id ? (
																<Check className="h-3 w-3 text-emerald-500" />
															) : (
																<Copy className="h-3 w-3" />
															)}
														</button>
													</div>
												</div>
											</div>
										</TableCell>

										{/* Role */}
										<TableCell className="py-3">
											{user.role === "ADMIN" ? (
												<span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-foreground">
													<Shield className="h-3 w-3 text-muted-foreground" />
													ADMIN
												</span>
											) : (
												<span className="inline-flex items-center rounded-full border border-border/40 bg-transparent px-2 py-0.5 text-[11px] text-muted-foreground">
													USER
												</span>
											)}
										</TableCell>

										{/* Status: Sleek dots + inline status */}
										<TableCell className="py-3">
											<div className="flex items-center gap-2">
												{user.isLocked ? (
													<span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500">
														<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
														Verrouillé
													</span>
												) : (
													<span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/90">
														<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
														Actif
													</span>
												)}

												{user.emailVerified ? (
													<span className="text-[11px] text-muted-foreground/60 flex items-center">
														<span className="mr-1 text-muted-foreground/40">·</span>
														<span>Vérifié</span>
													</span>
												) : (
													<span className="text-[11px] font-medium text-amber-500 flex items-center">
														<span className="mr-1 text-muted-foreground/40">·</span>
														<span>Non vérifié</span>
													</span>
												)}
											</div>
										</TableCell>

										{/* Activity & Last Login */}
										<TableCell className="py-3">
											<div className="text-xs">
												<div className="text-foreground/85 tabular-nums">
													{user.lastLoginAt
														? formatDistanceToNow(new Date(user.lastLoginAt), {
																addSuffix: true,
																locale: fr,
															})
														: "Jamais connecté"}
												</div>
												{user.failedLoginCount > 0 && (
													<div className="text-[11px] font-mono text-rose-400">
														{user.failedLoginCount} échec(s)
													</div>
												)}
											</div>
										</TableCell>

										{/* Preferences */}
										<TableCell className="py-3">
											<div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
												<span className="rounded border border-border/50 bg-muted/20 px-1 py-0.5">
													{user.displayCurrency || "USD"}
												</span>
												<span className="rounded border border-border/50 bg-muted/20 px-1 py-0.5">
													{user.taxJurisdiction || "FR"}
												</span>
											</div>
										</TableCell>

										{/* Actions Menu */}
										<TableCell
											className="py-3 text-right"
											onClick={(e) => e.stopPropagation()}
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
													>
														<MoreHorizontal className="h-4 w-4" />
														<span className="sr-only">Actions</span>
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" className="w-52">
													<DropdownMenuLabel className="text-xs text-muted-foreground">
														Actions utilisateur
													</DropdownMenuLabel>
													<DropdownMenuItem
														onClick={() => onSelectUser(user)}
														className="gap-2 text-xs"
													>
														<Eye className="h-3.5 w-3.5 text-muted-foreground" />
														Détails du compte
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => onEditUser(user)}
														className="gap-2 text-xs"
													>
														<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
														Modifier les coordonnées
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => onChangeRole(user)}
														disabled={isSelf}
														className="gap-2 text-xs"
													>
														<Shield className="h-3.5 w-3.5 text-muted-foreground" />
														Changer le rôle
													</DropdownMenuItem>

													<DropdownMenuSeparator />

													<DropdownMenuItem
														onClick={() => onResetPassword(user)}
														className="gap-2 text-xs"
													>
														<KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
														Réinitialiser mot de passe
													</DropdownMenuItem>

													<DropdownMenuItem
														onClick={() => onLockToggle(user)}
														disabled={isSelf && !user.isLocked}
														className="gap-2 text-xs"
													>
														{user.isLocked ? (
															<>
																<Unlock className="h-3.5 w-3.5 text-muted-foreground" />
																Déverrouiller le compte
															</>
														) : (
															<>
																<Lock className="h-3.5 w-3.5 text-muted-foreground" />
																Verrouiller le compte
															</>
														)}
													</DropdownMenuItem>

													<DropdownMenuItem
														onClick={() => onVerifyEmailToggle(user, !user.emailVerified)}
														className="gap-2 text-xs"
													>
														<UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
														{user.emailVerified ? "Révoquer email" : "Valider email"}
													</DropdownMenuItem>

													<DropdownMenuSeparator />

													<DropdownMenuItem
														onClick={() => onDeleteUser(user)}
														disabled={isSelf}
														className="gap-2 text-xs text-destructive focus:text-destructive"
													>
														<Trash2 className="h-3.5 w-3.5" />
														Désactiver / Supprimer
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
									</TableRow>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination Controls */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span>Afficher</span>
					<Select
						value={String(pageSize)}
						onValueChange={(val) => {
							onPageSizeChange(Number.parseInt(val, 10));
							onPageChange(1);
						}}
					>
						<SelectTrigger className="h-8 w-[65px] text-xs bg-card/30 border-border/60">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="10">10</SelectItem>
							<SelectItem value="20">20</SelectItem>
							<SelectItem value="50">50</SelectItem>
						</SelectContent>
					</Select>
					<span>sur {totalCount} utilisateur(s)</span>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground tabular-nums">
						Page {page} sur {totalPages}
					</span>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8 border-border/60 bg-card/30"
							onClick={() => onPageChange(page - 1)}
							disabled={page <= 1 || loading}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							className="h-8 w-8 border-border/60 bg-card/30"
							onClick={() => onPageChange(page + 1)}
							disabled={page >= totalPages || loading}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
