export type ExportFormat = 'csv' | 'pdf' | 'json';

export type ExportType = 
  | 'portfolio-data'
  | 'transaction-history'
  | 'performance-analytics'
  | 'tax-report'
  | 'audit-trail'
  | 'data-backup';

export interface ExportRequest {
  type: ExportType;
  format: ExportFormat;
  portfolioId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  size?: number;
}

export interface PortfolioExportData {
  portfolio: {
    id: string;
    name: string;
    createdAt: string;
    totalValue: number;
    totalCost: number;
    gainLoss: number;
    returnPercentage: number;
  };
  positions: Array<{
    id: string;
    assetName: string;
    assetType: string;
    symbol?: string;
    quantity: number;
    currentPrice?: number;
    currentValue: number;
    costBasis: number;
    gainLoss: number;
    returnPercentage: number;
    ownershipPercentage: number;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    assetName: string;
    quantity?: number;
    amount: number;
    price?: number;
    fee: number;
    date: string;
    notes?: string;
  }>;
}

export interface TaxReportData {
  taxYear: number;
  userId: string;
  realizedGains: Array<{
    assetName: string;
    symbol?: string;
    saleDate: string;
    purchaseDate: string;
    quantity: number;
    salePrice: number;
    costBasis: number;
    gainLoss: number;
    termType: 'short' | 'long';
  }>;
  dividendIncome: Array<{
    assetName: string;
    symbol?: string;
    date: string;
    amount: number;
  }>;
  summary: {
    totalRealizedGains: number;
    totalRealizedLosses: number;
    netGainLoss: number;
    totalDividends: number;
  };
}

export interface AuditTrailData {
  userId: string;
  dateRange: {
    start: string;
    end: string;
  };
  events: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    entityType: string;
    entityId: string;
    action: string;
    changes?: Record<string, any>;
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }>;
}