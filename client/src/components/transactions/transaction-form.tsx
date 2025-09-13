import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon, DollarSign, Hash, FileText, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { transactionFormSchema, type TransactionFormData } from '@/lib/validations/transaction.schemas';
import type { Asset, Portfolio, TransactionType } from '@/gql/graphql';

interface TransactionFormProps {
  portfolios: Portfolio[];
  assets?: Asset[];
  selectedPortfolio?: Portfolio;
  selectedAsset?: Asset;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  initialData?: Partial<TransactionFormData>;
}

const transactionTypes: { value: TransactionType; label: string; description: string }[] = [
  { value: 'BUY', label: 'Buy', description: 'Purchase assets' },
  { value: 'SELL', label: 'Sell', description: 'Sell assets' },
  { value: 'DEPOSIT', label: 'Deposit', description: 'Add funds' },
  { value: 'WITHDRAWAL', label: 'Withdrawal', description: 'Remove funds' },
  { value: 'TRANSFER_IN', label: 'Transfer In', description: 'Transfer from another account' },
  { value: 'TRANSFER_OUT', label: 'Transfer Out', description: 'Transfer to another account' },
  { value: 'DIVIDEND', label: 'Dividend', description: 'Dividend payment' },
  { value: 'INTEREST', label: 'Interest', description: 'Interest earned' },
  { value: 'FEE', label: 'Fee', description: 'Transaction fee' },
  { value: 'ADJUSTMENT', label: 'Adjustment', description: 'Manual adjustment' },
];

export function TransactionForm({
  portfolios,
  assets = [],
  selectedPortfolio,
  selectedAsset,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
  initialData,
}: TransactionFormProps) {
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionType | null>(
    initialData?.transactionType || null
  );

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      portfolioId: selectedPortfolio?.id || initialData?.portfolioId || '',
      assetId: selectedAsset?.id || initialData?.assetId || '',
      transactionType: initialData?.transactionType || 'BUY',
      quantity: initialData?.quantity || 0,
      pricePerUnit: initialData?.pricePerUnit || 0,
      amount: initialData?.amount || 0,
      fee: initialData?.fee || 0,
      transactionDate: initialData?.transactionDate || new Date(),
      notes: initialData?.notes || '',
    },
  });

  const watchedPortfolioId = form.watch('portfolioId');
  const watchedTransactionType = form.watch('transactionType');
  const watchedQuantity = form.watch('quantity');
  const watchedPricePerUnit = form.watch('pricePerUnit');

  // Auto-calculate amount when quantity or price changes
  const handleQuantityOrPriceChange = () => {
    const quantity = watchedQuantity || 0;
    const pricePerUnit = watchedPricePerUnit || 0;
    const calculatedAmount = quantity * pricePerUnit;
    form.setValue('amount', calculatedAmount);
  };

  // Filter assets based on selected portfolio
  const availableAssets = assets.filter(asset => 
    !watchedPortfolioId || asset.positions?.some(pos => pos.portfolio.id === watchedPortfolioId)
  );

  // Check if transaction type requires quantity
  const requiresQuantity = ['BUY', 'SELL'].includes(watchedTransactionType);
  const requiresAsset = !['DEPOSIT', 'WITHDRAWAL'].includes(watchedTransactionType);

  const handleSubmit = async (data: TransactionFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Transaction submission error:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          {mode === 'create' ? 'Record Transaction' : 'Edit Transaction'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Portfolio Selection */}
            <FormField
              control={form.control}
              name="portfolioId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Portfolio *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select portfolio" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {portfolios.map((portfolio) => (
                        <SelectItem key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Transaction Type */}
            <FormField
              control={form.control}
              name="transactionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type *</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedTransactionType(value as TransactionType);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select transaction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {transactionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.label}</span>
                            <span className="text-xs text-muted-foreground">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Asset Selection (conditional) */}
            {requiresAsset && (
              <FormField
                control={form.control}
                name="assetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select asset" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableAssets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center gap-2">
                              <span>{asset.name}</span>
                              {asset.symbol && (
                                <span className="text-xs text-muted-foreground">({asset.symbol})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quantity (conditional) */}
              {requiresQuantity && (
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.00000001"
                            min="0"
                            placeholder="0.00"
                            className="pl-10"
                            {...field}
                            onChange={(e) => {
                              field.onChange(parseFloat(e.target.value) || 0);
                              handleQuantityOrPriceChange();
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Price Per Unit (conditional) */}
              {requiresQuantity && (
                <FormField
                  control={form.control}
                  name="pricePerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price Per Unit *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="pl-10"
                            {...field}
                            onChange={(e) => {
                              field.onChange(parseFloat(e.target.value) || 0);
                              handleQuantityOrPriceChange();
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          readOnly={requiresQuantity}
                        />
                      </div>
                    </FormControl>
                    {requiresQuantity && (
                      <p className="text-xs text-muted-foreground">
                        Auto-calculated from quantity × price
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fee */}
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Transaction Date */}
            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Transaction Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Textarea
                        placeholder="Add any additional notes about this transaction..."
                        className="pl-10 min-h-[80px]"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validation Info */}
            {requiresQuantity && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  For {watchedTransactionType.toLowerCase()} transactions, both quantity and price per unit are required.
                  The total amount will be calculated automatically.
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Processing...' : mode === 'create' ? 'Record Transaction' : 'Update Transaction'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}