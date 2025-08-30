import React, { useState, useMemo } from 'react';
import { FileText, Download, Calendar, Filter, Mail, Share2, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils';

export interface ReportSection {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  required?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: string[];
  format: 'pdf' | 'excel' | 'csv';
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
}

export interface ReportData {
  portfolioSummary: {
    totalValue: number;
    totalChange: number;
    totalChangePercent: number;
    assetCount: number;
  };
  performance: {
    timeWeightedReturn: number;
    sharpeRatio: number;
    volatility: number;
    maxDrawdown: number;
  };
  allocation: Array<{
    assetType: string;
    value: number;
    percentage: number;
  }>;
  topPerformers: Array<{
    name: string;
    change: number;
    changePercent: number;
  }>;
  transactions: Array<{
    date: string;
    type: string;
    asset: string;
    amount: number;
  }>;
}

export interface PerformanceReportsProps {
  reportData: ReportData;
  isLoading?: boolean;
  className?: string;
  compact?: boolean;
  onGenerateReport?: (config: ReportConfig) => Promise<void>;
  onScheduleReport?: (config: ScheduledReportConfig) => Promise<void>;
  onExportData?: (format: 'csv' | 'excel' | 'json') => Promise<void>;
}

export interface ReportConfig {
  templateId: string;
  sections: string[];
  format: 'pdf' | 'excel' | 'csv';
  timeRange: string;
  includeCharts: boolean;
  includeBenchmarks: boolean;
  customTitle?: string;
  customNotes?: string;
}

export interface ScheduledReportConfig extends ReportConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  recipients: string[];
  nextDelivery: Date;
}

const defaultSections: ReportSection[] = [
  {
    id: 'summary',
    name: 'Portfolio Summary',
    description: 'Overview of portfolio value and performance',
    enabled: true,
    required: true
  },
  {
    id: 'performance',
    name: 'Performance Metrics',
    description: 'Detailed performance analysis and ratios',
    enabled: true
  },
  {
    id: 'allocation',
    name: 'Asset Allocation',
    description: 'Breakdown by asset type and diversification',
    enabled: true
  },
  {
    id: 'holdings',
    name: 'Top Holdings',
    description: 'Largest positions and their performance',
    enabled: true
  },
  {
    id: 'transactions',
    name: 'Transaction History',
    description: 'Recent buy/sell activity',
    enabled: false
  },
  {
    id: 'benchmarks',
    name: 'Benchmark Comparison',
    description: 'Performance vs market indices',
    enabled: false
  },
  {
    id: 'risk',
    name: 'Risk Analysis',
    description: 'Volatility and risk metrics',
    enabled: false
  }
];

const reportTemplates: ReportTemplate[] = [
  {
    id: 'standard',
    name: 'Standard Report',
    description: 'Comprehensive portfolio overview',
    sections: ['summary', 'performance', 'allocation', 'holdings'],
    format: 'pdf'
  },
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview for executives',
    sections: ['summary', 'performance', 'benchmarks'],
    format: 'pdf'
  },
  {
    id: 'detailed',
    name: 'Detailed Analysis',
    description: 'In-depth analysis with all metrics',
    sections: ['summary', 'performance', 'allocation', 'holdings', 'transactions', 'benchmarks', 'risk'],
    format: 'pdf'
  },
  {
    id: 'tax',
    name: 'Tax Report',
    description: 'Transaction history for tax purposes',
    sections: ['summary', 'transactions'],
    format: 'excel'
  }
];

