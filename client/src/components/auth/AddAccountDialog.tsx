import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
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
import { useAuth } from "@/lib/auth-context";

interface AddAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialEmail?: string;
	isReauth?: boolean;
}

export function AddAccountDialog({
	open,
	onOpenChange,
	initialEmail = "",
	isReauth = false,
}: AddAccountDialogProps) {
	const { addAccount } = useAuth();
	const [email, setEmail] = useState(initialEmail);
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setEmail(initialEmail);
			setPassword("");
			setError(null);
			setShowPassword(false);
		}
	}, [open, initialEmail]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !password) {
			setError("Veuillez renseigner l'adresse email et le mot de passe.");
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			const res = await addAccount(trimmedEmail, password);
			if (res.success) {
				onOpenChange(false);
			} else {
				setError(res.error || "Identifiants invalides. Veuillez réessayer.");
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Une erreur est survenue lors de la connexion.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px] border-border/60 bg-card/95 backdrop-blur-md shadow-2xl">
				<DialogHeader className="gap-1.5 text-left">
					<div className="flex items-center gap-2 text-foreground font-semibold">
						<div className="p-2 rounded-lg bg-primary/10 text-primary">
							<UserPlus className="h-4 w-4" />
						</div>
						<DialogTitle className="text-base tracking-tight font-semibold">
							{isReauth ? "Réauthentifier le compte" : "Ajouter un autre compte"}
						</DialogTitle>
					</div>
					<DialogDescription className="text-xs text-muted-foreground leading-relaxed">
						{isReauth
							? "La session de ce compte a expiré. Saisissez votre mot de passe pour la réactiver."
							: "Connectez-vous avec un autre compte Sigma pour basculer facilement entre vos profils."}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-1">
					{error && (
						<div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium leading-relaxed">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="account-email" className="text-xs font-medium text-foreground">
							Adresse email
						</Label>
						<Input
							id="account-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							readOnly={isReauth}
							disabled={isReauth || isSubmitting}
							placeholder="nom@exemple.com"
							required
							className="h-9 text-xs bg-background/50 border-border/60 focus-visible:ring-primary/20"
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="account-password" className="text-xs font-medium text-foreground">
							Mot de passe
						</Label>
						<div className="relative">
							<Input
								id="account-password"
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isSubmitting}
								placeholder="••••••••••••"
								required
								autoFocus={isReauth}
								className="h-9 pr-9 text-xs bg-background/50 border-border/60 focus-visible:ring-primary/20"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
								tabIndex={-1}
							>
								{showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
								<span className="sr-only">
									{showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
								</span>
							</Button>
						</div>
					</div>

					<DialogFooter className="pt-2 sm:justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
							className="h-8 text-xs text-muted-foreground hover:text-foreground"
						>
							Annuler
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting}
							className="h-8 text-xs font-medium gap-1.5"
						>
							{isSubmitting ? (
								<>
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									<span>Connexion...</span>
								</>
							) : (
								<span>{isReauth ? "Réactiver la session" : "Connecter le compte"}</span>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

