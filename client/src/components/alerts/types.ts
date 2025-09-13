export interface AlertFormData {
  id?: string;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  conditionType: 'ABOVE' | 'BELOW' | 'INCREASE_BY' | 'DECREASE_BY';
  assetId?: string;
  portfolioId?: string;
  thresholdValue?: number;
  thresholdPercentage?: number;
  notificationMethods: ('EMAIL' | 'PUSH' | 'SMS')[];
  isActive: boolean;
  name?: string;
  description?: string;
}

export interface AlertFilterData {
  alertType?: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  isActive?: boolean;
  assetId?: string;
  portfolioId?: string;
  triggeredAfter?: Date;
}

export interface AlertNotificationData {
  id: string;
  alertId: string;
  message: string;
  triggeredAt: Date;
  acknowledged: boolean;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  assetName?: string;
  portfolioName?: string;
  currentValue?: number;
  thresholdValue?: number;
}

export interface AlertHistoryData {
  id: string;
  alertId: string;
  alertName: string;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  message: string;
  assetName?: string;
  portfolioName?: string;
  currentValue?: number;
  thresholdValue?: number;
}

export interface AlertQuickSetupData {
  assetId?: string;
  portfolioId?: string;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  thresholdValue?: number;
  thresholdPercentage?: number;
  notificationMethods: ('EMAIL' | 'PUSH' | 'SMS')[];
}

export interface AlertTestData {
  alertId: string;
  testType: 'CONDITION' | 'NOTIFICATION';
  mockValue?: number;
  mockPercentage?: number;
}

export interface Alert {
  id: string;
  alertType: 'PRICE' | 'PERCENTAGE_CHANGE' | 'PORTFOLIO_VALUE' | 'ALLOCATION';
  conditionType: 'ABOVE' | 'BELOW' | 'INCREASE_BY' | 'DECREASE_BY';
  assetId?: string;
  portfolioId?: string;
  thresholdValue?: number;
  thresholdPercentage?: number;
  notificationMethods: ('EMAIL' | 'PUSH' | 'SMS')[];
  isActive: boolean;
  name?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  asset?: {
    id: string;
    name: string;
    symbol?: string;
    type: string;
  };
  portfolio?: {
    id: string;
    name: string;
  };
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
}

export interface Asset {
  id: string;
  name: string;
  symbol?: string;
  type: string;
  currentPrice?: number;
}