const ReportPreview: React.FC<{
  reportData: ReportData;
  sections: string[];
  compact?: boolean;
}> = ({ reportData, sections, compact = false }) => {
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {sections.includes('summary') && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Portfolio Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Value:</span>
              <span className="ml-2 font-medium">{formatCurrency(reportData.portfolioSummary.totalValue)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Change:</span>
              <span className="ml-2 font-medium">{formatPercentage(reportData.portfolioSummary.totalChangePercent)}</span>
            </div>
          </div>
        </div>
      )}

      {sections.includes('performance') && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Performance Metrics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Time-Weighted Return:</span>
              <span className="ml-2 font-medium">{formatPercentage(reportData.performance.timeWeightedReturn)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sharpe Ratio:</span>
              <span className="ml-2 font-medium">{reportData.performance.sharpeRatio.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {sections.includes('allocation') && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Asset Allocation</h4>
          <div className="space-y-2">
            {reportData.allocation.slice(0, 3).map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{item.assetType}</span>
                <span>{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ReportGenerator: React.FC<{
  reportData: ReportData;
  onGenerate?: (config: ReportConfig) => Promise<void>;
}> = ({ reportData, onGenerate }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
  const [selectedSections, setSelectedSections] = useState<string[]>(['summary', 'performance', 'allocation']);
  const [format, setFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [timeRange, setTimeRange] = useState<string>('1M');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedTemplateData = reportTemplates.find(t => t.id === selectedTemplate);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = reportTemplates.find(t => t.id === templateId);
    if (template) {
      setSelectedSections(template.sections);
      setFormat(template.format);
    }
  };

  const handleSectionToggle = (sectionId: string) => {
    const section = defaultSections.find(s => s.id === sectionId);
    if (section?.required) return; // Can't toggle required sections

    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleGenerate = async () => {
    if (!onGenerate) return;

    setIsGenerating(true);
    try {
      await onGenerate({
        templateId: selectedTemplate,
        sections: selectedSections,
        format,
        timeRange,
        includeCharts,
        includeBenchmarks,
        customTitle: customTitle || undefined,
        customNotes: customNotes || undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <Label className="text-sm font-medium">Report Template</Label>
        <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportTemplates.map(template => (
              <SelectItem key={template.id} value={template.id}>
                <div>
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">{template.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTemplateData && (
          <p className="text-xs text-muted-foreground mt-1">
            {selectedTemplateData.description}
          </p>
        )}
      </div>

      {/* Section Selection */}
      <div>
        <Label className="text-sm font-medium">Report Sections</Label>
        <div className="mt-2 space-y-2">
          {defaultSections.map(section => (
            <div key={section.id} className="flex items-center space-x-2">
              <Checkbox
                id={section.id}
                checked={selectedSections.includes(section.id)}
                onCheckedChange={() => handleSectionToggle(section.id)}
                disabled={section.required}
              />
              <Label htmlFor={section.id} className="text-sm">
                {section.name}
                {section.required && <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Format and Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium">Format</Label>
          <Select value={format} onValueChange={(value: 'pdf' | 'excel' | 'csv') => setFormat(value)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Report</SelectItem>
              <SelectItem value="excel">Excel Spreadsheet</SelectItem>
              <SelectItem value="csv">CSV Data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Time Range</Label>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1D">1 Day</SelectItem>
              <SelectItem value="1W">1 Week</SelectItem>
              <SelectItem value="1M">1 Month</SelectItem>
              <SelectItem value="3M">3 Months</SelectItem>
              <SelectItem value="6M">6 Months</SelectItem>
              <SelectItem value="1Y">1 Year</SelectItem>
              <SelectItem value="ALL">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Additional Options */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeCharts"
            checked={includeCharts}
            onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
          />
          <Label htmlFor="includeCharts" className="text-sm">Include charts and visualizations</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="includeBenchmarks"
            checked={includeBenchmarks}
            onCheckedChange={(checked) => setIncludeBenchmarks(checked as boolean)}
          />
          <Label htmlFor="includeBenchmarks" className="text-sm">Include benchmark comparisons</Label>
        </div>
      </div>

      {/* Custom Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="customTitle" className="text-sm font-medium">Custom Title (Optional)</Label>
          <Input
            id="customTitle"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Enter custom report title..."
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="customNotes" className="text-sm font-medium">Custom Notes (Optional)</Label>
          <Textarea
            id="customNotes"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="Add any custom notes or commentary..."
            className="mt-1"
            rows={3}
          />
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label className="text-sm font-medium">Preview</Label>
        <div className="mt-2 border rounded-lg">
          <ReportPreview
            reportData={reportData}
            sections={selectedSections}
            compact={true}
          />
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || selectedSections.length === 0}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Generating Report...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Generate Report
          </>
        )}
      </Button>
    </div>
  );
};

export const PerformanceReports: React.FC<PerformanceReportsProps> = ({
  reportData,
  isLoading = false,
  className,
  compact = false,
  onGenerateReport,
  onScheduleReport,
  onExportData,
}) => {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  const quickExportOptions = [
    { format: 'csv' as const, label: 'CSV Data', icon: FileText },
    { format: 'excel' as const, label: 'Excel', icon: FileText },
    { format: 'json' as const, label: 'JSON', icon: FileText },
  ];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Performance Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Dialog open={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Generate Custom Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Generate Performance Report</DialogTitle>
              </DialogHeader>
              <ReportGenerator
                reportData={reportData}
                onGenerate={onGenerateReport}
              />
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Reports
          </Button>
        </div>

        <Separator />

        {/* Quick Export */}
        <div>
          <h4 className="text-sm font-medium mb-3">Quick Export</h4>
          <div className="grid grid-cols-3 gap-2">
            {quickExportOptions.map(option => (
              <Button
                key={option.format}
                variant="outline"
                size="sm"
                onClick={() => onExportData?.(option.format)}
                className="flex items-center gap-2"
              >
                <option.icon className="h-3 w-3" />
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Report Templates */}
        <div>
          <h4 className="text-sm font-medium mb-3">Report Templates</h4>
          <div className="space-y-2">
            {reportTemplates.slice(0, compact ? 2 : 4).map(template => (
              <div
                key={template.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    // Quick generate with template
                    onGenerateReport?.({
                      templateId: template.id,
                      sections: template.sections,
                      format: template.format,
                      timeRange: '1M',
                      includeCharts: true,
                      includeBenchmarks: false,
                    });
                  }}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        {!compact && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Recent Reports</h4>
              <div className="text-center py-4 text-muted-foreground text-sm">
                No recent reports. Generate your first report above.
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceReports;