import { AlertTriangle, CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';
import { transactionErrorMessages } from '@/lib/validations/transaction.schemas';
import type { TransactionFormData } from '@/lib/validations/transaction.schemas';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
}

interface TransactionValidationProps {
  transaction: TransactionFormData;
  availableBalance?: number;
  availableQuantity?: number;
  currentMarketPrice?: number;
  onRetry?: () => void;
  onIgnoreWarnings?: () => void;
  showDetails?: boolean;
}

export function TransactionValidation({
  transaction,
  availableBalance,
  availableQuantity,
  currentMarketPrice,
  onRetry,
  onIgnoreWarnings,
  showDetails = true,
}: TransactionValidationProps) {
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  const validateTransaction = (): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const suggestions: string[] = [];

    // Required field validation
    if (!transaction.portfolioId) {
      errors.push({
        field: 'portfolioId',
        message: transactionErrorMessages.portfolioRequired,
        severity: 'error',
      });
    }

    if (!transaction.transactionType) {
      errors.push({
        field: 'transactionType',
        message: transactionErrorMessages.transactionTypeRequired,
        severity: 'error',
      });
    }

    // Asset validation for non-cash transactions
    if (!['DEPOSIT', 'WITHDRAWAL'].includes(transaction.transactionType) && !transaction.assetId) {
      errors.push({
        field: 'assetId',
        message: transactionErrorMessages.assetRequired,
        severity: 'error',
      });
    }

    // Amount validation
    if (!transaction.amount || transaction.amount <= 0) {
      errors.push({
        field: 'amount',
        message: transactionErrorMessages.amountRequired,
        severity: 'error',
      });
    }

    // Buy/Sell specific validation
    if (['BUY', 'SELL'].includes(transaction.transactionType)) {
      if (!transaction.quantity || transaction.quantity <= 0) {
        errors.push({
          field: 'quantity',
          message: transactionErrorMessages.quantityRequired,
          severity: 'error',
        });
      }

      if (!transaction.pricePerUnit || transaction.pricePerUnit <= 0) {
        errors.push({
          field: 'pricePerUnit',
          message: transactionErrorMessages.priceRequired,
          severity: 'error',
        });
      }

      // Amount vs quantity * price validation
      if (transaction.quantity && transaction.pricePerUnit) {
        const calculatedAmount = transaction.quantity * transaction.pricePerUnit;
        const tolerance = 0.01;
        if (Math.abs(calculatedAmount - transaction.amount) > tolerance) {
          warnings.push({
            field: 'amount',
            message: transactionErrorMessages.amountMismatch,
            severity: 'warning',
          });
          suggestions.push(`Expected amount: ${formatCurrency(calculatedAmount)}`);
        }
      }
    }

    // Sell transaction specific validation
    if (transaction.transactionType === 'SELL') {
      if (availableQuantity !== undefined && transaction.quantity > availableQuantity) {
        errors.push({
          field: 'quantity',
          message: transactionErrorMessages.insufficientQuantity,
          severity: 'error',
        });
        suggestions.push(`Available quantity: ${availableQuantity.toLocaleString()}`);
      }
    }

    // Balance validation for buy transactions
    if (['BUY', 'WITHDRAWAL'].includes(transaction.transactionType)) {
      if (availableBalance !== undefined && transaction.amount > availableBalance) {
        warnings.push({
          field: 'amount',
          message: 'Transaction amount exceeds available balance',
          severity: 'warning',
        });
        suggestions.push(`Available balance: ${formatCurrency(availableBalance)}`);
      }
    }

    // Market price validation
    if (currentMarketPrice && transaction.pricePerUnit && ['BUY', 'SELL'].includes(transaction.transactionType)) {
      const priceDifference = Math.abs(transaction.pricePerUnit - currentMarketPrice);
      const percentageDifference = (priceDifference / currentMarketPrice) * 100;

      if (percentageDifference > 10) {
        warnings.push({
          field: 'pricePerUnit',
          message: `Price differs significantly from market price (${formatCurrency(currentMarketPrice)})`,
          severity: 'warning',
        });
        suggestions.push(`Consider using current market price: ${formatCurrency(currentMarketPrice)}`);
      }
    }

    // Date validation
    if (transaction.transactionDate > new Date()) {
      errors.push({
        field: 'transactionDate',
        message: transactionErrorMessages.dateFuture,
        severity: 'error',
      });
    }

    // Fee validation
    if (transaction.fee && transaction.fee < 0) {
      errors.push({
        field: 'fee',
        message: transactionErrorMessages.feePositive,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  };

  const validation = validateTransaction();
  const hasWarnings = validation.warnings.length > 0;
  const hasSuggestions = validation.suggestions.length > 0;

  if (validation.isValid && !hasWarnings) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Transaction validation passed. Ready to submit.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Summary */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                {validation.errors.length} error(s) must be fixed before submitting.
              </span>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry Validation
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Summary */}
      {hasWarnings && validation.errors.length === 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="flex items-center justify-between">
              <span>
                {validation.warnings.length} warning(s) detected. Review before proceeding.
              </span>
              {onIgnoreWarnings && (
                <Button variant="outline" size="sm" onClick={onIgnoreWarnings}>
                  Proceed Anyway
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Validation Results */}
      {showDetails && (validation.errors.length > 0 || hasWarnings) && (
        <Collapsible open={showValidationDetails} onOpenChange={setShowValidationDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full">
              <Info className="h-4 w-4 mr-2" />
              {showValidationDetails ? 'Hide' : 'Show'} Validation Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Validation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-red-600 flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Errors ({validation.errors.length})
                    </h4>
                    <div className="space-y-2">
                      {validation.errors.map((error, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {error.field}
                              </Badge>
                              <span className="text-sm text-red-800">{error.message}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-yellow-600 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Warnings ({validation.warnings.length})
                    </h4>
                    <div className="space-y-2">
                      {validation.warnings.map((warning, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {warning.field}
                              </Badge>
                              <span className="text-sm text-yellow-800">{warning.message}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {hasSuggestions && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-600 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Suggestions
                    </h4>
                    <div className="space-y-2">
                      {validation.suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-blue-800">{suggestion}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// Simplified validation display for inline use
export function InlineValidationStatus({
  transaction,
  availableQuantity,
}: {
  transaction: TransactionFormData;
  availableQuantity?: number;
}) {
  const hasErrors = !transaction.portfolioId || !transaction.amount || transaction.amount <= 0;
  const hasQuantityError = transaction.transactionType === 'SELL' && 
    availableQuantity !== undefined && 
    transaction.quantity > availableQuantity;

  if (hasErrors || hasQuantityError) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Invalid
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="gap-1 bg-green-100 text-green-800">
      <CheckCircle className="h-3 w-3" />
      Valid
    </Badge>
  );
}