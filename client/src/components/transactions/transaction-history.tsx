import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Download, 
  Edit, 
  Trash2, 
  ArrowUpDown,
  Calendar,
  DollarSign,
  Hash,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/utils/formatters';
import { transactionValidationHelpers } from '@/lib/validations/transaction.schemas';
import type { Transaction, TransactionType } from '@/gql/graphql';
import type { TransactionFilterData } from '@/lib/validations/transaction.schemas';

interface TransactionHistoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onTransactionEdit?: (transaction: Transaction) => void;
  onTransactionDelete?: (transactionId: string) => void;
  onExport?: (filters: TransactionFilterData) => void;
  showPortfolioColumn?: boolean;
  showAssetColumn?: boolean;
  compact?: boolean;
}

type SortField = 'date' | 'type' | 'asset' | 'amount' | 'quantity';
type SortDirection = 'asc' | 'desc';

export function TransactionHistory({
  transactions,
  isLoading = false,
  onTransactionEdit,
  onTransactionDelete,
  onExport,
  showPortfolioColumn = true,
  showAssetColumn = true,
  compact = false,
}: TransactionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'ALL'>('ALL');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(transaction =>
        transaction.asset.name.toLowerCase().includes(query) ||
        transaction.asset.symbol?.toLowerCase().includes(query) ||
        transaction.portfolio.name.toLowerCase().includes(query) ||
        transaction.notes?.toLowerCase().includes(query) ||
        transaction.transactionType.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(transaction => transaction.transactionType === typeFilter);
    }

    // Apply date filters
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(transaction => new Date(transaction.transactionDate) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter(transaction => new Date(transaction.transactionDate) <= toDate);
    }

    // Sort transactions
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'date':
          aValue = new Date(a.transactionDate);
          bValue = new Date(b.transactionDate);
          break;
        case 'type':
          aValue = a.transactionType;
          bValue = b.transactionType;
          break;
        case 'asset':
          aValue = a.asset.name;
          bValue = b.asset.name;
          break;
        case 'amount':
          aValue = a.quantity * a.pricePerUnit;
          bValue = b.quantity * b.pricePerUnit;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, searchQuery, typeFilter, dateFrom, dateTo, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleExport = () => {
    if (onExport) {
      const filters: TransactionFilterData = {
        searchQuery: searchQuery || undefined,
        transactionType: typeFilter !== 'ALL' ? typeFilter : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      };
      onExport(filters);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  if (isLoading) {
    return <TransactionHistorySkeleton compact={compact} />;
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No Transactions Found
            </h3>
            <p className="text-sm text-muted-foreground">
              Start recording transactions to see your history here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Transaction History
            <Badge variant="secondary" className="ml-2">
              {filteredAndSortedTransactions.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {onExport && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {showFilters ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>

        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Transaction Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TransactionType | 'ALL')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                    <SelectItem value="DEPOSIT">Deposit</SelectItem>
                    <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                    <SelectItem value="TRANSFER_IN">Transfer In</SelectItem>
                    <SelectItem value="TRANSFER_OUT">Transfer Out</SelectItem>
                    <SelectItem value="DIVIDEND">Dividend</SelectItem>
                    <SelectItem value="INTEREST">Interest</SelectItem>
                    <SelectItem value="FEE">Fee</SelectItem>
                    <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndSortedTransactions.length} of {transactions.length} transactions
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      <CardContent>
        {compact ? (
          <CompactTransactionList 
            transactions={filteredAndSortedTransactions}
            onTransactionEdit={onTransactionEdit}
            onTransactionDelete={onTransactionDelete}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('date')}
                      className="h-auto p-0 font-medium"
                    >
                      Date
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('type')}
                      className="h-auto p-0 font-medium"
                    >
                      Type
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  {showAssetColumn && (
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('asset')}
                        className="h-auto p-0 font-medium"
                      >
                        Asset
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                  )}
                  {showPortfolioColumn && (
                    <TableHead>Portfolio</TableHead>
                  )}
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('quantity')}
                      className="h-auto p-0 font-medium"
                    >
                      Quantity
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('amount')}
                      className="h-auto p-0 font-medium"
                    >
                      Amount
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTransactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    showPortfolioColumn={showPortfolioColumn}
                    showAssetColumn={showAssetColumn}
                    onEdit={onTransactionEdit}
                    onDelete={onTransactionDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  showPortfolioColumn: boolean;
  showAssetColumn: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
}

function TransactionRow({ 
  transaction, 
  showPortfolioColumn, 
  showAssetColumn, 
  onEdit, 
  onDelete 
}: TransactionRowProps) {
  const amount = transaction.quantity * transaction.pricePerUnit;
  const typeColor = transactionValidationHelpers.getTransactionTypeColor(transaction.transactionType);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm">
            {format(new Date(transaction.transactionDate), 'MMM dd, yyyy')}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={typeColor}>
          {transactionValidationHelpers.formatTransactionType(transaction.transactionType)}
        </Badge>
      </TableCell>
      {showAssetColumn && (
        <TableCell>
          <div>
            <div className="font-medium">{transaction.asset.name}</div>
            {transaction.asset.symbol && (
              <div className="text-sm text-muted-foreground font-mono">
                {transaction.asset.symbol}
              </div>
            )}
          </div>
        </TableCell>
      )}
      {showPortfolioColumn && (
        <TableCell>
          <span className="text-sm">{transaction.portfolio.name}</span>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-1">
          <Hash className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{transaction.quantity.toLocaleString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono">{formatCurrency(transaction.pricePerUnit)}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono font-medium">{formatCurrency(amount)}</span>
        </div>
      </TableCell>
      <TableCell>
        {transaction.notes && (
          <div className="max-w-[200px] truncate text-sm text-muted-foreground">
            {transaction.notes}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(transaction)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(transaction.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

interface CompactTransactionListProps {
  transactions: Transaction[];
  onTransactionEdit?: (transaction: Transaction) => void;
  onTransactionDelete?: (transactionId: string) => void;
}

function CompactTransactionList({ 
  transactions, 
  onTransactionEdit, 
  onTransactionDelete 
}: CompactTransactionListProps) {
  return (
    <div className="space-y-3">
      {transactions.map((transaction) => {
        const amount = transaction.quantity * transaction.pricePerUnit;
        const typeColor = transactionValidationHelpers.getTransactionTypeColor(transaction.transactionType);

        return (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant="outline" className={typeColor}>
                  {transactionValidationHelpers.formatTransactionType(transaction.transactionType)}
                </Badge>
                <span className="font-medium">{transaction.asset.name}</span>
                {transaction.asset.symbol && (
                  <span className="text-sm text-muted-foreground font-mono">
                    ({transaction.asset.symbol})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{format(new Date(transaction.transactionDate), 'MMM dd, yyyy')}</span>
                <span>{transaction.quantity.toLocaleString()} @ {formatCurrency(transaction.pricePerUnit)}</span>
                <span>{transaction.portfolio.name}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium">{formatCurrency(amount)}</div>
              </div>
              
              <div className="flex items-center gap-1">
                {onTransactionEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTransactionEdit(transaction)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
                {onTransactionDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTransactionDelete(transaction.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TransactionHistorySkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {compact ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { TransactionHistorySkeleton };