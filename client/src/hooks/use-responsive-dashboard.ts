import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from './use-media-query';

export interface ResponsiveDashboardState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  sidebarCollapsed: boolean;
  showMobileMenu: boolean;
  orientation: 'portrait' | 'landscape';
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export interface ResponsiveDashboardActions {
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  handleSwipeGesture: (direction: 'left' | 'right') => void;
}

export function useResponsiveDashboard(): [ResponsiveDashboardState, ResponsiveDashboardActions] {
  // Media queries for different breakpoints
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  
  // Screen size breakpoints
  const isXs = useMediaQuery('(max-width: 479px)');
  const isSm = useMediaQuery('(min-width: 480px) and (max-width: 639px)');
  const isMd = useMediaQuery('(min-width: 640px) and (max-width: 767px)');
  const isLg = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isXl = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)');
  const is2xl = useMediaQuery('(min-width: 1280px)');

  // State management
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Default to collapsed on mobile, expanded on desktop
    return isMobile;
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Determine screen size
  const getScreenSize = (): ResponsiveDashboardState['screenSize'] => {
    if (isXs) return 'xs';
    if (isSm) return 'sm';
    if (isMd) return 'md';
    if (isLg) return 'lg';
    if (isXl) return 'xl';
    return '2xl';
  };

  // Auto-adjust sidebar based on screen size changes
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
      setShowMobileMenu(false);
    } else if (isDesktop) {
      // On desktop, restore previous state or default to expanded
      const savedState = localStorage.getItem('dashboard-sidebar-collapsed');
      if (savedState !== null && savedState !== 'undefined') {
        try {
          setSidebarCollapsed(JSON.parse(savedState));
        } catch {
          setSidebarCollapsed(false);
        }
      } else {
        setSidebarCollapsed(false);
      }
    }
  }, [isMobile, isDesktop]);

  // Save sidebar state to localStorage for desktop
  useEffect(() => {
    if (isDesktop) {
      localStorage.setItem('dashboard-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed, isDesktop]);

  // Actions
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setShowMobileMenu(prev => !prev);
    } else {
      setSidebarCollapsed(prev => !prev);
    }
  }, [isMobile]);

  const toggleMobileMenu = useCallback(() => {
    setShowMobileMenu(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setShowMobileMenu(false);
  }, []);

  const handleSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, []);

  const handleSwipeGesture = useCallback((direction: 'left' | 'right') => {
    if (isMobile) {
      if (direction === 'right' && !showMobileMenu) {
        setShowMobileMenu(true);
      } else if (direction === 'left' && showMobileMenu) {
        setShowMobileMenu(false);
      }
    }
  }, [isMobile, showMobileMenu]);

  const state: ResponsiveDashboardState = {
    isMobile,
    isTablet,
    isDesktop,
    sidebarCollapsed,
    showMobileMenu,
    orientation: isPortrait ? 'portrait' : 'landscape',
    screenSize: getScreenSize(),
  };

  const actions: ResponsiveDashboardActions = {
    toggleSidebar,
    toggleMobileMenu,
    closeMobileMenu,
    setSidebarCollapsed: handleSidebarCollapsed,
    handleSwipeGesture,
  };

  return [state, actions];
}

// Hook for touch gesture detection
export function useTouchGestures(onSwipe: (direction: 'left' | 'right') => void) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      endX = e.touches[0].clientX;
      endY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const minSwipeDistance = 50;
      const maxVerticalDistance = 100;

      // Check if it's a horizontal swipe
      if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < maxVerticalDistance) {
        if (deltaX > 0) {
          onSwipe('right');
        } else {
          onSwipe('left');
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipe]);
}

// Hook for responsive chart dimensions
export function useResponsiveChartDimensions() {
  const [state] = useResponsiveDashboard();
  
  const getChartHeight = (defaultHeight: number = 300): number => {
    switch (state.screenSize) {
      case 'xs':
        return Math.min(defaultHeight * 0.6, 200);
      case 'sm':
        return Math.min(defaultHeight * 0.7, 250);
      case 'md':
        return Math.min(defaultHeight * 0.8, 280);
      default:
        return defaultHeight;
    }
  };

  const getChartConfig = (defaultHeight: number = 300) => ({
    height: getChartHeight(defaultHeight),
    responsive: true,
    maintainAspectRatio: false,
    showLegend: !state.isMobile,
    showTooltips: true,
    touchOptimized: state.isMobile,
  });

  return {
    getChartHeight,
    getChartConfig,
    isMobile: state.isMobile,
    isTablet: state.isTablet,
    screenSize: state.screenSize,
  };
}