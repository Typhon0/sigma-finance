import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bell, DollarSign, Percent, TrendingUp, TrendingDown, Mail, Smartphone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { AlertFormData, Portfolio, Asset } from './types';

const alertFormSchema = z.object({
  alertType: z.enum(['PRICE', 'PERCENTAGE_CHANGE', 'PORTFOLIO_VALUE', 'ALLOCATION']),
  conditionType: z.enum(['ABOVE', 'BELOW', 'INCREASE_BY', 'DECREASE_BY']),
  assetId: z.string().optional(),
  portfolioId: z.string().optional(),
  thresholdValue: z.number().positive().optional(),
  thresholdPercentage: z.number().min(0).max(100).optional(),
  notificationMethods: z.array(z.enum(['EMAIL', 'PUSH', 'SMS'])).min(1, 'Select at least one notification method'),
  isActive: z.boolean(),
  name: z.string().min(1, 'Alert name is required').max(100),
  description: z.string().max(500).optional(),
}).refine((data) => {
  // Require asset or portfolio based on alert type
  if (data.alertType === 'PRICE' || data.alertType === 'PERCENTAGE_CHANGE') {
    return data.assetId !== undefined;
  }
  if (data.alertType === 'PORTFOLIO_VALUE' || data.alertType === 'ALLOCATION') {
    return data.portfolioId !== undefined;
  }
  return true;
}, {
  message: "Asset is required for price/percentage alerts, portfolio is required for portfolio/allocation alerts",
  path: ["assetId"]
}).refine((data) => {
  // Require appropriate threshold based on alert type
  if (data.alertType === 'PRICE' || data.alertType === 'PORTFOLIO_VALUE') {
    return data.thresholdValue !== undefined && data.thresholdValue > 0;
  }
  if (data.alertType === 'PERCENTAGE_CHANGE' || data.alertType === 'ALLOCATION') {
    return data.thresholdPercentage !== undefined && data.thresholdPercentage >= 0;
  }
  return true;
}, {
  message: "Threshold value is required",
  path: ["thresholdValue"]
});

interface AlertConfigurationFormProps {
  portfolios: Portfolio[];
  assets: Asset[];
  initialData?: Partial<AlertFormData>;
  onSubmit: (data: AlertFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AlertConfigurationForm({
  portfolios,
  assets,
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: AlertConfigurationFormProps) {
  const [selectedAlertType, setSelectedAlertType] = useState<string>(initialData?.alertType || '');
  const [selectedConditionType, setSelectedConditionType] = useState<string>(initialData?.conditionType || '');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AlertFormData>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      alertType: initialData?.alertType || 'PRICE',
      conditionType: initialData?.conditionType || 'ABOVE',
      assetId: initialData?.assetId || '',
      portfolioId: initialData?.portfolioId || '',
      thresholdValue: initialData?.thresholdValue || undefined,
      thresholdPercentage: initialData?.thresholdPercentage || undefined,
      notificationMethods: initialData?.notificationMethods || ['EMAIL'],
      isActive: initialData?.isActive ?? true,
      name: initialData?.name || '',
      description: initialData?.description || '',
    },
  });

  const watchedAlertType = watch('alertType');
  const watchedNotificationMethods = watch('notificationMethods');

