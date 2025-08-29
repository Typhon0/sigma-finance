import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus } from "lucide-react";
import type { PortfolioAsset } from "@/gql/graphql";

interface RemoveAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioID: string;
  portfolioName: string;
  asset: PortfolioAsset | null;
  onSuccess?: () => void;
}

export function RemoveAssetDialog({
  open,
  onOpenChange,
  portfolioID,
  portfolioName,
  asset,
  onSuccess,
}: RemoveAssetDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
  };

  const handleRemoveAsset = () => {
    // TODO: Implement actual asset removal logic
    console.log("Removing asset from portfolio:", portfolioID, asset?.asset?.id);
    if (onSuccess) {
      onSuccess();
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Asset from {portfolioName}</DialogTitle>
          <DialogDescription>
            {asset ? `Remove ${asset.asset.name} from your portfolio.` : "Remove asset from your portfolio."} This feature is coming soon.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Minus className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Asset management functionality is being developed.
          </p>
          {asset && (
            <p className="text-sm text-muted-foreground mb-4">
              Asset: {asset.asset.name} ({asset.quantity} shares)
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleRemoveAsset} variant="destructive">
              Remove Asset (Demo)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}