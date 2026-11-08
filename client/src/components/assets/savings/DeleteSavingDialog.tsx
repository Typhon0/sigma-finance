import { Loader2, Trash2 } from "lucide-react";
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

export interface DeleteSavingDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	savingId: string;
	accountName: string;
	onSuccess?: () => void;
}

export function DeleteSavingDialog({
	open,
	onOpenChange,
	savingId,
	accountName,
	onSuccess,
}: DeleteSavingDialogProps) {
	const { deleteAsset, refetch } = usePortfolio();
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		setIsDeleting(true);
		const toastId = toast.loading(`Deleting ${accountName}...`);
		try {
			if (typeof deleteAsset === "function") {
				await deleteAsset(savingId);
			}
			toast.success(`Savings account "${accountName}" deleted`, { id: toastId });
			await refetch();
			onSuccess?.();
			onOpenChange(false);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to delete savings account";
			toast.error(msg, { id: toastId });
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<Trash2 className="h-5 w-5" />
						<span>Delete Savings Account</span>
					</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete{" "}
						<span className="font-semibold text-foreground">{accountName}</span>? This will remove
						the account and its recorded balance from your active portfolio.
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={isDeleting}
						className="h-8 text-xs"
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						onClick={handleDelete}
						disabled={isDeleting}
						className="h-8 text-xs font-semibold"
					>
						{isDeleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
						Delete Account
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
