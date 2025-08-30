import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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

describe('useDashboardState', () => {
  it('should initialize with overview state', () => {
    const { result } = renderHook(() => useDashboardState());
    const [viewState] = result.current;

    expect(viewState.viewMode).toBe('overview');
    expect(viewState.selectedPortfolio).toBeNull();
    expect(viewState.selectedAsset).toBeNull();
    expect(viewState.breadcrumbPath).toEqual([{ title: 'Dashboard' }]);
  });

  it('should transition to portfolio detail view', () => {
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

  it('should transition to asset detail view', () => {
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

  it('should navigate back to overview', () => {
    const { result } = renderHook(() => useDashboardState());
    const [, actions] = result.current;

    // First go to portfolio detail
    act(() => {
      actions.viewPortfolio(mockPortfolio);
    });

    // Then back to overview
    act(() => {
      actions.backToOverview();
    });

    const [viewState] = result.current;
    expect(viewState.viewMode).toBe('overview');
    expect(viewState.selectedPortfolio).toBeNull();
    expect(viewState.selectedAsset).toBeNull();
    expect(viewState.breadcrumbPath).toEqual([{ title: 'Dashboard' }]);
  });

  it('should navigate back to portfolio from asset detail', () => {
    const { result } = renderHook(() => useDashboardState());
    const [, actions] = result.current;

    // First go to asset detail
    act(() => {
      actions.viewAsset(mockAsset, mockPortfolio);
    });

    // Then back to portfolio
    act(() => {
      actions.backToPortfolio(mockPortfolio);
    });

    const [viewState] = result.current;
    expect(viewState.viewMode).toBe('portfolio-detail');
    expect(viewState.selectedPortfolio).toEqual(mockPortfolio);
    expect(viewState.selectedAsset).toBeNull();
    expect(viewState.breadcrumbPath).toHaveLength(2);
    expect(viewState.breadcrumbPath[1].title).toBe('Test Portfolio');
  });

  it('should update breadcrumb navigation callbacks', () => {
    const { result } = renderHook(() => useDashboardState());
    const [, actions] = result.current;

    act(() => {
      actions.viewPortfolio(mockPortfolio);
    });

    const [viewState] = result.current;
    expect(viewState.breadcrumbPath[0].onClick).toBeDefined();
    expect(typeof viewState.breadcrumbPath[0].onClick).toBe('function');
  });
});