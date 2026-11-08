import {
	AlertCircle,
	Check,
	LogOut,
	Settings,
	Trash2,
	UserPlus,
} from "lucide-react";
import { useState } from "react";
import { AddAccountDialog } from "@/components/auth/AddAccountDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface AccountSwitcherMenuProps {
	children: React.ReactNode;
	align?: "start" | "end" | "center";
	side?: "top" | "bottom" | "left" | "right";
	sideOffset?: number;
	className?: string;
	onNavigateSettings?: () => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function AccountSwitcherMenu({
	children,
	align = "start",
	side = "top",
	sideOffset = 8,
	className,
	onNavigateSettings,
	open,
	onOpenChange,
}: AccountSwitcherMenuProps) {
	const {
		user,
		accounts,
		switchAccount,
		removeAccountSession,
		logout,
		logoutAllAccounts,
	} = useAuth();

	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [reauthEmail, setReauthEmail] = useState<string | undefined>(undefined);
	const [isReauth, setIsReauth] = useState(false);

	const getInitials = (name?: string, email?: string) => {
		if (name) {
			const parts = name.trim().split(/\s+/);
			if (parts.length >= 2) {
				return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
			}
			return parts[0].slice(0, 2).toUpperCase();
		}
		if (email) {
			return email.slice(0, 2).toUpperCase();
		}
		return "U";
	};

	const handleOpenAddDialog = () => {
		setReauthEmail(undefined);
		setIsReauth(false);
		setIsAddDialogOpen(true);
	};

	const handleOpenReauthDialog = (email: string) => {
		setReauthEmail(email);
		setIsReauth(true);
		setIsAddDialogOpen(true);
	};

	return (
		<>
			<DropdownMenu open={open} onOpenChange={onOpenChange}>
				<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
				<DropdownMenuContent
					align={align}
					side={side}
					sideOffset={sideOffset}
					className={cn(
						"w-72 border-border/60 bg-card/95 backdrop-blur-md p-1.5 shadow-xl text-xs",
						className,
					)}
				>
					{/* Active Account Overview */}
					<div className="flex items-center gap-2.5 px-2 py-2">
						<Avatar className="h-9 w-9 rounded-lg border border-border/80 shrink-0">
							<AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
								{getInitials(user?.name, user?.email)}
							</AvatarFallback>
						</Avatar>
						<div className="flex flex-col min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="font-semibold text-foreground text-xs truncate">
									{user?.name || "Utilisateur"}
								</span>
								{user?.role === "ADMIN" && (
									<Badge
										variant="outline"
										className="h-4 px-1 text-[9px] font-semibold border-primary/30 text-primary bg-primary/5 uppercase"
									>
										Admin
									</Badge>
								)}
							</div>
							<span className="text-muted-foreground text-micro truncate leading-tight">
								{user?.email}
							</span>
						</div>
					</div>

					<DropdownMenuSeparator className="my-1 border-border/50" />

					{/* Accounts List Section */}
					<DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
						<span>Comptes connectés</span>
						<span className="text-[10px] tabular-nums bg-muted px-1.5 py-0.2 rounded-full text-foreground/80">
							{accounts.length}
						</span>
					</DropdownMenuLabel>

					<div className="max-h-52 overflow-y-auto space-y-0.5 py-0.5">
						{accounts.map((session) => {
							const isActive = session.user.id === user?.id;
							const isExpired = session.isExpired;

							return (
								<div
									key={session.user.id}
									className={cn(
										"group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer select-none",
										isActive
											? "bg-primary/10 text-foreground"
											: "hover:bg-muted/70 text-foreground/80 hover:text-foreground",
									)}
									onClick={() => {
										if (isExpired) {
											handleOpenReauthDialog(session.user.email);
										} else if (!isActive) {
											switchAccount(session.user.id);
										}
									}}
								>
									<div className="flex items-center gap-2 min-w-0 flex-1">
										<Avatar className="h-7 w-7 rounded-md border border-border/60 shrink-0">
											<AvatarFallback className="bg-muted text-[10px] font-medium text-foreground/70">
												{getInitials(session.user.name, session.user.email)}
											</AvatarFallback>
										</Avatar>
										<div className="flex flex-col min-w-0 flex-1">
											<div className="flex items-center gap-1.5">
												<span className="truncate text-xs font-medium leading-none">
													{session.user.name}
												</span>
												{session.user.role === "ADMIN" && (
													<Badge
														variant="outline"
														className="h-3.5 px-1 text-[8px] border-primary/20 text-primary bg-primary/5 uppercase font-medium"
													>
														Admin
													</Badge>
												)}
											</div>
											<span className="truncate text-micro text-muted-foreground leading-tight">
												{session.user.email}
											</span>
										</div>
									</div>

									<div className="flex items-center gap-1 shrink-0">
										{isExpired ? (
											<Badge
												variant="outline"
												className="h-4 px-1.5 text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-500 font-medium gap-1"
											>
												<AlertCircle className="h-2.5 w-2.5" />
												Expiré
											</Badge>
										) : isActive ? (
											<Check className="h-4 w-4 text-primary shrink-0" />
										) : null}

										{!isActive && (
											<button
												type="button"
												title="Détacher ce compte"
												onClick={(e) => {
													e.stopPropagation();
													removeAccountSession(session.user.id);
												}}
												className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-opacity"
											>
												<Trash2 className="h-3.5 w-3.5" />
												<span className="sr-only">Détacher</span>
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>

					{/* Add Account Action */}
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault();
							handleOpenAddDialog();
						}}
						className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs font-medium text-foreground/80 hover:text-foreground focus:bg-muted"
					>
						<UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
						<span>Ajouter un autre compte</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="my-1 border-border/50" />

					{/* Settings Navigation */}
					<DropdownMenuItem
						onClick={onNavigateSettings}
						className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs text-foreground/80 hover:text-foreground focus:bg-muted"
					>
						<Settings className="h-3.5 w-3.5 text-muted-foreground" />
						<span>Paramètres du compte</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="my-1 border-border/50" />

					{/* Logouts */}
					<DropdownMenuItem
						onClick={logout}
						className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
					>
						<LogOut className="h-3.5 w-3.5" />
						<span>Se déconnecter de ce compte</span>
					</DropdownMenuItem>

					{accounts.length > 1 && (
						<DropdownMenuItem
							onClick={logoutAllAccounts}
							className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs text-destructive/80 hover:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
						>
							<LogOut className="h-3.5 w-3.5" />
							<span>Se déconnecter de tous les comptes</span>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Add/Reauth Dialog */}
			<AddAccountDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				initialEmail={reauthEmail}
				isReauth={isReauth}
			/>
		</>
	);
}
