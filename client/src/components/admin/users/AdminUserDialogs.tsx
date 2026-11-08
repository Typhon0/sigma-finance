import { AlertTriangle, KeyRound, Lock, Shield, Trash2, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdminUserItem } from "@/hooks/use-admin-users";

// Helper to generate a secure random password
function generateStrongPassword(): string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
	let pwd = "";
	const array = new Uint32Array(16);
	window.crypto.getRandomValues(array);
	for (let i = 0; i < 16; i++) {
		pwd += chars[array[i] % chars.length];
	}
	return pwd;
}

// ----------------------------------------------------
// 1. Create User Dialog
// ----------------------------------------------------
interface CreateUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: {
		name: string;
		email: string;
		password: string;
		role: string;
		emailVerified: boolean;
	}) => Promise<void>;
}

export function AdminCreateUserDialog({ open, onOpenChange, onSubmit }: CreateUserDialogProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [role, setRole] = useState("USER");
	const [emailVerified, setEmailVerified] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleGeneratePassword = () => {
		setPassword(generateStrongPassword());
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (!email.trim()) {
			setError("L'adresse email est requise");
			return;
		}
		if (password.length < 8) {
			setError("Le mot de passe doit contenir au moins 8 caractères");
			return;
		}

		try {
			setIsSubmitting(true);
			await onSubmit({
				name: name.trim() || email.split("@")[0],
				email: email.trim(),
				password,
				role,
				emailVerified,
			});
			setName("");
			setEmail("");
			setPassword("");
			setRole("USER");
			setEmailVerified(true);
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Erreur lors de la création");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Créer un nouvel utilisateur</DialogTitle>
					<DialogDescription>
						Ajoutez manuellement un utilisateur avec ses identifiants initiaux.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="create-name">Nom complet ou pseudonyme</Label>
						<Input
							id="create-name"
							placeholder="Ex: Jean Dupont"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="create-email">Adresse email</Label>
						<Input
							id="create-email"
							type="email"
							placeholder="jean.dupont@example.com"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="create-password">Mot de passe temporaire</Label>
							<button
								type="button"
								onClick={handleGeneratePassword}
								className="text-xs text-primary hover:underline"
							>
								Générer un mot de passe fort
							</button>
						</div>
						<Input
							id="create-password"
							type="text"
							placeholder="Minimum 8 caractères"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="create-role">Rôle</Label>
						<Select value={role} onValueChange={setRole}>
							<SelectTrigger id="create-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="USER">Utilisateur Standard (USER)</SelectItem>
								<SelectItem value="ADMIN">Administrateur (ADMIN)</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center justify-between rounded-lg border p-3">
						<div className="space-y-0.5">
							<Label htmlFor="create-email-verified" className="text-sm font-medium">
								Pré-vérifier l'adresse email
							</Label>
							<p className="text-xs text-muted-foreground">
								Permet à l'utilisateur de se connecter immédiatement sans confirmation par mail.
							</p>
						</div>
						<Switch
							id="create-email-verified"
							checked={emailVerified}
							onCheckedChange={setEmailVerified}
						/>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Création..." : "Créer l'utilisateur"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ----------------------------------------------------
// 2. Edit User Dialog
// ----------------------------------------------------
interface EditUserDialogProps {
	user: AdminUserItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (
		id: string,
		data: {
			name?: string;
			email?: string;
			taxJurisdiction?: string;
			displayCurrency?: string;
		},
	) => Promise<void>;
}

export function AdminEditUserDialog({ user, open, onOpenChange, onSubmit }: EditUserDialogProps) {
	const [name, setName] = useState(user?.username ?? "");
	const [email, setEmail] = useState(user?.email ?? "");
	const [taxJurisdiction, setTaxJurisdiction] = useState(user?.taxJurisdiction ?? "FR");
	const [displayCurrency, setDisplayCurrency] = useState(user?.displayCurrency ?? "USD");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Sync when user changes
	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen && user) {
			setName(user.username);
			setEmail(user.email);
			setTaxJurisdiction(user.taxJurisdiction || "FR");
			setDisplayCurrency(user.displayCurrency || "USD");
			setError(null);
		}
		onOpenChange(nextOpen);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setError(null);

		try {
			setIsSubmitting(true);
			await onSubmit(user.id, {
				name: name.trim(),
				email: email.trim(),
				taxJurisdiction: taxJurisdiction.trim(),
				displayCurrency: displayCurrency.trim(),
			});
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Échec de la modification");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!user) return null;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Modifier l'utilisateur</DialogTitle>
					<DialogDescription>
						Mise à jour des coordonnées et préférences de compte de {user.username}.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="edit-name">Nom complet</Label>
						<Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="edit-email">Adresse email</Label>
						<Input
							id="edit-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="edit-currency">Devise</Label>
							<Select value={displayCurrency} onValueChange={setDisplayCurrency}>
								<SelectTrigger id="edit-currency">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="USD">USD ($)</SelectItem>
									<SelectItem value="EUR">EUR (€)</SelectItem>
									<SelectItem value="GBP">GBP (£)</SelectItem>
									<SelectItem value="CHF">CHF (Fr)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="edit-tax">Juridiction fiscale</Label>
							<Select value={taxJurisdiction} onValueChange={setTaxJurisdiction}>
								<SelectTrigger id="edit-tax">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="FR">France (FR)</SelectItem>
									<SelectItem value="US">États-Unis (US)</SelectItem>
									<SelectItem value="DE">Allemagne (DE)</SelectItem>
									<SelectItem value="UK">Royaume-Uni (UK)</SelectItem>
									<SelectItem value="CH">Suisse (CH)</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Enregistrement..." : "Enregistrer"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ----------------------------------------------------
// 3. Change Role Dialog
// ----------------------------------------------------
interface ChangeRoleDialogProps {
	user: AdminUserItem | null;
	currentAdminId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (id: string, role: string) => Promise<void>;
}

export function AdminChangeRoleDialog({
	user,
	currentAdminId,
	open,
	onOpenChange,
	onSubmit,
}: ChangeRoleDialogProps) {
	const [role, setRole] = useState(user?.role ?? "USER");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isSelf = user?.id === currentAdminId;

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen && user) {
			setRole(user.role);
			setError(null);
		}
		onOpenChange(nextOpen);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setError(null);

		if (isSelf && role !== "ADMIN") {
			setError("Vous ne pouvez pas rétrograder votre propre compte administrateur.");
			return;
		}

		try {
			setIsSubmitting(true);
			await onSubmit(user.id, role);
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Erreur lors du changement de rôle");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!user) return null;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Shield className="h-4 w-4 text-muted-foreground" />
						Modifier le rôle de {user.username}
					</DialogTitle>
					<DialogDescription>
						Définissez les privilèges accordés à cet utilisateur sur la plateforme.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{isSelf && (
						<Alert className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription className="text-xs">
								Vous modifiez votre propre compte. Vous ne pouvez pas retirer vos droits
								d'administrateur.
							</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label className="text-xs font-medium">Sélectionnez un rôle</Label>
						<RadioGroup value={role} onValueChange={setRole} className="space-y-2">
							<div
								className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
									role === "USER"
										? "border-primary/60 bg-muted/40"
										: "border-border/60 bg-card/20 hover:bg-muted/20"
								}`}
							>
								<RadioGroupItem value="USER" id="role-user" disabled={isSelf} className="mt-1" />
								<Label htmlFor="role-user" className="cursor-pointer space-y-0.5">
									<div className="text-xs font-semibold text-foreground">
										Utilisateur Standard (USER)
									</div>
									<div className="text-[11px] text-muted-foreground">
										Accès à ses portefeuilles personnels, transactions, watchlist et paramètres de
										profil.
									</div>
								</Label>
							</div>

							<div
								className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
									role === "ADMIN"
										? "border-primary/60 bg-muted/40"
										: "border-border/60 bg-card/20 hover:bg-muted/20"
								}`}
							>
								<RadioGroupItem value="ADMIN" id="role-admin" className="mt-1" />
								<Label htmlFor="role-admin" className="cursor-pointer space-y-0.5">
									<div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
										Administrateur (ADMIN)
									</div>
									<div className="text-[11px] text-muted-foreground">
										Accès complet : gestion de tous les utilisateurs, supervision globale et
										paramètres système.
									</div>
								</Label>
							</div>
						</RadioGroup>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting || role === user.role}>
							{isSubmitting ? "Modification..." : "Confirmer le rôle"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ----------------------------------------------------
// 4. Lock / Unlock Dialog
// ----------------------------------------------------
interface LockUserDialogProps {
	user: AdminUserItem | null;
	currentAdminId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (id: string, locked: boolean, lockUntil?: string | null) => Promise<void>;
}

export function AdminLockUserDialog({
	user,
	currentAdminId,
	open,
	onOpenChange,
	onSubmit,
}: LockUserDialogProps) {
	const [durationHours, setDurationHours] = useState("24");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;
	const isSelf = user.id === currentAdminId;
	const isCurrentlyLocked = user.isLocked;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (isSelf && !isCurrentlyLocked) {
			setError("Vous ne pouvez pas verrouiller votre propre compte.");
			return;
		}

		try {
			setIsSubmitting(true);
			if (isCurrentlyLocked) {
				// Unlock
				await onSubmit(user.id, false, null);
			} else {
				// Lock
				let lockUntil: string | null = null;
				if (durationHours === "indefinite") {
					const date = new Date();
					date.setFullYear(date.getFullYear() + 10);
					lockUntil = date.toISOString();
				} else {
					const date = new Date();
					date.setHours(date.getHours() + Number.parseInt(durationHours, 10));
					lockUntil = date.toISOString();
				}
				await onSubmit(user.id, true, lockUntil);
			}
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Erreur lors de la modification du verrou");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Lock className="h-5 w-5 text-rose-500" />
						{isCurrentlyLocked
							? `Déverrouiller ${user.username}`
							: `Verrouiller le compte de ${user.username}`}
					</DialogTitle>
					<DialogDescription>
						{isCurrentlyLocked
							? "Le déverrouillage réinitialise immédiatement le compteur de tentatives de connexion échouées et restaure l'accès."
							: "Le verrouillage révoque instantanément toutes les sessions actives et empêche toute nouvelle connexion."}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{!isCurrentlyLocked && (
						<div className="space-y-1.5">
							<Label htmlFor="lock-duration">Durée du verrouillage</Label>
							<Select value={durationHours} onValueChange={setDurationHours}>
								<SelectTrigger id="lock-duration">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="1">1 heure</SelectItem>
									<SelectItem value="24">24 heures (1 jour)</SelectItem>
									<SelectItem value="168">7 jours (1 semaine)</SelectItem>
									<SelectItem value="720">30 jours (1 mois)</SelectItem>
									<SelectItem value="indefinite">
										Indéfini (jusqu'à déverrouillage manuel)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					)}

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button
							type="submit"
							variant={isCurrentlyLocked ? "default" : "destructive"}
							disabled={isSubmitting || (isSelf && !isCurrentlyLocked)}
						>
							{isSubmitting
								? "En cours..."
								: isCurrentlyLocked
									? "Déverrouiller le compte"
									: "Verrouiller et déconnecter"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ----------------------------------------------------
// 5. Reset Password Dialog
// ----------------------------------------------------
interface ResetPasswordDialogProps {
	user: AdminUserItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (id: string, newPassword: string) => Promise<void>;
}

export function AdminResetPasswordDialog({
	user,
	open,
	onOpenChange,
	onSubmit,
}: ResetPasswordDialogProps) {
	const [password, setPassword] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;

	const handleGenerate = () => {
		setPassword(generateStrongPassword());
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError("Le mot de passe doit comporter au moins 8 caractères");
			return;
		}

		try {
			setIsSubmitting(true);
			await onSubmit(user.id, password);
			setPassword("");
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Erreur de réinitialisation");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<KeyRound className="h-5 w-5 text-amber-500" />
						Réinitialiser le mot de passe
					</DialogTitle>
					<DialogDescription>
						Définissez un nouveau mot de passe pour {user.username}. Toutes les sessions actives
						seront immédiatement fermées.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="reset-password">Nouveau mot de passe</Label>
							<button
								type="button"
								onClick={handleGenerate}
								className="text-xs text-primary hover:underline"
							>
								Générer un mot de passe fort
							</button>
						</div>
						<Input
							id="reset-password"
							type="text"
							placeholder="Minimum 8 caractères"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button type="submit" disabled={isSubmitting || password.length < 8}>
							{isSubmitting ? "Enregistrement..." : "Réinitialiser et déconnecter"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ----------------------------------------------------
// 6. Delete / Deactivate User Dialog (Agreed in grill-me)
// ----------------------------------------------------
interface DeleteUserDialogProps {
	user: AdminUserItem | null;
	currentAdminId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (id: string, hardDelete: boolean) => Promise<void>;
}

export function AdminDeleteUserDialog({
	user,
	currentAdminId,
	open,
	onOpenChange,
	onSubmit,
}: DeleteUserDialogProps) {
	const [actionType, setActionType] = useState<"soft" | "hard">("soft");
	const [confirmEmail, setConfirmEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;
	const isSelf = user.id === currentAdminId;

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			setActionType("soft");
			setConfirmEmail("");
			setError(null);
		}
		onOpenChange(nextOpen);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (isSelf) {
			setError("Vous ne pouvez pas désactiver ou supprimer votre propre compte.");
			return;
		}

		if (actionType === "hard" && confirmEmail.trim() !== user.email) {
			setError(`Veuillez saisir exactement l'adresse email "${user.email}" pour confirmer.`);
			return;
		}

		try {
			setIsSubmitting(true);
			await onSubmit(user.id, actionType === "hard");
			onOpenChange(false);
		} catch (err: any) {
			setError(err.message || "Erreur lors de l'opération");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<Trash2 className="h-5 w-5" />
						Sanction du compte de {user.username}
					</DialogTitle>
					<DialogDescription>
						Choisissez entre une désactivation réversible ou une suppression irréversible.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 py-2">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{isSelf && (
						<Alert variant="destructive">
							<AlertTriangle className="h-4 w-4" />
							<AlertDescription className="text-xs">
								Action impossible : vous ne pouvez pas supprimer ni désactiver votre propre compte.
							</AlertDescription>
						</Alert>
					)}

					<RadioGroup
						value={actionType}
						onValueChange={(val) => setActionType(val as "soft" | "hard")}
						className="space-y-2.5"
					>
						<div
							className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
								actionType === "soft"
									? "border-primary/60 bg-muted/40"
									: "border-border/60 bg-card/20 hover:bg-muted/20"
							}`}
						>
							<RadioGroupItem value="soft" id="action-soft" className="mt-1" />
							<Label htmlFor="action-soft" className="cursor-pointer space-y-0.5">
								<div className="flex items-center gap-2 text-xs font-semibold text-foreground">
									<UserX className="h-3.5 w-3.5 text-muted-foreground" />
									Désactiver le compte (Recommandé)
								</div>
								<div className="text-[11px] text-muted-foreground">
									Le compte est verrouillé indéfiniment et toutes ses sessions sont révoquées. Ses
									portefeuilles et son historique financier restent préservés.
								</div>
							</Label>
						</div>

						<div
							className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
								actionType === "hard"
									? "border-destructive/60 bg-destructive/5"
									: "border-border/60 bg-card/20 hover:bg-muted/20"
							}`}
						>
							<RadioGroupItem value="hard" id="action-hard" className="mt-1" />
							<Label htmlFor="action-hard" className="cursor-pointer space-y-0.5">
								<div className="flex items-center gap-2 text-xs font-semibold text-destructive">
									<Trash2 className="h-3.5 w-3.5" />
									Supprimer définitivement (Irréversible)
								</div>
								<div className="text-[11px] text-muted-foreground">
									Suppression définitive en base de données. Tous les portefeuilles, positions et
									historiques seront effacés sans retour possible.
								</div>
							</Label>
						</div>
					</RadioGroup>

					{actionType === "hard" && (
						<div className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
							<Label htmlFor="confirm-email" className="text-xs font-semibold text-destructive">
								Tapez <span className="underline">{user.email}</span> pour confirmer :
							</Label>
							<Input
								id="confirm-email"
								type="email"
								placeholder={user.email}
								value={confirmEmail}
								onChange={(e) => setConfirmEmail(e.target.value)}
								className="border-destructive/40"
								required
							/>
						</div>
					)}

					<DialogFooter className="pt-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Annuler
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={
								isSubmitting ||
								isSelf ||
								(actionType === "hard" && confirmEmail.trim() !== user.email)
							}
						>
							{isSubmitting
								? "Traitement..."
								: actionType === "hard"
									? "Supprimer définitivement"
									: "Désactiver le compte"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
