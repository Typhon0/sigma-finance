import { AssetManagementDialog } from "@/components/assets/asset-management-dialog";

interface AddAssetDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioID: string;
	portfolioName: string;
	onSuccess?: () => void;
}

export function AddAssetDialog({
	open,
	onOpenChange,
	portfolioID,
	portfolioName,
	onSuccess,
}: AddAssetDialogProps) {
	return (
		<AssetManagementDialog
			open={open}
			onOpenChange={onOpenChange}
			portfolioId={portfolioID}
			portfolioName={portfolioName}
			onSuccess={onSuccess}
		/>
	);
}
