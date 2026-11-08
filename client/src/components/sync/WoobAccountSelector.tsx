import {
	Banknote,
	Check,
	CheckSquare,
	CreditCard,
	Home,
	LineChart,
	Loader2,
	PiggyBank,
	Shield,
	Square,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface DiscoveredWoobConnection {
	id: string;
	externalAccountId: string;
	institutionName: string;
	accountName?: string;
	accountType?: string;
	balance?: number;
	currency?: string;
	accountNumber?: string;
}

interface WoobAccountSelectorProps {
	connections: DiscoveredWoobConnection[];
	institutionName: string;
	onConfirm: (selectedConnectionIds: string[]) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

export function WoobAccountSelector({
	connections,
	institutionName,
	onConfirm,
	onCancel,
	isSubmitting = false,
}: WoobAccountSelectorProps) {
	// All accounts selected by default
	const [selectedIds, setSelectedIds] = useState<Set<string>>(
		() => new Set(connections.map((c) => c.id)),
	);

	const toggleAccount = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const selectAll = () => {
		setSelectedIds(new Set(connections.map((c) => c.id)));
	};

	const deselectAll = () => {
		setSelectedIds(new Set());
	};

	const formatMoney = (amount?: number, currency = "EUR") => {
		if (amount === undefined || amount === null) return "—";
		return new Intl.NumberFormat("fr-FR", {
			style: "currency",
			currency: currency || "EUR",
			minimumFractionDigits: 2,
		}).format(amount);
	};

	const getCategoryIcon = (name = "", type = "") => {
		const upper = (name + " " + type).toUpperCase();
		if (upper.includes("LOAN") || upper.includes("PRÊT") || upper.includes("PRET") || upper.includes("CRÉDIT") || upper.includes("IMMO")) {
			return <Home className="h-4 w-4 text-amber-500" />;
		}
		if (upper.includes("PEA") || upper.includes("TITRES") || upper.includes("CTO") || upper.includes("MARKET") || upper.includes("BOURSE")) {
			return <LineChart className="h-4 w-4 text-emerald-500" />;
		}
		if (upper.includes("LIVRET") || upper.includes("LDDS") || upper.includes("LEP") || upper.includes("PEL") || upper.includes("SAVINGS") || upper.includes("ÉPARGNE")) {
			return <PiggyBank className="h-4 w-4 text-blue-500" />;
		}
		if (upper.includes("ASSURANCE") || upper.includes("VIE") || upper.includes("PER") || upper.includes("RETIREMENT")) {
			return <Shield className="h-4 w-4 text-purple-500" />;
		}
		if (upper.includes("CARD") || upper.includes("CARTE")) {
			return <CreditCard className="h-4 w-4 text-indigo-500" />;
		}
		return <Banknote className="h-4 w-4 text-foreground/70" />;
	};

	const getProductCategoryLabel = (name = "", type = "") => {
		const upper = (name + " " + type).toUpperCase();
		if (upper.includes("LOAN") || upper.includes("PRÊT") || upper.includes("PRET") || upper.includes("CRÉDIT") || upper.includes("IMMO")) {
			return "Crédit & Emprunt";
		}
		if (upper.includes("PEA") || upper.includes("TITRES") || upper.includes("CTO") || upper.includes("MARKET")) {
			return "Bourse & Investissement";
		}
		if (upper.includes("LIVRET") || upper.includes("LDDS") || upper.includes("LEP") || upper.includes("PEL") || upper.includes("SAVINGS")) {
			return "Épargne réglementée";
		}
		if (upper.includes("ASSURANCE") || upper.includes("VIE") || upper.includes("PER")) {
			return "Assurance-Vie / Retraite";
		}
		if (upper.includes("CARD") || upper.includes("CARTE")) {
			return "Carte bancaire";
		}
		return "Compte Courant";
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await onConfirm(Array.from(selectedIds));
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="flex items-center justify-between pb-1 border-b border-border/40">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						Comptes découverts chez {institutionName}
					</h3>
					<p className="text-xs text-muted-foreground">
						Sélectionnez les produits que vous souhaitez intégrer à votre portefeuille.
					</p>
				</div>
				<div className="flex items-center gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={selectedIds.size === connections.length ? deselectAll : selectAll}
						className="h-7 text-xs text-muted-foreground hover:text-foreground"
					>
						{selectedIds.size === connections.length ? "Tout désélectionner" : "Tout sélectionner"}
					</Button>
				</div>
			</div>

			<ScrollArea className="max-h-[340px] pr-2">
				<div className="space-y-2">
					{connections.map((conn) => {
						const isSelected = selectedIds.has(conn.id);
						const catLabel = getProductCategoryLabel(conn.accountName, conn.accountType);
						const isNegative = conn.balance !== undefined && conn.balance < 0;

						return (
							<Card
								key={conn.id}
								onClick={() => toggleAccount(conn.id)}
								className={cn(
									"flex items-center gap-3 p-3 transition-colors cursor-pointer border border-border/60 hover:border-primary/50 select-none",
									isSelected ? "bg-primary/5 border-primary/40 shadow-xs" : "bg-card/40 opacity-70",
								)}
							>
								<div
									role="checkbox"
									aria-checked={isSelected}
									className={cn(
										"h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
										isSelected
											? "bg-primary border-primary text-primary-foreground"
											: "border-input bg-background",
									)}
								>
									{isSelected && <Check className="h-3 w-3 stroke-[3]" />}
								</div>

								<div className="p-2 rounded-lg bg-background border border-border/60 shrink-0">
									{getCategoryIcon(conn.accountName, conn.accountType)}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<p className="text-xs font-semibold text-foreground truncate">
											{conn.accountName || `Compte ${conn.externalAccountId}`}
										</p>
										<Badge
											variant="outline"
											className="text-[10px] h-4 px-1.5 font-normal text-muted-foreground border-border/60"
										>
											{catLabel}
										</Badge>
										{isNegative && (
											<Badge
												variant="outline"
												className="text-[10px] h-4 px-1.5 font-normal text-amber-500 border-amber-500/30 bg-amber-500/10"
											>
												Passif / Dette
											</Badge>
										)}
									</div>
									<p className="text-micro text-muted-foreground truncate font-mono">
										{conn.accountNumber || conn.externalAccountId}
									</p>
								</div>

								<div className="text-right shrink-0">
									<span
										className={cn(
											"text-xs font-semibold tabular-nums",
											isNegative ? "text-amber-500 font-medium" : "text-foreground",
										)}
									>
										{formatMoney(conn.balance, conn.currency)}
									</span>
									{isNegative && (
										<p className="text-[10px] text-muted-foreground">Capital restant dû</p>
									)}
								</div>
							</Card>
						);
					})}
				</div>
			</ScrollArea>

			<div className="flex items-center justify-between pt-2 border-t border-border/40">
				<span className="text-xs text-muted-foreground font-medium">
					{selectedIds.size} sur {connections.length} compte(s) sélectionné(s)
				</span>

				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onCancel}
						disabled={isSubmitting}
						className="h-8 text-xs text-muted-foreground hover:text-foreground"
					>
						Annuler
					</Button>
					<Button
						type="submit"
						size="sm"
						disabled={selectedIds.size === 0 || isSubmitting}
						className="h-8 text-xs font-medium gap-1.5"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
								<span>Importation...</span>
							</>
						) : (
							<>
								<Check className="h-3.5 w-3.5" />
								<span>Importer les comptes</span>
							</>
						)}
					</Button>
				</div>
			</div>
		</form>
	);
}
