import { useState, useCallback } from 'react';
import type { Portfolio } from '@/gql/graphql';

export interface Asset {
  id: string;
  name: string;
  symbol?: string;
  type: string;
}

export interface BreadcrumbItem {
  title: string;
  href?: string;
  onClick?: () => void;
}

export interface DashboardViewState {
  viewMode: 'overview' | 'portfolio-detail' | 'asset-detail';
  selectedPortfolio: Portfolio | null;
  selectedAsset: Asset | null;
  breadcrumbPath: BreadcrumbItem[];
}

export interface DashboardActions {
  viewPortfolio: (portfolio: Portfolio) => void;
  viewAsset: (asset: Asset, portfolio: Portfolio) => void;
  backToOverview: () => void;
  backToPortfolio: (portfolio: Portfolio) => void;
}

export function useDashboardState(): [DashboardViewState, DashboardActions] {
  const [viewState, setViewState] = useState<DashboardViewState>({
    viewMode: 'overview',
    selectedPortfolio: null,
    selectedAsset: null,
    breadcrumbPath: [{ title: 'Dashboard' }]
  });

  const actions: DashboardActions = {
    viewPortfolio: useCallback((portfolio: Portfolio) => {
      setViewState({
        viewMode: 'portfolio-detail',
        selectedPortfolio: portfolio,
        selectedAsset: null,
        breadcrumbPath: [
          { 
            title: 'Dashboard', 
            onClick: () => actions.backToOverview() 
          },
          { title: portfolio.name }
        ]
      });
    }, []),

    viewAsset: useCallback((asset: Asset, portfolio: Portfolio) => {
      setViewState({
        viewMode: 'asset-detail',
        selectedPortfolio: portfolio,
        selectedAsset: asset,
        breadcrumbPath: [
          { 
            title: 'Dashboard', 
            onClick: () => actions.backToOverview() 
          },
          { 
            title: portfolio.name, 
            onClick: () => actions.viewPortfolio(portfolio) 
          },
          { title: asset.name }
        ]
      });
    }, []),

    backToOverview: useCallback(() => {
      setViewState({
        viewMode: 'overview',
        selectedPortfolio: null,
        selectedAsset: null,
        breadcrumbPath: [{ title: 'Dashboard' }]
      });
    }, []),

    backToPortfolio: useCallback((portfolio: Portfolio) => {
      setViewState({
        viewMode: 'portfolio-detail',
        selectedPortfolio: portfolio,
        selectedAsset: null,
        breadcrumbPath: [
          { 
            title: 'Dashboard', 
            onClick: () => actions.backToOverview() 
          },
          { title: portfolio.name }
        ]
      });
    }, [])
  };

  return [viewState, actions];
}