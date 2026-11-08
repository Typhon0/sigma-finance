import { Check, PiggyBank, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type PortfolioAssetItem, usePortfolio } from "@/components/PortfolioProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";

export interface TagSavingsAccountDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	manualSavingsIds: Set<string>;
	onToggleManualSaving: (assetId: string) => void;
}

export function TagSavingsAccountDialog({
	open,
	onOpenChange,
	manualSavingsIds,
	onToggleManualSaving,
}: TagSavingsAccountDialogProps) {
	const { assets } = usePortfolio();
	const { formatCurrency } = useCurrency();
	const [searchQuery, setSearchQuery] = useState("");

	// Bank accounts in portfolio that can be tagged
	const candidateAccounts = useMemo(() => {
		return assets.filter(
			(a) =>
				a.type === "bank" ||
				a.type === "savings" ||
				a.type === "cash" ||
				a.assetType?.name === "BANK_ACCOUNT",
		);
	}, [assets]);

	const filteredCandidates = useMemo(() => {
		if (!searchQuery) return candidateAccounts;
		const q = searchQuery.toLowerCase();
		return candidateAccounts.filter(
			(a) =>
				(a.name || "").toLowerCase().includes(q) ||
				(a.institution || "").toLowerCase().includes(q) ||
				(a.accountNumber || "").toLowerCase().includes(q),
		);
	}, [candidateAccounts, searchQuery]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<PiggyBank className="h-5 w-5 text-primary" />
						<span>Tag Accounts as Savings</span>
					</DialogTitle>
					<DialogDescription>
						Select bank accounts from your custody to include or exclude from this Savings terminal.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2 text-xs">
					<SearchInput
						placeholder="Search bank accounts..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onClear={() => setSearchQuery("")}
					/>

					<div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
						{filteredCandidates.length === 0 ? (
							<div className="p-6 text-center text-muted-foreground text-xs">
								No matching bank accounts found in portfolio.
							</div>
						) : (
							filteredCandidates.map((account) => {
								const isTagged = manualSavingsIds.has(account.id);
								const val = account.balance ?? account.currentValue ?? 0;

								return (
									<button
										key={account.id}
										type="button"
										onClick={() => {
											onToggleManualSaving(account.id);
											toast.success(
												isTagged
													? `Removed "${account.name}" from savings`
													: `Tagged "${account.name}" as savings`,
											);
										}}
										className={cn(
											"w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors cursor-pointer",
											isTagged
												? "border-primary/40 bg-primary/5 hover:bg-primary/10"
												: "border-border/40 hover:bg-muted/50",
										)}
									>
										<div className="flex items-center gap-3 min-w-0">
											<div
												className={cn(
													"h-5 w-5 rounded-md flex items-center justify-center border transition-colors shrink-0",
													isTagged
														? "border-primary bg-primary text-primary-foreground"
														: "border-border/60 bg-background",
												)}
											>
												{isTagged && <Check className="h-3.5 w-3.5" />}
											</div>
											<div className="min-w-0">
												<div className="font-semibold truncate">{account.name}</div>
												<div className="text-micro text-muted-foreground flex items-center gap-1.5">
													<span>{account.institution || "Bank Account"}</span>
													{account.accountNumber && (
														<span>• ****{account.accountNumber.slice(-4)}</span>
													)}
												</div>
											</div>
										</div>

										<div className="text-right font-mono shrink-0 pl-2">
											<div className="font-bold">{formatCurrency(val)}</div>
											{account.interestRate ? (
												<div className="text-micro text-gain">
													{account.interestRate.toFixed(2)}% APY
												</div>
											) : (
												<div className="text-micro text-muted-foreground">—</div>
											)}
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						size="sm"
						onClick={() => onOpenChange(false)}
						className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
					>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
