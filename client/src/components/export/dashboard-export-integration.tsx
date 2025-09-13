import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Receipt, 
  Database,
  Calendar,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { ExportQuickActions, QuickExportButton } from './export-quick-actions';
import { ExportDialog } from './export-dialog';
import { DataBackupRestore } from './data-backup-restore';
import type { Portfolio } from '@/gql/graphql';

interface DashboardExportIntegrationProps {
  portfolios: Portfolio[];
  selectedPortfolio?: Portfolio | null;
  userId: string;
}

export function DashboardExportIntegration({
  portfolios,
  selectedPortfolio,
  userId
}: DashboardExportIntegrationProps) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Export & Reporting</h2>
        <p className="text-muted-foreground">
          Export your portfolio data, generate reports, and manage backups from your dashboard.
        </p>
      </div>

      {/* Quick Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Quick Exports
          </CardTitle>
          <CardDescription>
            {selectedPortfolio 
              ? `Export data from ${selectedPortfolio.name}` 
              : 'Select a portfolio to enable portfolio-specific exports'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Portfolio Data Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Portfolio Data</h4>
                  <p className="text-sm text-muted-foreground">Positions & summary</p>
                </div>
              </div>
              <QuickExportButton
                type="portfolio-data"
                portfolioId={selectedPortfolio?.id}
                portfolioName={selectedPortfolio?.name}
                variant="ghost"
                size="sm"
              />
            </div>

            {/* Transaction History Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Transactions</h4>
                  <p className="text-sm text-muted-foreground">Complete history</p>
                </div>
              </div>
              <QuickExportButton
                type="transaction-history"
                portfolioId={selectedPortfolio?.id}
                portfolioName={selectedPortfolio?.name}
                variant="ghost"
                size="sm"
              />
            </div>

            {/* Performance Report Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Performance</h4>
                  <p className="text-sm text-muted-foreground">Analytics & charts</p>
                </div>
              </div>
              <QuickExportButton
                type="performance-analytics"
                portfolioId={selectedPortfolio?.id}
                portfolioName={selectedPortfolio?.name}
                variant="ghost"
                size="sm"
              />
            </div>

            {/* Tax Report Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Receipt className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">Tax Report</h4>
                  <p className="text-sm text-muted-foreground">Gains & losses</p>
                </div>
              </div>
              <QuickExportButton
                type="tax-report"
                variant="ghost"
                size="sm"
              />
            </div>

            {/* Audit Trail Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <FileText className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h4 className="font-medium">Audit Trail</h4>
                  <p className="text-sm text-muted-foreground">Activity logs</p>
                </div>
              </div>
              <QuickExportButton
                type="audit-trail"
                variant="ghost"
                size="sm"
              />
            </div>

            {/* Custom Export */}
            <div className="flex items-center justify-between p-4 border rounded-lg border-dashed">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Download className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium">Custom Export</h4>
                  <p className="text-sm text-muted-foreground">Advanced options</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
              >
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Summary with Export Actions */}
      {portfolios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Export Summary</CardTitle>
            <CardDescription>
              Export data from any of your portfolios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {portfolios.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <h4 className="font-medium">{portfolio.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        <span>Portfolio value and metrics would be shown here</span>
                      </div>
                    </div>
                    {selectedPortfolio?.id === portfolio.id && (
                      <Badge variant="secondary">Selected</Badge>
                    )}
                  </div>
                  
                  <ExportQuickActions
                    portfolioId={portfolio.id}
                    portfolioName={portfolio.name}
                    variant="outline"
                    size="sm"
                    showLabel={false}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Backup & Restore
          </CardTitle>
          <CardDescription>
            Create complete backups or restore from previous backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataBackupRestore userId={userId} />
        </CardContent>
      </Card>

      {/* Export Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Export Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">CSV Exports</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Perfect for spreadsheet analysis</li>
                <li>• Compatible with Excel and Google Sheets</li>
                <li>• Includes all numerical data</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">PDF Reports</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Professional formatted reports</li>
                <li>• Includes charts and visualizations</li>
                <li>• Ready for sharing and printing</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">JSON Backups</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Complete data preservation</li>
                <li>• Includes all metadata and settings</li>
                <li>• Can be used for data restoration</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Tax Reports</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Formatted for tax preparation</li>
                <li>• Includes realized gains/losses</li>
                <li>• Separates short and long-term gains</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        portfolioId={selectedPortfolio?.id}
        portfolioName={selectedPortfolio?.name}
      />
    </div>
  );
}