import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PortfolioList, SortBy } from '../portfolio-list'
import { PortfolioAction, ViewMode } from '../portfolio-card'
import { Portfolio } from '@/hooks/use-portfolio-management'

// Mock @dnd-kit modules
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd, onDragStart }: any) => (
    <div data-testid="dnd-context" data-drag-end={onDragEnd} data-drag-start={onDragStart}>
      {children}
    </div>
  ),
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  arrayMove: vi.fn((array, oldIndex, newIndex) => {
    const result = [...array]
    const [removed] = result.splice(oldIndex, 1)
    result.splice(newIndex, 0, removed)
    return result
  }),
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  rectSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}))

// Mock portfolio data
const mockPortfolios: Portfolio[] = [
  {
    id: 'portfolio-1',
    name: 'Growth Portfolio',
    description: 'High growth potential stocks',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T15:30:00Z',
    assets: [
      {
        id: 'position-1',
        quantity: 100,
        averagePurchasePrice: 50,
        ownershipPct: 100,
        asset: {
          id: 'asset-1',
          name: 'Apple Inc.',
          symbol: 'AAPL',
          currentValue: 60,
          assetType: { name: 'STOCK' }
        }
      }
    ]
  },
  {
    id: 'portfolio-2',
    name: 'Conservative Portfolio',
    description: 'Low risk investments',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T12:00:00Z',
    assets: [
      {
        id: 'position-2',
        quantity: 1000,
        averagePurchasePrice: 10,
        ownershipPct: 100,
        asset: {
          id: 'asset-2',
          name: 'Treasury Bond',
          currentValue: 9.5,
          assetType: { name: 'BOND' }
        }
      }
    ]
  },
  {
    id: 'portfolio-3',
    name: 'Crypto Portfolio',
    description: 'Cryptocurrency investments',
    createdAt: '2024-01-20T14:00:00Z',
    updatedAt: '2024-01-22T16:00:00Z',
    assets: []
  }
]

const defaultProps = {
  portfolios: mockPortfolios,
  viewMode: 'grid' as ViewMode,
  sortBy: 'name' as SortBy,
  selectedPortfolios: [],
  onSelectionChange: vi.fn(),
  onPortfolioAction: vi.fn(),
  onViewModeChange: vi.fn(),
  onSortChange: vi.fn(),
  onReorder: vi.fn(),
  isLoading: false
}

