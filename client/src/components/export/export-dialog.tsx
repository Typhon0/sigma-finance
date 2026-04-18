import { CalendarIcon, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ExportService } from "@/lib/export/export-service";
import type { ExportFormat, ExportType } from "@/lib/export/types";
import { cn } from "@/lib/utils";

interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portfolioId?: string;
	portfolioName?: string;
	defaultType?: ExportType;
}

export function ExportDialog({
	open,
	onOpenChange,
	portfolioId,
	portfolioName,
	defaultType = "portfolio-data",
}: ExportDialogProps) {
	const [exportType, setExportType] = useState<ExportType>(defaultType);
	const [format, setFormat] = useState<ExportFormat>("csv");
	const [dateRange, setDateRange] = useState<{
		start?: Date;
		end?: Date;
	}>({});
	const [isExporting, setIsExporting] = useState(false);
	const [exportResult, setExportResult] = useState<string | null>(null);

	const exportTypes = [
		{
			value: "portfolio-data",
			label: "Portfolio Data",
			requiresPortfolio: true,
		},
		{
			value: "transaction-history",
			label: "Transaction History",
			requiresPortfolio: true,
		},
		{
			value: "performance-analytics",
			label: "Performance Analytics",
			requiresPortfolio: true,
		},
		{ value: "tax-report", label: "Tax Report", requiresPortfolio: false },
		{ value: "audit-trail", label: "Audit Trail", requiresPortfolio: false },
		{
			value: "data-backup",
			label: "Complete Data Backup",
			requiresPortfolio: false,
		},
	] as const;

	const formatOptions = [
		{
			value: "csv",
			label: "CSV",
			supportedTypes: [
				"portfolio-data",
				"transaction-history",
				"tax-report",
				"audit-trail",
			],
		},
		{
			value: "pdf",
			label: "PDF",
			supportedTypes: ["portfolio-data", "performance-analytics", "tax-report"],
		},
		{
			value: "json",
			label: "JSON",
			supportedTypes: [
				"portfolio-data",
				"transaction-history",
				"tax-report",
				"audit-trail",
				"data-backup",
			],
		},
	] as const;

	const selectedTypeConfig = exportTypes.find((t) => t.value === exportType);
	const availableFormats = formatOptions.filter((f) =>
		f.supportedTypes.includes(exportType as any),
	);

	const requiresDateRange = [
		"transaction-history",
		"audit-trail",
		"tax-report",
	].includes(exportType);
	const requiresPortfolio =
		selectedTypeConfig?.requiresPortfolio && !portfolioId;

	const handleExport = async () => {
		if (requiresPortfolio) {
			setExportResult("Please select a portfolio first");
			return;
		}

		setIsExporting(true);
		setExportResult(null);

		try {
			let result;

			switch (exportType) {
				case "portfolio-data":
					result = await ExportService.exportPortfolioData(
						portfolioId!,
						format,
					);
					break;
				case "transaction-history":
					result = await ExportService.exportTransactionHistory(
						portfolioId!,
						dateRange.start && dateRange.end
							? (dateRange as { start: Date; end: Date })
							: undefined,
						format,
					);
					break;
				case "tax-report": {
					const taxYear = new Date().getFullYear() - 1; // Previous year by default
					result = await ExportService.exportTaxReport(
						"current-user",
						taxYear,
						format,
					);
					break;
				}
				case "audit-trail":
					if (!dateRange.start || !dateRange.end) {
						setExportResult("Date range is required for audit trail export");
						return;
					}
					result = await ExportService.exportAuditTrail(
						"current-user",
						dateRange as { start: Date; end: Date },
						format,
					);
					break;
				case "data-backup":
					result = await ExportService.createDataBackup("current-user");
					break;
				default:
					throw new Error(`Unsupported export type: ${exportType}`);
			}

			if (result.success) {
				setExportResult(`Export successful: ${result.filename}`);
				setTimeout(() => onOpenChange(false), 2000);
			} else {
				setExportResult(`Export failed: ${result.error}`);
			}
		} catch (error) {
			setExportResult(
				`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setIsExporting(false);
		}
	};

	const resetForm = () => {
		setExportType(defaultType);
		setFormat("csv");
		setDateRange({});
		setExportResult(null);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(open) => {
				onOpenChange(open);
				if (!open) resetForm();
			}}
		>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Export Data</DialogTitle>
					<DialogDescription>
						{portfolioName
							? `Export data from ${portfolioName}`
							: "Export your portfolio data"}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="export-type">Export Type</Label>
						<Select
							value={exportType}
							onValueChange={(value) => {
								setExportType(value as ExportType);
								// Reset format to first available option
								const newAvailableFormats = formatOptions.filter((f) =>
									f.supportedTypes.includes(value as any),
								);
								if (newAvailableFormats.length > 0) {
									setFormat(newAvailableFormats[0].value);
								}
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select export type" />
							</SelectTrigger>
							<SelectContent>
								{exportTypes.map((type) => (
									<SelectItem
										key={type.value}
										value={type.value}
										disabled={type.requiresPortfolio && !portfolioId}
									>
										{type.label}
										{type.requiresPortfolio &&
											!portfolioId &&
											" (requires portfolio)"}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="format">Format</Label>
						<Select
							value={format}
							onValueChange={(value) => setFormat(value as ExportFormat)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select format" />
							</SelectTrigger>
							<SelectContent>
								{availableFormats.map((fmt) => (
									<SelectItem key={fmt.value} value={fmt.value}>
										{fmt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{requiresDateRange && (
						<div className="grid gap-2">
							<Label>Date Range</Label>
							<div className="flex gap-2">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"flex-1 justify-start text-left font-normal",
												!dateRange.start && "text-muted-foreground",
											)}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{dateRange.start
												? format(dateRange.start, "PPP")
												: "Start date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={dateRange.start}
											onSelect={(date) =>
												setDateRange((prev) => ({ ...prev, start: date }))
											}
											initialFocus
										/>
									</PopoverContent>
								</Popover>

								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className={cn(
												"flex-1 justify-start text-left font-normal",
												!dateRange.end && "text-muted-foreground",
											)}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{dateRange.end
												? format(dateRange.end, "PPP")
												: "End date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0">
										<Calendar
											mode="single"
											selected={dateRange.end}
											onSelect={(date) =>
												setDateRange((prev) => ({ ...prev, end: date }))
											}
											initialFocus
										/>
									</PopoverContent>
								</Popover>
							</div>
						</div>
					)}

					{exportResult && (
						<div
							className={cn(
								"p-3 rounded-md text-sm",
								exportResult.includes("successful")
									? "bg-green-50 text-green-700 border border-green-200"
									: "bg-red-50 text-red-700 border border-red-200",
							)}
						>
							{exportResult}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						onClick={handleExport}
						disabled={isExporting || requiresPortfolio}
					>
						{isExporting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Exporting...
							</>
						) : (
							<>
								<Download className="mr-2 h-4 w-4" />
								Export
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
