import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
  const handleClose = () => {
    onOpenChange(false);
  };

  const handleAddAsset = () => {
    // TODO: Implement actual asset addition logic
    console.log("Adding asset to portfolio:", portfolioID);
    if (onSuccess) {
      onSuccess();
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Asset to {portfolioName}</DialogTitle>
          <DialogDescription>
            Add a new asset to your portfolio. This feature is coming soon.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Plus className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">
            Asset management functionality is being developed.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleAddAsset}>
              Add Asset (Demo)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}