  const handleFormSubmit = async (data: AlertFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Failed to submit alert:', error);
    }
  };

  const toggleNotificationMethod = (method: 'EMAIL' | 'PUSH' | 'SMS') => {
    const current = watchedNotificationMethods || [];
    const updated = current.includes(method)
      ? current.filter(m => m !== method)
      : [...current, method];
    setValue('notificationMethods', updated);
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'PRICE':
        return <DollarSign className="h-4 w-4" />;
      case 'PERCENTAGE_CHANGE':
        return <Percent className="h-4 w-4" />;
      case 'PORTFOLIO_VALUE':
        return <TrendingUp className="h-4 w-4" />;
      case 'ALLOCATION':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'ABOVE':
      case 'INCREASE_BY':
        return <TrendingUp className="h-4 w-4" />;
      case 'BELOW':
      case 'DECREASE_BY':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const requiresAsset = watchedAlertType === 'PRICE' || watchedAlertType === 'PERCENTAGE_CHANGE';
  const requiresPortfolio = watchedAlertType === 'PORTFOLIO_VALUE' || watchedAlertType === 'ALLOCATION';
  const requiresValue = watchedAlertType === 'PRICE' || watchedAlertType === 'PORTFOLIO_VALUE';
  const requiresPercentage = watchedAlertType === 'PERCENTAGE_CHANGE' || watchedAlertType === 'ALLOCATION';

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Alert Basic Information */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Alert Name *</Label>
          <Input
            id="name"
            placeholder="e.g., AAPL Price Alert"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="isActive">Status</Label>
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              {...register('isActive')}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
            <Label htmlFor="isActive" className="text-sm">
              {watch('isActive') ? 'Active' : 'Inactive'}
            </Label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description for this alert"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <Separator />

      {/* Alert Type Configuration */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Alert Configuration</h3>
        
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="alertType">Alert Type *</Label>
            <Select
              value={watchedAlertType}
              onValueChange={(value) => {
                setValue('alertType', value as any);
                setSelectedAlertType(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select alert type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRICE">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Price Alert
                  </div>
                </SelectItem>
                <SelectItem value="PERCENTAGE_CHANGE">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Percentage Change
                  </div>
                </SelectItem>
                <SelectItem value="PORTFOLIO_VALUE">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Portfolio Value
                  </div>
                </SelectItem>
                <SelectItem value="ALLOCATION">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Asset Allocation
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {errors.alertType && (
              <p className="text-sm text-destructive">{errors.alertType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="conditionType">Condition *</Label>
            <Select
              value={watch('conditionType')}
              onValueChange={(value) => {
                setValue('conditionType', value as any);
                setSelectedConditionType(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {(watchedAlertType === 'PRICE' || watchedAlertType === 'PORTFOLIO_VALUE') && (
                  <>
                    <SelectItem value="ABOVE">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Above
                      </div>
                    </SelectItem>
                    <SelectItem value="BELOW">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Below
                      </div>
                    </SelectItem>
                  </>
                )}
                {(watchedAlertType === 'PERCENTAGE_CHANGE' || watchedAlertType === 'ALLOCATION') && (
                  <>
                    <SelectItem value="INCREASE_BY">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Increase By
                      </div>
                    </SelectItem>
                    <SelectItem value="DECREASE_BY">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4" />
                        Decrease By
                      </div>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {errors.conditionType && (
              <p className="text-sm text-destructive">{errors.conditionType.message}</p>
            )}
          </div>
        </div>

        {/* Asset/Portfolio Selection */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {requiresAsset && (
            <div className="space-y-2">
              <Label htmlFor="assetId">Asset *</Label>
              <Select
                value={watch('assetId') || ''}
                onValueChange={(value) => setValue('assetId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      <div className="flex items-center gap-2">
                        <span>{asset.name}</span>
                        {asset.symbol && (
                          <Badge variant="outline" className="text-xs">
                            {asset.symbol}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assetId && (
                <p className="text-sm text-destructive">{errors.assetId.message}</p>
              )}
            </div>
          )}

          {requiresPortfolio && (
            <div className="space-y-2">
              <Label htmlFor="portfolioId">Portfolio *</Label>
              <Select
                value={watch('portfolioId') || ''}
                onValueChange={(value) => setValue('portfolioId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((portfolio) => (
                    <SelectItem key={portfolio.id} value={portfolio.id}>
                      {portfolio.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.portfolioId && (
                <p className="text-sm text-destructive">{errors.portfolioId.message}</p>
              )}
            </div>
          )}
        </div>

        {/* Threshold Configuration */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {requiresValue && (
            <div className="space-y-2">
              <Label htmlFor="thresholdValue">Threshold Value *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="thresholdValue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-10"
                  {...register('thresholdValue', { valueAsNumber: true })}
                />
              </div>
              {errors.thresholdValue && (
                <p className="text-sm text-destructive">{errors.thresholdValue.message}</p>
              )}
            </div>
          )}

          {requiresPercentage && (
            <div className="space-y-2">
              <Label htmlFor="thresholdPercentage">Threshold Percentage *</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="thresholdPercentage"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="0.0"
                  className="pl-10"
                  {...register('thresholdPercentage', { valueAsNumber: true })}
                />
              </div>
              {errors.thresholdPercentage && (
                <p className="text-sm text-destructive">{errors.thresholdPercentage.message}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Notification Methods */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Notification Methods</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="cursor-pointer" onClick={() => toggleNotificationMethod('EMAIL')}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={watchedNotificationMethods?.includes('EMAIL') || false}
                  onChange={() => toggleNotificationMethod('EMAIL')}
                />
                <Mail className="h-5 w-5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">Send email notifications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer" onClick={() => toggleNotificationMethod('PUSH')}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={watchedNotificationMethods?.includes('PUSH') || false}
                  onChange={() => toggleNotificationMethod('PUSH')}
                />
                <Bell className="h-5 w-5" />
                <div>
                  <p className="font-medium">Push Notification</p>
                  <p className="text-sm text-muted-foreground">Browser/app notifications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer" onClick={() => toggleNotificationMethod('SMS')}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={watchedNotificationMethods?.includes('SMS') || false}
                  onChange={() => toggleNotificationMethod('SMS')}
                />
                <MessageSquare className="h-5 w-5" />
                <div>
                  <p className="font-medium">SMS</p>
                  <p className="text-sm text-muted-foreground">Text message alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {errors.notificationMethods && (
          <p className="text-sm text-destructive">{errors.notificationMethods.message}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting || isLoading ? 'Saving...' : initialData?.id ? 'Update Alert' : 'Create Alert'}
        </Button>
      </div>
    </form>
  );
}