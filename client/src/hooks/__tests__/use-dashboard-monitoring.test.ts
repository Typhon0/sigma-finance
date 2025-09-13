import { renderHook, act } from '@testing-library/react';
import { useDashboardMonitoring } from '../use-dashboard-monitoring';
import { MonitoringProvider } from '@/components/monitoring/monitoring-provider';
import React from 'react';

// Mock the monitoring provider
const mockRecordEvent = jest.fn();
const mockTrackDataLoad = jest.fn();
const mockTrackUserInteraction = jest.fn();

jest.mock('@/components/monitoring/monitoring-provider', () => ({
  useMonitoring: () => ({
    recordDashboardEvent: mockRecordEvent,
    trackDataLoad: mockTrackDataLoad,
    trackUserInteraction: mockTrackUserInteraction,
    sessionId: 'test-session',
    userId: 'test-user',
  }),
  useDashboardStateTracking: () => ({
    transitionTo: jest.fn(),
  }),
  useActionTracking: () => ({
    trackClick: jest.fn(),
    trackNavigation: jest.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MonitoringProvider>{children}</MonitoringProvider>
);

describe('useDashboardMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track portfolio selection', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    act(() => {
      result.current.trackPortfolioSelection('portfolio-1', 'click');
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dashboard_state_transition',
        data: expect.objectContaining({
          to_state: 'portfolio-detail',
          to_portfolio: 'portfolio-1',
        }),
      })
    );
  });

  it('should track asset selection', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    act(() => {
      result.current.trackAssetSelection('asset-1', 'portfolio-1', 'click');
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dashboard_state_transition',
        data: expect.objectContaining({
          to_state: 'asset-detail',
          to_portfolio: 'portfolio-1',
          to_asset: 'asset-1',
        }),
      })
    );
  });

  it('should track data loading operations', async () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    const mockOperation = jest.fn().mockResolvedValue('test-data');

    await act(async () => {
      await result.current.trackDataLoading(mockOperation, 'test-data-type');
    });

    expect(mockOperation).toHaveBeenCalled();
    expect(mockTrackDataLoad).toHaveBeenCalledWith(
      'test-data-type',
      expect.any(Number),
      true
    );
  });

  it('should track errors during data loading', async () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    const mockError = new Error('Test error');
    const mockOperation = jest.fn().mockRejectedValue(mockError);

    await act(async () => {
      try {
        await result.current.trackDataLoading(mockOperation, 'test-data-type');
      } catch (error) {
        // Expected to throw
      }
    });

    expect(mockTrackDataLoad).toHaveBeenCalledWith(
      'test-data-type',
      expect.any(Number),
      false,
      mockError
    );
  });

  it('should track component render performance', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    act(() => {
      result.current.trackComponentRender('test-component', 150);
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'performance_metric',
        data: expect.objectContaining({
          metric_name: 'component_render_time',
          value: 150,
          component: 'test-component',
        }),
      })
    );
  });

  it('should track user interactions', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    act(() => {
      result.current.trackInteraction('click', 'button', { button_id: 'test-btn' });
    });

    expect(mockTrackUserInteraction).toHaveBeenCalledWith(
      'click',
      'button',
      expect.objectContaining({
        button_id: 'test-btn',
        view_mode: 'overview',
      })
    );
  });

  it('should track errors with context', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    const testError = new Error('Test error');

    act(() => {
      result.current.trackError(testError, 'test-component', { context: 'test' });
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error_occurred',
        data: expect.objectContaining({
          error_type: 'dashboard_error',
          component: 'test-component',
          message: 'Test error',
          context: { context: 'test' },
        }),
      })
    );
  });

  it('should provide current metrics', () => {
    const { result } = renderHook(() => useDashboardMonitoring(), { wrapper });

    const metrics = result.current.getCurrentMetrics();

    expect(metrics).toHaveProperty('currentState');
    expect(metrics).toHaveProperty('renderTime');
    expect(metrics).toHaveProperty('dataLoadTime');
    expect(metrics).toHaveProperty('interactionLatency');
  });
});