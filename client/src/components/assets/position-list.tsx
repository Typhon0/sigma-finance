import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react';
import { PositionCard } from './position-card';
import type { PortfolioAsset } from '@/gql/graphql';

interface PositionListProps {
  positions: PortfolioAsset[];
  onPositionClick?: (position: PortfolioAsset) => void;
  onEditPosition?: (position: PortfolioAsset) => void;
  onDeletePosition?: (positionId: string) => void;
  groupBy?: 'type' | 'allocation' | 'performance' | 'none';
  showActions?: boolean;
  className?: string;
}

type SortField = 'name' | 'value' | 'performance' | 'allocation';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

interface FilterState {
  search: string;
  assetType: string;
  minValue: string;
  maxValue: string;
}

export function PositionList({
  positions,
  onPositionClick,
  onEditPosition,
  onDeletePosition,
  groupBy = 'none',
  showActions = true,
  className,
}: PositionListProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    assetType: 'all',
    minValue: '',
    maxValue: '',
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Get unique asset types for filter dropdown
  const assetTypes = useMemo(() => {
    const types = new Set(positions.map(p => p.asset.assetType.name));
    return Array.from(types).sort();
  }, [positions]);

  // Filter and sort positions
  const filteredAndSortedPositions = useMemo(() => {
    let filtered = positions.filter(position => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = position.asset.name.toLowerCase().includes(searchLower);
        const matchesSymbol = position.asset.symbol?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesSymbol) return false;
      }

      // Asset type filter
      if (filters.assetType !== 'all' && position.asset.assetType.name !== filters.assetType) {
        return false;
      }

      // Value range filter
      const currentValue = position.currentValue || 0;
      if (filters.minValue && currentValue < parseFloat(filters.minValue)) return false;
      if (filters.maxValue && currentValue > parseFloat(filters.maxValue)) return false;

      return true;
    });

    // Sort positions
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      switch (sortField) {
        case 'name':
          aValue = a.asset.name;
          bValue = b.asset.name;
          break;
        case 'value':
          aValue = a.currentValue || 0;
          bValue = b.currentValue || 0;
          break;
        case 'performance':
          // Calculate performance percentage
          const aPerf = a.currentValue && a.averagePurchasePrice 
            ? ((a.currentValue - a.averagePurchasePrice) / a.averagePurchasePrice) * 100 
            : 0;
          const bPerf = b.currentValue && b.averagePurchasePrice 
            ? ((b.currentValue - b.averagePurchasePrice) / b.averagePurchasePrice) * 100 
            : 0;
          aValue = aPerf;
          bValue = bPerf;
          break;
        case 'allocation':
          aValue = a.ownershipPct || 0;
          bValue = b.ownershipPct || 0;
          break;
        default:
          aValue = a.asset.name;
          bValue = b.asset.name;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [positions, filters, sortField, sortDirection]);

  // Group positions if needed
  const groupedPositions = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Positions': filteredAndSortedPositions };
    }

    const groups: Record<string, PortfolioAsset[]> = {};

    filteredAndSortedPositions.forEach(position => {
      let groupKey: string;

      switch (groupBy) {
        case 'type':
          groupKey = position.asset.assetType.name.replace('_', ' ');
          break;
        case 'allocation':
          const allocation = position.ownershipPct || 0;
          if (allocation >= 75) groupKey = 'Major Holdings (75%+)';
          else if (allocation >= 25) groupKey = 'Significant Holdings (25-75%)';
          else groupKey = 'Minor Holdings (<25%)';
          break;
        case 'performance':
          const performance = position.currentValue && position.averagePurchasePrice 
            ? ((position.currentValue - position.averagePurchasePrice) / position.averagePurchasePrice) * 100 
            : 0;
          if (performance >= 10) groupKey = 'Strong Performers (10%+)';
          else if (performance >= 0) groupKey = 'Positive Performers (0-10%)';
          else if (performance >= -10) groupKey = 'Minor Losses (0 to -10%)';
          else groupKey = 'Significant Losses (-10%+)';
          break;
        default:
          groupKey = 'All Positions';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(position);
    });

    return groups;
  }, [filteredAndSortedPositions, groupBy]);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      assetType: 'all',
      minValue: '',
      maxValue: '',
    });
  };

  const hasActiveFilters = filters.search || filters.assetType !== 'all' || filters.minValue || filters.maxValue;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Filters and Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Positions</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Asset Type Filter */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search positions..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>

            <Select
              value={filters.assetType}
              onValueChange={(value) => setFilters(prev => ({ ...prev, assetType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {assetTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                placeholder="Min value"
                type="number"
                value={filters.minValue}
                onChange={(e) => setFilters(prev => ({ ...prev, minValue: e.target.value }))}
              />
              <Input
                placeholder="Max value"
                type="number"
                value={filters.maxValue}
                onChange={(e) => setFilters(prev => ({ ...prev, maxValue: e.target.value }))}
              />
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            {(['name', 'value', 'performance', 'allocation'] as SortField[]).map(field => (
              <Button
                key={field}
                variant={sortField === field ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange(field)}
                className="gap-1"
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
                {sortField === field && (
                  sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                )}
              </Button>
            ))}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Positions Display */}
      {Object.entries(groupedPositions).map(([groupName, groupPositions]) => (
        <div key={groupName}>
          {groupBy !== 'none' && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold">{groupName}</h3>
                <Badge variant="secondary">{groupPositions.length}</Badge>
              </div>
              <Separator className="mb-4" />
            </>
          )}

          {groupPositions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No positions match your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className={
              viewMode === 'grid' 
                ? 'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'space-y-3'
            }>
              {groupPositions.map(position => (
                <PositionCard
                  key={`${position.asset.id}`}
                  position={position}
                  onClick={onPositionClick}
                  onEdit={onEditPosition}
                  onDelete={onDeletePosition}
                  showActions={showActions}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}