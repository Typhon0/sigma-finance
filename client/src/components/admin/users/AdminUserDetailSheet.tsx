import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
	Briefcase,
	Calendar,
	Check,
	Clock,
	Copy,
	Eye,
	KeyRound,
	Lock,
	Pencil,
	Shield,
	Trash2,
	Unlock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { AdminUserItem } from "@/hooks/use-admin-users";

interface AdminUserDetailSheetProps {
	user: AdminUserItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentAdminId?: string;
	onEdit: (user: AdminUserItem) => void;
	onChangeRole: (user: AdminUserItem) => void;
	onLockToggle: (user: AdminUserItem) => void;
	onResetPassword: (user: AdminUserItem) => void;
	onDelete: (user: AdminUserItem) => void;
	onVerifyEmailToggle: (user: AdminUserItem, verified: boolean) => Promise<void>;
}

export function AdminUserDetailSheet({
	user,
	open,
	onOpenChange,
	currentAdminId,
	onEdit,
	onChangeRole,
	onLockToggle,
	onResetPassword,
	onDelete,
	onVerifyEmailToggle,
}: AdminUserDetailSheetProps) {
	const [copied, setCopied] = useState(false);
	const [togglingEmail, setTogglingEmail] = useState(false);

	if (!user) return null;

	const isSelf = user.id === currentAdminId;

	const handleCopyId = () => {
		navigator.clipboard.writeText(user.id);
		setCopied(true);
		toast.success("ID copié dans le presse-papier");
		setTimeout(() => setCopied(false), 2000);
	};

	const handleEmailVerification = async () => {
		try {
			setTogglingEmail(true);
			await onVerifyEmailToggle(user, !user.emailVerified);
		} finally {
			setTogglingEmail(false);
		}
	};

	const initials = (user.username || user.email)
		.split(" ")
		.map((part) => part[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-full sm:max-w-md overflow-y-auto p-6">
				{/* Sheet Header */}
				<SheetHeader className="pb-4">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/40 font-mono text-xs font-semibold text-foreground/90">
							{initials}
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<SheetTitle className="truncate text-base font-semibold">
									{user.username}
								</SheetTitle>
								{isSelf && (
									<span className="rounded border border-border/70 bg-muted/30 px-1 py-0 text-[10px] text-muted-foreground">
										Vous
									</span>
								)}
							</div>
							<SheetDescription className="truncate text-xs font-mono text-muted-foreground">
								{user.email}
							</SheetDescription>
						</div>

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
					</div>
				</SheetHeader>

				<div className="space-y-5 pt-1">
					{/* Integrated ID Pill */}
					<div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
						<span className="font-mono text-[11px]">
							ID : <span className="text-foreground/80 select-all">{user.id}</span>
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6 text-muted-foreground hover:text-foreground"
							onClick={handleCopyId}
							title="Copier l'identifiant"
						>
							{copied ? (
								<Check className="h-3 w-3 text-emerald-500" />
							) : (
								<Copy className="h-3 w-3" />
							)}
						</Button>
					</div>

					{/* Security & Authentication */}
					<div className="space-y-2">
						<h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Sécurité & Authentification
						</h4>
						<div className="rounded-lg border border-border/40 bg-card/20 divide-y divide-border/30 px-3.5 py-0.5 text-xs">
							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Statut du compte</span>
								{user.isLocked ? (
									<span className="inline-flex items-center gap-1.5 font-medium text-rose-500">
										<span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
										Verrouillé
									</span>
								) : (
									<span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
										<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
										Actif
									</span>
								)}
							</div>

							{user.lockedUntil && (
								<div className="flex items-center justify-between py-2 text-xs">
									<span className="text-muted-foreground">Verrouillé jusqu'au</span>
									<span className="font-mono text-rose-400">
										{format(new Date(user.lockedUntil), "dd MMM yyyy HH:mm", { locale: fr })}
									</span>
								</div>
							)}

							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Échecs de connexion</span>
								<span
									className={`font-mono tabular-nums ${
										user.failedLoginCount > 0 ? "text-amber-500 font-medium" : "text-muted-foreground"
									}`}
								>
									{user.failedLoginCount} tentative(s)
								</span>
							</div>

							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Dernière connexion</span>
								<span className="tabular-nums text-foreground/80">
									{user.lastLoginAt
										? formatDistanceToNow(new Date(user.lastLoginAt), {
												addSuffix: true,
												locale: fr,
											})
										: "Jamais connecté"}
								</span>
							</div>

							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Email vérifié</span>
								<div className="flex items-center gap-2">
									<span
										className={`inline-flex items-center gap-1 font-medium ${
											user.emailVerified ? "text-foreground/90" : "text-amber-500"
										}`}
									>
										<span
											className={`h-1.5 w-1.5 rounded-full ${
												user.emailVerified ? "bg-emerald-500" : "bg-amber-500"
											}`}
										/>
										{user.emailVerified ? "Vérifié" : "Non vérifié"}
									</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
										onClick={handleEmailVerification}
										disabled={togglingEmail}
									>
										{user.emailVerified ? "Révoquer" : "Valider"}
									</Button>
								</div>
							</div>
						</div>
					</div>

					{/* Preferences & Locale */}
					<div className="space-y-2">
						<h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Préférences & Paramètres
						</h4>
						<div className="rounded-lg border border-border/40 bg-card/20 divide-y divide-border/30 px-3.5 py-0.5 text-xs">
							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Devise d'affichage</span>
								<span className="font-mono rounded border border-border/50 bg-muted/20 px-1.5 py-0.5 text-[11px]">
									{user.displayCurrency || "USD"}
								</span>
							</div>
							<div className="flex items-center justify-between py-2">
								<span className="text-muted-foreground">Juridiction fiscale</span>
								<span className="font-mono rounded border border-border/50 bg-muted/20 px-1.5 py-0.5 text-[11px]">
									{user.taxJurisdiction || "FR"}
								</span>
							</div>
							<div className="flex items-center justify-between py-2 text-[11px] text-muted-foreground">
								<span className="flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									Création du compte
								</span>
								<span className="font-mono">
									{user.createdAt ? format(new Date(user.createdAt), "dd/MM/yyyy HH:mm") : "-"}
								</span>
							</div>
							<div className="flex items-center justify-between py-2 text-[11px] text-muted-foreground">
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									Dernière modification
								</span>
								<span className="font-mono">
									{user.updatedAt ? format(new Date(user.updatedAt), "dd/MM/yyyy HH:mm") : "-"}
								</span>
							</div>
						</div>
					</div>

					{/* Portfolios & Data counts */}
					<div className="space-y-2">
						<h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Données Financières
						</h4>
						<div className="grid grid-cols-2 gap-2.5">
							<div className="rounded-lg border border-border/40 bg-card/20 p-3">
								<div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
									<Briefcase className="h-3.5 w-3.5" />
									<span>Portefeuilles</span>
								</div>
								<p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
									{user.portfolios?.length ?? 0}
								</p>
								{user.portfolios && user.portfolios.length > 0 && (
									<p className="mt-0.5 truncate text-[11px] text-muted-foreground/80 font-mono">
										{user.portfolios.map((p) => p.name).join(", ")}
									</p>
								)}
							</div>

							<div className="rounded-lg border border-border/40 bg-card/20 p-3">
								<div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium">
									<Eye className="h-3.5 w-3.5" />
									<span>Listes de suivi</span>
								</div>
								<p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
									{user.watchlists?.length ?? 0}
								</p>
							</div>
						</div>
					</div>

					{/* Administrative Actions */}
					<div className="space-y-2 pt-1">
						<h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
							Actions Administratives
						</h4>
						<div className="grid grid-cols-2 gap-2">
							<Button
								variant="outline"
								size="sm"
								className="h-9 justify-start gap-2 text-xs border-border/60 bg-card/30"
								onClick={() => {
									onOpenChange(false);
									onEdit(user);
								}}
							>
								<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
								Modifier le profil
							</Button>

							<Button
								variant="outline"
								size="sm"
								className="h-9 justify-start gap-2 text-xs border-border/60 bg-card/30"
								onClick={() => {
									onOpenChange(false);
									onChangeRole(user);
								}}
								disabled={isSelf}
							>
								<Shield className="h-3.5 w-3.5 text-muted-foreground" />
								Changer le rôle
							</Button>

							<Button
								variant="outline"
								size="sm"
								className="h-9 justify-start gap-2 text-xs border-border/60 bg-card/30"
								onClick={() => {
									onOpenChange(false);
									onResetPassword(user);
								}}
							>
								<KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
								Nouveau mot de passe
							</Button>

							<Button
								variant="outline"
								size="sm"
								className="h-9 justify-start gap-2 text-xs border-border/60 bg-card/30"
								onClick={() => {
									onOpenChange(false);
									onLockToggle(user);
								}}
								disabled={isSelf && !user.isLocked}
							>
								{user.isLocked ? (
									<>
										<Unlock className="h-3.5 w-3.5 text-muted-foreground" />
										Déverrouiller
									</>
								) : (
									<>
										<Lock className="h-3.5 w-3.5 text-muted-foreground" />
										Verrouiller
									</>
								)}
							</Button>
						</div>

						{/* Discreet Danger Zone */}
						<div className="pt-2">
							<Button
								variant="ghost"
								size="sm"
								className="w-full justify-start gap-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
								onClick={() => {
									onOpenChange(false);
									onDelete(user);
								}}
								disabled={isSelf}
							>
								<Trash2 className="h-3.5 w-3.5" />
								Désactiver ou supprimer ce compte
							</Button>
						</div>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