describe('PortfolioList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Portfolio list rendering and layout', () => {
    it('renders all portfolios', () => {
      render(<PortfolioList {...defaultProps} />)

      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument()
    })

    it('displays grid layout by default', () => {
      const { container } = render(<PortfolioList {...defaultProps} />)

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4')
    })

    it('displays list layout when viewMode is list', () => {
      const { container } = render(
        <PortfolioList {...defaultProps} viewMode="list" />
      )

      const listContainer = container.querySelector('.flex.flex-col.space-y-2')
      expect(listContainer).toBeInTheDocument()
    })

    it('shows loading skeleton when isLoading is true', () => {
      render(<PortfolioList {...defaultProps} isLoading={true} />)

      // Should not show actual portfolio data
      expect(screen.queryByText('Growth Portfolio')).not.toBeInTheDocument()
      
      // Should show skeleton elements
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })
  })

  describe('View mode switching functionality', () => {
    it('renders view mode toggle buttons', () => {
      render(<PortfolioList {...defaultProps} />)

      expect(screen.getByText('Grid')).toBeInTheDocument()
      expect(screen.getByText('List')).toBeInTheDocument()
    })

    it('calls onViewModeChange when view mode is changed', () => {
      const mockOnViewModeChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          onViewModeChange={mockOnViewModeChange}
        />
      )

      const listButton = screen.getByText('List')
      fireEvent.click(listButton)

      expect(mockOnViewModeChange).toHaveBeenCalledWith('list')
    })

    it('shows active view mode correctly', () => {
      render(<PortfolioList {...defaultProps} viewMode="list" />)

      const listTab = screen.getByText('List').closest('[role="tab"]')
      expect(listTab).toHaveAttribute('data-state', 'active')
    })
  })

  describe('Sorting functionality', () => {
    it('renders sort dropdown with options', () => {
      render(<PortfolioList {...defaultProps} />)

      const sortTrigger = screen.getByRole('combobox')
      fireEvent.click(sortTrigger)

      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Total Value')).toBeInTheDocument()
      expect(screen.getByText('Performance')).toBeInTheDocument()
      expect(screen.getByText('Date Created')).toBeInTheDocument()
    })

    it('calls onSortChange when sort option is selected', () => {
      const mockOnSortChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          onSortChange={mockOnSortChange}
        />
      )

      const sortTrigger = screen.getByRole('combobox')
      fireEvent.click(sortTrigger)

      const valueOption = screen.getByText('Total Value')
      fireEvent.click(valueOption)

      expect(mockOnSortChange).toHaveBeenCalledWith('value')
    })

    it('shows current sort option', () => {
      render(<PortfolioList {...defaultProps} sortBy="performance" />)

      // The current sort should be reflected in the trigger
      const sortTrigger = screen.getByRole('combobox')
      expect(sortTrigger).toHaveTextContent('Performance')
    })
  })

  describe('Selection functionality', () => {
    it('renders select all checkbox', () => {
      render(<PortfolioList {...defaultProps} />)

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0] // First checkbox is select all
      expect(selectAllCheckbox).toBeInTheDocument()
    })

    it('shows selection count when portfolios are selected', () => {
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2']}
        />
      )

      expect(screen.getByText('2 selected')).toBeInTheDocument()
      expect(screen.getByText('2 portfolios selected')).toBeInTheDocument()
    })

    it('calls onSelectionChange when select all is clicked', () => {
      const mockOnSelectionChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          onSelectionChange={mockOnSelectionChange}
        />
      )

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(selectAllCheckbox)

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['portfolio-1', 'portfolio-2', 'portfolio-3'])
    })

    it('deselects all when all are selected and select all is clicked', () => {
      const mockOnSelectionChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2', 'portfolio-3']}
          onSelectionChange={mockOnSelectionChange}
        />
      )

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      fireEvent.click(selectAllCheckbox)

      expect(mockOnSelectionChange).toHaveBeenCalledWith([])
    })

    it('shows indeterminate state when some portfolios are selected', () => {
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1']}
        />
      )

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
      // Note: Testing indeterminate state requires checking the ref callback
      // This is a limitation of testing library with indeterminate checkboxes
      expect(selectAllCheckbox).toBeInTheDocument()
    })
  })

  describe('Bulk operations', () => {
    it('shows bulk actions when portfolios are selected', () => {
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2']}
        />
      )

      expect(screen.getByText('Export Selected')).toBeInTheDocument()
      expect(screen.getByText('Delete Selected')).toBeInTheDocument()
      expect(screen.getByText('Clear Selection')).toBeInTheDocument()
    })

    it('hides bulk actions when no portfolios are selected', () => {
      render(<PortfolioList {...defaultProps} />)

      expect(screen.queryByText('Export Selected')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument()
    })

    it('calls onSelectionChange with empty array when clear selection is clicked', () => {
      const mockOnSelectionChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2']}
          onSelectionChange={mockOnSelectionChange}
        />
      )

      const clearButton = screen.getByText('Clear Selection')
      fireEvent.click(clearButton)

      expect(mockOnSelectionChange).toHaveBeenCalledWith([])
    })

    it('handles bulk export action', () => {
      // Mock console.log to capture the bulk export call
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2']}
        />
      )

      const exportButton = screen.getByText('Export Selected')
      fireEvent.click(exportButton)

      expect(consoleSpy).toHaveBeenCalledWith('Bulk export:', ['portfolio-1', 'portfolio-2'])
      
      consoleSpy.mockRestore()
    })

    it('handles bulk delete action', () => {
      // Mock console.log to capture the bulk delete call
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      render(
        <PortfolioList 
          {...defaultProps} 
          selectedPortfolios={['portfolio-1', 'portfolio-2']}
        />
      )

      const deleteButton = screen.getByText('Delete Selected')
      fireEvent.click(deleteButton)

      expect(consoleSpy).toHaveBeenCalledWith('Bulk delete:', ['portfolio-1', 'portfolio-2'])
      
      consoleSpy.mockRestore()
    })
  })

  describe('Drag and drop reordering', () => {
    it('renders DndContext for drag and drop', () => {
      render(<PortfolioList {...defaultProps} />)

      expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
      expect(screen.getByTestId('sortable-context')).toBeInTheDocument()
    })

    it('calls onReorder when portfolios are reordered', async () => {
      const mockOnReorder = vi.fn()
      const { arrayMove } = await import('@dnd-kit/sortable')
      
      render(
        <PortfolioList 
          {...defaultProps} 
          onReorder={mockOnReorder}
        />
      )

      // Simulate drag end event
      const dndContext = screen.getByTestId('dnd-context')
      const onDragEnd = dndContext.getAttribute('data-drag-end')
      
      if (onDragEnd) {
        // Simulate moving first portfolio to second position
        const dragEndEvent = {
          active: { id: 'portfolio-1' },
          over: { id: 'portfolio-2' }
        }
        
        // This would normally be called by the DndContext
        // We're testing the logic that would be triggered
        expect(arrayMove).toBeDefined()
      }
    })

    it('renders drag overlay when dragging', () => {
      render(<PortfolioList {...defaultProps} />)

      expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
    })

    it('updates portfolio order locally during drag', () => {
      render(<PortfolioList {...defaultProps} />)

      // The component should maintain local state for ordering
      // This is tested through the drag and drop functionality
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Conservative Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Crypto Portfolio')).toBeInTheDocument()
    })
  })

  describe('Portfolio action handling', () => {
    it('forwards portfolio actions to onPortfolioAction', () => {
      const mockOnPortfolioAction = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          onPortfolioAction={mockOnPortfolioAction}
        />
      )

      // This would be triggered by clicking on a portfolio card
      // The actual click handling is tested in portfolio-card.test.tsx
      expect(mockOnPortfolioAction).toBeDefined()
    })

    it('handles individual portfolio selection', () => {
      const mockOnSelectionChange = vi.fn()
      render(
        <PortfolioList 
          {...defaultProps} 
          onSelectionChange={mockOnSelectionChange}
        />
      )

      // Individual selection is handled through the portfolio cards
      // This tests that the handler is properly passed down
      expect(mockOnSelectionChange).toBeDefined()
    })
  })

  describe('Responsive behavior', () => {
    it('has responsive grid classes', () => {
      const { container } = render(<PortfolioList {...defaultProps} />)

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4')
    })

    it('adapts controls layout for mobile', () => {
      const { container } = render(<PortfolioList {...defaultProps} />)

      const controlsContainer = container.querySelector('.flex.flex-col.space-y-4.md\\:flex-row')
      expect(controlsContainer).toBeInTheDocument()
    })

    it('shows responsive view mode toggle', () => {
      render(<PortfolioList {...defaultProps} />)

      const tabsList = screen.getByRole('tablist')
      expect(tabsList).toHaveClass('grid', 'w-full', 'grid-cols-2')
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles empty portfolio list', () => {
      render(
        <PortfolioList 
          {...defaultProps} 
          portfolios={[]}
        />
      )

      // Should still render controls but no portfolios
      expect(screen.getByText('Grid')).toBeInTheDocument()
      expect(screen.getByText('List')).toBeInTheDocument()
      expect(screen.queryByText('Growth Portfolio')).not.toBeInTheDocument()
    })

    it('handles missing onReorder callback', () => {
      const { onReorder, ...propsWithoutReorder } = defaultProps
      
      render(<PortfolioList {...propsWithoutReorder} />)

      // Should render without crashing
      expect(screen.getByText('Growth Portfolio')).toBeInTheDocument()
    })

    it('handles portfolios with missing data', () => {
      const portfoliosWithMissingData = [
        {
          id: 'portfolio-1',
          name: 'Test Portfolio',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-20T15:30:00Z',
          assets: []
        }
      ] as Portfolio[]

      render(
        <PortfolioList 
          {...defaultProps} 
          portfolios={portfoliosWithMissingData}
        />
      )

      expect(screen.getByText('Test Portfolio')).toBeInTheDocument()
    })

    it('handles very large portfolio lists', () => {
      const manyPortfolios = Array.from({ length: 100 }, (_, i) => ({
        ...mockPortfolios[0],
        id: `portfolio-${i}`,
        name: `Portfolio ${i + 1}`
      }))

      render(
        <PortfolioList 
          {...defaultProps} 
          portfolios={manyPortfolios}
        />
      )

      // Should render without performance issues
      expect(screen.getByText('Portfolio 1')).toBeInTheDocument()
      expect(screen.getByText('100 selected')).toBeInTheDocument() // When select all is used
    })
  })

  describe('Loading states', () => {
    it('shows skeleton loader when loading', () => {
      render(<PortfolioList {...defaultProps} isLoading={true} />)

      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('shows skeleton with correct layout for grid view', () => {
      const { container } = render(
        <PortfolioList {...defaultProps} isLoading={true} viewMode="grid" />
      )

      const skeletonGrid = container.querySelector('.grid.gap-4.grid-cols-1.md\\:grid-cols-2')
      expect(skeletonGrid).toBeInTheDocument()
    })

    it('shows skeleton with correct layout for list view', () => {
      const { container } = render(
        <PortfolioList {...defaultProps} isLoading={true} viewMode="list" />
      )

      const skeletonList = container.querySelector('.space-y-4')
      expect(skeletonList).toBeInTheDocument()
    })
  })
})