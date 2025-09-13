import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboardState } from '../use-dashboard-state';
import type { Portfolio } from '@/gql/graphql';
import type { Asset } from '../use-dashboard-state';

// Mock data
const mockPortfolio: Portfolio = {
  id: 'portfolio-1',
  name: 'Test Portfolio',
  description: 'A test portfolio',
  assets: []
};

const mockAsset: Asset = {
  id: 'asset-1',
  name: 'Apple Inc.',
  symbol: 'AAPL',
  type: 'STOCK'
};

const mockAsset2: Asset = {
  id: 'asset-2',
  name: 'Bitcoin',
  symbol: 'BTC',
  type: 'CRYPTO'
};

const mockPortfolio2: Portfolio = {
  id: 'portfolio-2',
  name: 'Crypto Portfolio',
  description: 'Cryptocurrency investments',
  assets: []
};

describe('useDashboardState - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useDashboardState());
      const [viewState] = result.current;

      expect(viewState.viewMode).toBe('overview');
      expect(viewState.selectedPortfolio).toBeNull();
      expect(viewState.selectedAsset).toBeNull();
      expect(viewState.breadcrumbPath).toEqual([{ title: 'Dashboard' }]);
    });

    it('should provide all required action methods', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      expect(actions.viewPortfolio).toBeDefined();
      expect(actions.viewAsset).toBeDefined();
      expect(actions.backToOverview).toBeDefined();
      expect(actions.backToPortfolio).toBeDefined();
      expect(typeof actions.viewPortfolio).toBe('function');
      expect(typeof actions.viewAsset).toBe('function');
      expect(typeof actions.backToOverview).toBe('function');
      expect(typeof actions.backToPortfolio).toBe('function');
    });
  });

  describe('View Transitions', () => {
    it('should transition from overview to portfolio detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('portfolio-detail');
      expect(viewState.selectedPortfolio).toEqual(mockPortfolio);
      expect(viewState.selectedAsset).toBeNull();
      expect(viewState.breadcrumbPath).toHaveLength(2);
      expect(viewState.breadcrumbPath[1].title).toBe('Test Portfolio');
    });

    it('should transition from overview to asset detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('asset-detail');
      expect(viewState.selectedPortfolio).toEqual(mockPortfolio);
      expect(viewState.selectedAsset).toEqual(mockAsset);
      expect(viewState.breadcrumbPath).toHaveLength(3);
      expect(viewState.breadcrumbPath[2].title).toBe('Apple Inc.');
    });

    it('should transition from portfolio detail to asset detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // First go to portfolio detail
      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      // Then to asset detail
      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('asset-detail');
      expect(viewState.selectedPortfolio).toEqual(mockPortfolio);
      expect(viewState.selectedAsset).toEqual(mockAsset);
    });

    it('should handle switching between different portfolios', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go to first portfolio
      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      // Switch to second portfolio
      act(() => {
        actions.viewPortfolio(mockPortfolio2);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('portfolio-detail');
      expect(viewState.selectedPortfolio).toEqual(mockPortfolio2);
      expect(viewState.breadcrumbPath[1].title).toBe('Crypto Portfolio');
    });

    it('should handle switching between different assets', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go to first asset
      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      // Switch to second asset
      act(() => {
        actions.viewAsset(mockAsset2, mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('asset-detail');
      expect(viewState.selectedAsset).toEqual(mockAsset2);
      expect(viewState.breadcrumbPath[2].title).toBe('Bitcoin');
    });
  });

  describe('Navigation Back Actions', () => {
    it('should navigate back to overview from portfolio detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go to portfolio detail
      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      // Navigate back
      act(() => {
        actions.backToOverview();
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('overview');
      expect(viewState.selectedPortfolio).toBeNull();
      expect(viewState.selectedAsset).toBeNull();
      expect(viewState.breadcrumbPath).toEqual([{ title: 'Dashboard' }]);
    });

    it('should navigate back to overview from asset detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go to asset detail
      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      // Navigate back to overview
      act(() => {
        actions.backToOverview();
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('overview');
      expect(viewState.selectedPortfolio).toBeNull();
      expect(viewState.selectedAsset).toBeNull();
    });

    it('should navigate back to portfolio from asset detail', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go through portfolio to asset
      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      // Navigate back to portfolio
      act(() => {
        actions.backToPortfolio(mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('portfolio-detail');
      expect(viewState.selectedPortfolio).toEqual(mockPortfolio);
      expect(viewState.selectedAsset).toBeNull();
      expect(viewState.breadcrumbPath).toHaveLength(2);
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should generate correct breadcrumb for overview', () => {
      const { result } = renderHook(() => useDashboardState());
      const [viewState] = result.current;

      expect(viewState.breadcrumbPath).toEqual([{ title: 'Dashboard' }]);
    });

    it('should generate correct breadcrumb for portfolio detail with navigation', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      act(() => {
        actions.viewPortfolio(mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.breadcrumbPath).toHaveLength(2);
      expect(viewState.breadcrumbPath[0].title).toBe('Dashboard');
      expect(viewState.breadcrumbPath[0].onClick).toBeDefined();
      expect(viewState.breadcrumbPath[1].title).toBe('Test Portfolio');
      expect(viewState.breadcrumbPath[1].onClick).toBeUndefined();
    });

    it('should generate correct breadcrumb for asset detail with navigation', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      const [viewState] = result.current;
      expect(viewState.breadcrumbPath).toHaveLength(3);
      expect(viewState.breadcrumbPath[0].title).toBe('Dashboard');
      expect(viewState.breadcrumbPath[0].onClick).toBeDefined();
      expect(viewState.breadcrumbPath[1].title).toBe('Test Portfolio');
      expect(viewState.breadcrumbPath[1].onClick).toBeDefined();
      expect(viewState.breadcrumbPath[2].title).toBe('Apple Inc.');
      expect(viewState.breadcrumbPath[2].onClick).toBeUndefined();
    });

    it('should execute breadcrumb navigation callbacks correctly', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Go to asset detail
      act(() => {
        actions.viewAsset(mockAsset, mockPortfolio);
      });

      let [viewState] = result.current;
      
      // Click on portfolio breadcrumb
      act(() => {
        viewState.breadcrumbPath[1].onClick?.();
      });

      [viewState] = result.current;
      expect(viewState.viewMode).toBe('portfolio-detail');
      expect(viewState.selectedAsset).toBeNull();

      // Click on dashboard breadcrumb
      act(() => {
        viewState.breadcrumbPath[0].onClick?.();
      });

      [viewState] = result.current;
      expect(viewState.viewMode).toBe('overview');
      expect(viewState.selectedPortfolio).toBeNull();
    });
  });



  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined portfolio properties gracefully', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      const portfolioWithoutName = {
        id: 'portfolio-1',
        name: undefined,
        description: 'A test portfolio',
        assets: []
      } as any;

      // This should not crash the application
      expect(() => {
        act(() => {
          actions.viewPortfolio(portfolioWithoutName);
        });
      }).not.toThrow();
    });

    it('should handle undefined asset properties gracefully', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      const assetWithoutName = {
        id: 'asset-1',
        name: undefined,
        symbol: 'AAPL',
        type: 'STOCK'
      } as any;

      // This should not crash the application
      expect(() => {
        act(() => {
          actions.viewAsset(assetWithoutName, mockPortfolio);
        });
      }).not.toThrow();
    });

    it('should handle missing portfolio in back navigation gracefully', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      const portfolioWithoutName = {
        id: 'portfolio-1',
        name: undefined,
        description: 'A test portfolio',
        assets: []
      } as any;

      // This should not crash the application
      expect(() => {
        act(() => {
          actions.backToPortfolio(portfolioWithoutName);
        });
      }).not.toThrow();
    });

    it('should handle rapid state changes', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Rapid state changes
      act(() => {
        actions.viewPortfolio(mockPortfolio);
        actions.viewAsset(mockAsset, mockPortfolio);
        actions.backToPortfolio(mockPortfolio);
        actions.backToOverview();
      });

      const [viewState] = result.current;
      expect(viewState.viewMode).toBe('overview');
      expect(viewState.selectedPortfolio).toBeNull();
      expect(viewState.selectedAsset).toBeNull();
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state during all transitions', () => {
      const { result } = renderHook(() => useDashboardState());
      const [, actions] = result.current;

      // Test all possible transitions
      const transitions = [
        () => actions.viewPortfolio(mockPortfolio),
        () => actions.viewAsset(mockAsset, mockPortfolio),
        () => actions.backToPortfolio(mockPortfolio),
        () => actions.viewAsset(mockAsset2, mockPortfolio),
        () => actions.backToOverview(),
        () => actions.viewAsset(mockAsset, mockPortfolio2),
        () => actions.backToOverview(),
      ];

      transitions.forEach((transition, index) => {
        act(() => {
          transition();
        });

        const [viewState] = result.current;
        
        // Verify state consistency
        if (viewState.viewMode === 'overview') {
          expect(viewState.selectedPortfolio).toBeNull();
          expect(viewState.selectedAsset).toBeNull();
          expect(viewState.breadcrumbPath).toHaveLength(1);
        } else if (viewState.viewMode === 'portfolio-detail') {
          expect(viewState.selectedPortfolio).not.toBeNull();
          expect(viewState.selectedAsset).toBeNull();
          expect(viewState.breadcrumbPath).toHaveLength(2);
        } else if (viewState.viewMode === 'asset-detail') {
          expect(viewState.selectedPortfolio).not.toBeNull();
          expect(viewState.selectedAsset).not.toBeNull();
          expect(viewState.breadcrumbPath).toHaveLength(3);
        }
      });
    });
  });
});