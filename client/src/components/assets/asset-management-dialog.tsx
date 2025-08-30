import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus } from 'lucide-react';
import { AssetTypeSelector } from './asset-type-selector';
import { StockAssetForm } from './forms/stock-asset-form';
import { CryptoAssetForm } from './forms/crypto-asset-form';
import { BankAccountForm } from './forms/bank-account-form';
import { RealEstateForm } from './forms/real-estate-form';
import { WatchForm } from './forms/watch-form';
import type { AssetType } from '@/hooks/use-asset-management';

interface AssetManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
  onSuccess?: () => void;
}

type DialogStep = 'select-type' | 'form';

export function AssetManagementDialog({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
  onSuccess,
}: AssetManagementDialogProps) {
  const [step, setStep] = useState<DialogStep>('select-type');
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setStep('select-type');
    setSelectedAssetType(null);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const handleTypeSelect = (type: AssetType) => {
    setSelectedAssetType(type);
    setStep('form');
  };

  const handleBack = () => {
    setStep('select-type');
    setSelectedAssetType(null);
  };

  const handleFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual asset creation logic
      console.log('Creating asset:', { 
        portfolioId, 
        assetType: selectedAssetType, 
        data 
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (error) {
      console.error('Error creating asset:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = () => {
    if (!selectedAssetType) return null;

    const commonProps = {
      onSubmit: handleFormSubmit,
      onCancel: handleBack,
      isLoading: isSubmitting,
    };

    switch (selectedAssetType.name) {
      case 'STOCK':
        return <StockAssetForm {...commonProps} />;
      case 'CRYPTO':
        return <CryptoAssetForm {...commonProps} />;
      case 'BANK_ACCOUNT':
        return <BankAccountForm {...commonProps} />;
      case 'REAL_ESTATE':
        return <RealEstateForm {...commonProps} />;
      case 'WATCH':
        return <WatchForm {...commonProps} />;
      default:
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Form for {selectedAssetType.name} is not yet implemented.
            </p>
            <Button onClick={handleBack} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Asset Types
            </Button>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Asset to {portfolioName}
              </DialogTitle>
              {step === 'form' && selectedAssetType && (
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBack}
                    className="gap-1 p-1 h-auto"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </Button>
                  <Badge variant="outline">
                    {selectedAssetType.name.replace('_', ' ')}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {step === 'select-type' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Choose Asset Type</h3>
                <p className="text-muted-foreground">
                  Select the type of asset you want to add to your portfolio
                </p>
              </div>
              
              <AssetTypeSelector
                selectedType={selectedAssetType}
                onTypeSelect={handleTypeSelect}
              />
            </div>
          )}

          {step === 'form' && renderForm()}
        </div>
      </DialogContent>
    </Dialog>
  );
}