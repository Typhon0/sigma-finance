import { Building2, ChevronRight, Coins, Plus, RefreshCw, Wallet } from "lucide-react";
import { memo } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export interface AddAccountChooserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChooseConnectInstitution: () => void;
	onChooseConnectWallet: () => void;
	onChooseAddSavings: () => void;
	onChooseCreateCustom: () => void;
}

export const AddAccountChooserDialog = memo(function AddAccountChooserDialog({
	open,
	onOpenChange,
	onChooseConnectInstitution,
	onChooseConnectWallet,
	onChooseAddSavings,
	onChooseCreateCustom,
}: AddAccountChooserDialogProps) {
	const handleSelect = (action: () => void) => {
		onOpenChange(false);
		action();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md p-6">
				<DialogHeader>
					<DialogTitle className="text-lg font-semibold">Add Financial Account</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						Select how you would like to connect or record your financial custody envelope.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 gap-2.5 pt-2">
					{/* Connect Institution (Bank / Broker Sync) */}
					<button
						type="button"
						onClick={() => handleSelect(onChooseConnectInstitution)}
						className="group flex items-start gap-3.5 p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all text-left cursor-pointer"
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
							<RefreshCw className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold text-foreground">Connect Bank or Broker</p>
								<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Automated sync with European banks (Open Banking) and brokerages (Trade Republic).
							</p>
						</div>
					</button>

					{/* Connect Web3 / Hardware Wallet */}
					<button
						type="button"
						onClick={() => handleSelect(onChooseConnectWallet)}
						className="group flex items-start gap-3.5 p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all text-left cursor-pointer"
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
							<Wallet className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold text-foreground">Connect Crypto Wallet</p>
								<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Track Ethereum, Base, Solana, Bitcoin addresses or Cypherock/Ledger cold storage.
							</p>
						</div>
					</button>

					{/* Add Savings / Bank Account */}
					<button
						type="button"
						onClick={() => handleSelect(onChooseAddSavings)}
						className="group flex items-start gap-3.5 p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all text-left cursor-pointer"
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
							<Building2 className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold text-foreground">Manual Bank or Savings</p>
								<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Record checking accounts, savings books (Livret A), or interest-bearing deposits.
							</p>
						</div>
					</button>

					{/* Create Custom Envelope */}
					<button
						type="button"
						onClick={() => handleSelect(onChooseCreateCustom)}
						className="group flex items-start gap-3.5 p-3 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all text-left cursor-pointer"
					>
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
							<Plus className="h-5 w-5" />
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between">
								<p className="text-sm font-semibold text-foreground">Custom Account Envelope</p>
								<ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Create a custom brokerage (CTO, PEA), exchange account, or custom custody wrapper.
							</p>
						</div>
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
});
