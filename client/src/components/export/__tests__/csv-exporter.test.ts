import { describe, it, expect } from 'vitest';
import { CSVExporter } from '../csv-exporter';
import type { PortfolioExportData, TaxReportData, AuditTrailData } from '../types';

describe('CSVExporter', () => {
  describe('escapeCSVField', () => {
    it('should handle null and undefined values', () => {
      // Access private method for testing
      const escapeField = (CSVExporter as any).escapeCSVField;
      
      expect(escapeField(null)).toBe('');
      expect(escapeField(undefined)).toBe('');
    });

    it('should escape fields with commas', () => {
      const escapeField = (CSVExporter as any).escapeCSVField;
      
      expect(escapeField('Hello, World')).toBe('"Hello, World"');
    });

    it('should escape fields with quotes', () => {
      const escapeField = (CSVExporter as any).escapeCSVField;
      
      expect(escapeField('Say "Hello"')).toBe('"Say ""Hello"""');
    });

    it('should not escape simple fields', () => {
      const escapeField = (CSVExporter as any).escapeCSVField;
      
      expect(escapeField('SimpleText')).toBe('SimpleText');
      expect(escapeField('123')).toBe('123');
    });
  });

  describe('exportPortfolioData', () => {
    it('should export complete portfolio data', () => {
      const mockData: PortfolioExportData = {
        portfolio: {
          id: 'portfolio-1',
          name: 'Test Portfolio',
          createdAt: '2024-01-01T00:00:00Z',
          totalValue: 150000,
          totalCost: 120000,
          gainLoss: 30000,
          returnPercentage: 25.0
        },
        positions: [
          {
            id: 'position-1',
            assetName: 'Apple Inc.',
            assetType: 'STOCK',
            symbol: 'AAPL',
            quantity: 100,
            currentPrice: 150.00,
            currentValue: 15000,
            costBasis: 12000,
            gainLoss: 3000,
            returnPercentage: 25.0,
            ownershipPercentage: 100
          }
        ],
        transactions: [
          {
            id: 'tx-1',
            type: 'BUY',
            assetName: 'Apple Inc.',
            quantity: 100,
            amount: 12000,
            price: 120.00,
            fee: 10,
            date: '2024-01-01T00:00:00Z',
            notes: 'Initial purchase'
          }
        ]
      };

      const csv = CSVExporter.exportPortfolioData(mockData);

      expect(csv).toContain('PORTFOLIO SUMMARY');
      expect(csv).toContain('Test Portfolio');
      expect(csv).toContain('150000');
      expect(csv).toContain('POSITIONS');
      expect(csv).toContain('Apple Inc.');
      expect(csv).toContain('AAPL');
      expect(csv).toContain('TRANSACTIONS');
      expect(csv).toContain('BUY');
      expect(csv).toContain('Initial purchase');
    });

    it('should handle empty positions and transactions', () => {
      const mockData: PortfolioExportData = {
        portfolio: {
          id: 'portfolio-1',
          name: 'Empty Portfolio',
          createdAt: '2024-01-01T00:00:00Z',
          totalValue: 0,
          totalCost: 0,
          gainLoss: 0,
          returnPercentage: 0
        },
        positions: [],
        transactions: []
      };

      const csv = CSVExporter.exportPortfolioData(mockData);

      expect(csv).toContain('PORTFOLIO SUMMARY');
      expect(csv).toContain('Empty Portfolio');
      expect(csv).toContain('POSITIONS');
      expect(csv).toContain('TRANSACTIONS');
    });
  });

  describe('exportTransactionHistory', () => {
    it('should export transaction history', () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: 'BUY',
          assetName: 'Apple Inc.',
          quantity: 100,
          amount: 12000,
          price: 120.00,
          fee: 10,
          date: '2024-01-01T00:00:00Z',
          notes: 'Initial purchase'
        },
        {
          id: 'tx-2',
          type: 'SELL',
          assetName: 'Apple Inc.',
          quantity: 50,
          amount: 7500,
          price: 150.00,
          fee: 10,
          date: '2024-06-01T00:00:00Z'
        }
      ];

      const csv = CSVExporter.exportTransactionHistory(mockTransactions);

      expect(csv).toContain('Date,Type,Asset Name');
      expect(csv).toContain('BUY,Apple Inc.');
      expect(csv).toContain('SELL,Apple Inc.');
      expect(csv).toContain('Initial purchase');
    });

    it('should handle transactions without optional fields', () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          type: 'DEPOSIT',
          assetName: 'Cash',
          amount: 1000,
          fee: 0,
          date: '2024-01-01T00:00:00Z'
        }
      ];

      const csv = CSVExporter.exportTransactionHistory(mockTransactions);

      expect(csv).toContain('DEPOSIT,Cash');
      expect(csv).toContain('1000');
    });
  });

  describe('exportTaxReport', () => {
    it('should export complete tax report', () => {
      const mockData: TaxReportData = {
        taxYear: 2024,
        userId: 'user-1',
        realizedGains: [
          {
            assetName: 'Apple Inc.',
            symbol: 'AAPL',
            saleDate: '2024-06-01',
            purchaseDate: '2024-01-01',
            quantity: 50,
            salePrice: 7500,
            costBasis: 6000,
            gainLoss: 1500,
            termType: 'short'
          }
        ],
        dividendIncome: [
          {
            assetName: 'Apple Inc.',
            symbol: 'AAPL',
            date: '2024-03-15',
            amount: 100
          }
        ],
        summary: {
          totalRealizedGains: 1500,
          totalRealizedLosses: 0,
          netGainLoss: 1500,
          totalDividends: 100
        }
      };

      const csv = CSVExporter.exportTaxReport(mockData);

      expect(csv).toContain('TAX REPORT - 2024');
      expect(csv).toContain('SUMMARY');
      expect(csv).toContain('1500');
      expect(csv).toContain('REALIZED GAINS/LOSSES');
      expect(csv).toContain('Apple Inc.');
      expect(csv).toContain('short');
      expect(csv).toContain('DIVIDEND INCOME');
    });

    it('should handle empty tax data', () => {
      const mockData: TaxReportData = {
        taxYear: 2024,
        userId: 'user-1',
        realizedGains: [],
        dividendIncome: [],
        summary: {
          totalRealizedGains: 0,
          totalRealizedLosses: 0,
          netGainLoss: 0,
          totalDividends: 0
        }
      };

      const csv = CSVExporter.exportTaxReport(mockData);

      expect(csv).toContain('TAX REPORT - 2024');
      expect(csv).toContain('SUMMARY');
      expect(csv).toContain('REALIZED GAINS/LOSSES');
      expect(csv).toContain('DIVIDEND INCOME');
    });
  });

  describe('exportAuditTrail', () => {
    it('should export audit trail data', () => {
      const mockData: AuditTrailData = {
        userId: 'user-1',
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z'
        },
        events: [
          {
            id: 'event-1',
            timestamp: '2024-01-01T10:00:00Z',
            eventType: 'PORTFOLIO_CREATED',
            entityType: 'PORTFOLIO',
            entityId: 'portfolio-1',
            action: 'CREATE',
            userId: 'user-1',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...',
            changes: { name: 'New Portfolio' }
          }
        ]
      };

      const csv = CSVExporter.exportAuditTrail(mockData);

      expect(csv).toContain('AUDIT TRAIL - 2024-01-01T00:00:00Z to 2024-12-31T23:59:59Z');
      expect(csv).toContain('Timestamp,Event Type,Entity Type');
      expect(csv).toContain('PORTFOLIO_CREATED');
      expect(csv).toContain('CREATE');
      expect(csv).toContain('192.168.1.1');
    });

    it('should handle events without optional fields', () => {
      const mockData: AuditTrailData = {
        userId: 'user-1',
        dateRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z'
        },
        events: [
          {
            id: 'event-1',
            timestamp: '2024-01-01T10:00:00Z',
            eventType: 'LOGIN',
            entityType: 'USER',
            entityId: 'user-1',
            action: 'LOGIN',
            userId: 'user-1'
          }
        ]
      };

      const csv = CSVExporter.exportAuditTrail(mockData);

      expect(csv).toContain('LOGIN');
      expect(csv).toContain('USER');
    });
  });
});