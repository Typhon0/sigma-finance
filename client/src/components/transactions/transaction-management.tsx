import { useState } from 'react';
import { Plus, History, Upload, Calculator, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TransactionForm } from './transaction-form';
import { TransactionHistory } from './transaction-history';
import { CostBasisDisplay } from './cost-basis-display';
import { BulkImport } from './bulk-import';
import { TransactionQuickAdd } from './transaction-quick-add';
import { TransactionValidation } from './transaction-validation';
import type { Portfolio, Asset, Transaction, Position } from '@/gql/graphql';
import type { TransactionFormData, BulkTransactionData, TransactionFilterData } from '@/lib/validations/transaction.schemas';

interface TransactionManagementProps {
  portfolio: Portfolio;
  assets: Asset[];
  transactions: Transaction[];
  positions: Position[];
  onAddTransaction: (data: TransactionFormData) => Promise<void>;
  onEditTransaction: (id: string, data: TransactionFormData) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onBulkImport: (data: BulkTransactionData) => Promise<void>;
  onExportTransactions: (filters: TransactionFilterData) => Promise<void>;
  isLoading?: boolean;
  compact?: boolean;
}

export function TransactionManagement({
  portfolio,
  assets,
  transactions,
  positions,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onBulkImport,
  onExportTransactions,
  isLoading = false,
  compact = false,
}: TransactionManagementProps) {
  const [activeTab, setActiveTab] = useState('quick-add');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const handleQuickAdd = async (transaction: any) => {
    const formData: TransactionFormData = {
      portfolioId: portfolio.id,
      assetId: transaction.assetId,
      transactionType: transaction.transactionType,
      quantity: transaction.quantity,
      pricePerUnit: transaction.pricePerUnit,
      amount: transaction.amount,
      fee: 0,
      transactionDate: new Date(),
      notes: '',
    };

    await onAddTransaction(formData);
  };

  const handleTransactionEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowTransactionForm(true);
  };

  const handleTransactionDelete = async (transactionId: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      await onDeleteTransaction(transactionId);
    }
  };

  const handleFormSubmit = async (data: TransactionFormData) => {
    if (editingTransaction) {
      await onEditTransaction(editingTransaction.id, data);
      setEditingTransaction(null);
    } else {
      await onAddTransaction(data);
    }
    setShowTransactionForm(false);
  };

  const handleFormCancel = () => {
    setShowTransactionForm(false);
    setEditingTransaction(null);
  };

  const getCostBasisData = (position: Position) => {
    const positionTransactions = transactions.filter(t => 
      t.asset.id === position.asset.id && 
      t.portfolio.id === portfolio.id
    );

    // Calculate cost basis (simplified - in real app this would be more complex)
    const totalCostBasis = positionTransactions
      .filter(t => t.transactionType === 'BUY')
      .reduce((sum, t) => sum + (t.quantity * t.pricePerUnit), 0);

    const totalQuantity = position.quantity || 0;
    const averageCostBasis = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
    const currentValue = totalQuantity * (position.asset.currentValue || 0);
    const unrealizedGainLoss = currentValue - totalCostBasis;
    const unrealizedGainLossPercent = totalCostBasis > 0 ? (unrealizedGainLoss / totalCostBasis) * 100 : 0;

    const realizedGainLoss = positionTransactions
      .filter(t => t.transactionType === 'SELL')
      .reduce((sum, t) => {
        // Simplified realized gains calculation
        const sellValue = t.quantity * t.pricePerUnit;
        const costBasis = t.quantity * averageCostBasis;
        return sum + (sellValue - costBasis);
      }, 0);

    return {
      totalCostBasis,
      averageCostBasis,
      currentValue,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      realizedGainLoss,
      totalQuantity,
      transactions: positionTransactions,
    };
  };

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Quick Add */}
        <TransactionQuickAdd
          portfolio={portfolio}
          assets={assets}
          onAddTransaction={handleQuickAdd}
          isLoading={isLoading}
          compact={true}
        />

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Transactions</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('history')}
              >
                <History className="h-4 w-4 mr-2" />
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <TransactionHistory
              transactions={transactions.slice(0, 5)}
              isLoading={isLoading}
              onTransactionEdit={handleTransactionEdit}
              onTransactionDelete={handleTransactionDelete}
              showPortfolioColumn={false}
              compact={true}
            />
          </CardContent>
        </Card>

        {/* Cost Basis for Selected Position */}
        {selectedPosition && (
          <CostBasisDisplay
            position={selectedPosition}
            costBasisData={getCostBasisData(selectedPosition)}
            isLoading={isLoading}
            compact={true}
          />
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Transaction Management
            <Badge variant="outline" className="ml-2">
              {portfolio.name}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Bulk Transaction Import</DialogTitle>
                </DialogHeader>
                <BulkImport
                  portfolios={[portfolio]}
                  onImport={onBulkImport}
                  onCancel={() => setShowBulkImport(false)}
                  isLoading={isLoading}
                />
              </DialogContent>
            </Dialog>

            <Dialog open={showTransactionForm} onOpenChange={setShowTransactionForm}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
                  </DialogTitle>
                </DialogHeader>
                <TransactionForm
                  portfolios={[portfolio]}
                  assets={assets}
                  selectedPortfolio={portfolio}
                  onSubmit={handleFormSubmit}
                  onCancel={handleFormCancel}
                  isLoading={isLoading}
                  mode={editingTransaction ? 'edit' : 'create'}
                  initialData={editingTransaction ? {
                    portfolioId: editingTransaction.portfolio.id,
                    assetId: editingTransaction.asset.id,
                    transactionType: editingTransaction.transactionType,
                    quantity: editingTransaction.quantity,
                    pricePerUnit: editingTransaction.pricePerUnit,
                    amount: editingTransaction.quantity * editingTransaction.pricePerUnit,
                    fee: 0, // Would need to be added to GraphQL schema
                    transactionDate: new Date(editingTransaction.transactionDate),
                    notes: editingTransaction.notes || '',
                  } : undefined}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quick-add">Quick Add</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="cost-basis">Cost Basis</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-add" className="space-y-4">
            <TransactionQuickAdd
              portfolio={portfolio}
              assets={assets}
              onAddTransaction={handleQuickAdd}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <TransactionHistory
              transactions={transactions}
              isLoading={isLoading}
              onTransactionEdit={handleTransactionEdit}
              onTransactionDelete={handleTransactionDelete}
              onExport={onExportTransactions}
              showPortfolioColumn={false}
            />
          </TabsContent>

          <TabsContent value="cost-basis" className="space-y-4">
            {positions.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Select Position:</span>
                  <div className="flex flex-wrap gap-2">
                    {positions.map((position) => (
                      <Button
                        key={position.id}
                        variant={selectedPosition?.id === position.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedPosition(position)}
                      >
                        {position.asset.name}
                        {position.asset.symbol && ` (${position.asset.symbol})`}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedPosition ? (
                  <CostBasisDisplay
                    position={selectedPosition}
                    costBasisData={getCostBasisData(selectedPosition)}
                    isLoading={isLoading}
                    showDetails={true}
                  />
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">
                        Select a Position
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Choose a position above to view cost basis and performance details.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    No Positions Found
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Add some assets to this portfolio to see cost basis information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Validation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Validation tools will be shown here when adding or editing transactions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}