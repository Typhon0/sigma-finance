import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePortfolio } from "@/components/PortfolioProvider";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface RecordSavingMovementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	savingId: string;
	accountName: string;
	currency: string;
	onSuccess?: () => void;
}

export function RecordSavingMovementDialog({
	open,
	onOpenChange,
	savingId,
	accountName,
	currency,
	onSuccess,
}: RecordSavingMovementDialogProps) {
	const { refetch } = usePortfolio();
	const [movementType, setMovementType] = useState<"DEPOSIT" | "WITHDRAWAL" | "INTEREST">(
		"INTEREST",
	);
	const [amount, setAmount] = useState("");
	const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const val = parseFloat(amount);
		if (isNaN(val) || val <= 0) {
			toast.error("Please enter a valid positive amount");
			return;
		}

		setIsSubmitting(true);
		try {
			// Store custom movement record locally for this saving
			const localMovements = JSON.parse(localStorage.getItem(`sf_saving_tx_${savingId}`) || "[]");
			localMovements.unshift({
				id: `mov-${Date.now()}`,
				date: new Date(date).toISOString(),
				type: movementType.toLowerCase(),
				total: movementType === "WITHDRAWAL" ? -val : val,
				notes: notes.trim() || undefined,
				currency,
			});
			localStorage.setItem(`sf_saving_tx_${savingId}`, JSON.stringify(localMovements));

			toast.success(
				`${movementType === "INTEREST" ? "Interest payment" : movementType === "DEPOSIT" ? "Deposit" : "Withdrawal"} recorded`,
			);
			await refetch();
			onSuccess?.();
			onOpenChange(false);
			setAmount("");
			setNotes("");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to record movement";
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Record Movement</DialogTitle>
						<DialogDescription>
							Record a deposit, withdrawal, or interest payment for {accountName}.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4 text-xs">
						<div className="space-y-1.5">
							<Label htmlFor="mov-type">Movement Type</Label>
							<Select
								value={movementType}
								onValueChange={(val) =>
									setMovementType(val as "DEPOSIT" | "WITHDRAWAL" | "INTEREST")
								}
							>
								<SelectTrigger id="mov-type" className="h-8 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="INTEREST">Interest Payment (Versement d'intérêts)</SelectItem>
									<SelectItem value="DEPOSIT">Deposit (Versement)</SelectItem>
									<SelectItem value="WITHDRAWAL">Withdrawal (Retrait)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="mov-amount">Amount ({currency})</Label>
								<Input
									id="mov-amount"
									type="number"
									step="0.01"
									min="0.01"
									required
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="0.00"
									className="h-8 text-xs font-mono"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="mov-date">Date</Label>
								<Input
									id="mov-date"
									type="date"
									required
									value={date}
									onChange={(e) => setDate(e.target.value)}
									className="h-8 text-xs font-mono"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="mov-notes">Notes (optional)</Label>
							<Textarea
								id="mov-notes"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="e.g. Intérêts annuels 2026, Virement ponctuel..."
								className="text-xs resize-none h-16"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
							className="h-8 text-xs"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={isSubmitting}
							className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
						>
							{isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
							Record Movement
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
