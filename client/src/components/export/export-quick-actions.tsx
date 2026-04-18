import {
	ChevronDown,
	Database,
	Download,
	FileSpreadsheet,
	FileText,
	Receipt,
	Shield,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportType } from "@/lib/export/types";
import { ExportDialog } from "./export-dialog";

interface ExportQuickActionsProps {
	portfolioId?: string;
	portfolioName?: string;
	variant?: "default" | "outline" | "ghost";
	size?: "default" | "sm" | "lg";
	showLabel?: boolean;
}

export function ExportQuickActions({
	portfolioId,
	portfolioName,
	variant = "outline",
	size = "default",
	showLabel = true,
}: ExportQuickActionsProps) {
	const [exportDialogOpen, setExportDialogOpen] = useState(false);
	const [selectedExportType, setSelectedExportType] =
		useState<ExportType>("portfolio-data");

	const quickActions = [
		{
			type: "portfolio-data" as ExportType,
			label: "Portfolio CSV",
			icon: FileSpreadsheet,
			description: "Export portfolio positions and summary",
		},
		{
			type: "transaction-history" as ExportType,
			label: "Transaction History",
			icon: FileText,
			description: "Export all transactions",
		},
		{
			type: "performance-analytics" as ExportType,
			label: "Performance Report",
			icon: FileText,
			description: "Generate PDF performance report",
		},
		{
			type: "tax-report" as ExportType,
			label: "Tax Report",
			icon: Receipt,
			description: "Export tax-related data",
		},
		{
			type: "audit-trail" as ExportType,
			label: "Audit Trail",
			icon: Shield,
			description: "Export activity log",
		},
		{
			type: "data-backup" as ExportType,
			label: "Full Backup",
			icon: Database,
			description: "Complete data export",
		},
	];

	const handleQuickExport = (type: ExportType) => {
		setSelectedExportType(type);
		setExportDialogOpen(true);
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant={variant} size={size} className="gap-2">
						<Download className="h-4 w-4" />
						{showLabel && "Export"}
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					{quickActions.map((action, _index) => {
						const Icon = action.icon;
						const isPortfolioRequired = [
							"portfolio-data",
							"transaction-history",
							"performance-analytics",
						].includes(action.type);
						const isDisabled = isPortfolioRequired && !portfolioId;

						return (
							<DropdownMenuItem
								key={action.type}
								onClick={() => !isDisabled && handleQuickExport(action.type)}
								disabled={isDisabled}
								className="flex flex-col items-start gap-1 p-3"
							>
								<div className="flex items-center gap-2 w-full">
									<Icon className="h-4 w-4" />
									<span className="font-medium">{action.label}</span>
								</div>
								<span className="text-xs text-muted-foreground">
									{isDisabled
										? "Requires portfolio selection"
										: action.description}
								</span>
							</DropdownMenuItem>
						);
					})}

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onClick={() => {
							setSelectedExportType("portfolio-data");
							setExportDialogOpen(true);
						}}
						className="flex items-center gap-2"
					>
						<Download className="h-4 w-4" />
						<span>Custom Export...</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				portfolioId={portfolioId}
				portfolioName={portfolioName}
				defaultType={selectedExportType}
			/>
		</>
	);
}

// Simplified export button for inline use
interface QuickExportButtonProps {
	type: ExportType;
	portfolioId?: string;
	portfolioName?: string;
	variant?: "default" | "outline" | "ghost";
	size?: "default" | "sm" | "lg";
	children?: React.ReactNode;
}

export function QuickExportButton({
	type,
	portfolioId,
	portfolioName,
	variant = "ghost",
	size = "sm",
	children,
}: QuickExportButtonProps) {
	const [exportDialogOpen, setExportDialogOpen] = useState(false);

	const getButtonContent = () => {
		if (children) return children;

		switch (type) {
			case "portfolio-data":
				return (
					<>
						<FileSpreadsheet className="h-4 w-4" />
						<span className="sr-only">Export Portfolio</span>
					</>
				);
			case "transaction-history":
				return (
					<>
						<FileText className="h-4 w-4" />
						<span className="sr-only">Export Transactions</span>
					</>
				);
			default:
				return (
					<>
						<Download className="h-4 w-4" />
						<span className="sr-only">Export</span>
					</>
				);
		}
	};

	return (
		<>
			<Button
				variant={variant}
				size={size}
				onClick={() => setExportDialogOpen(true)}
				className="gap-2"
			>
				{getButtonContent()}
			</Button>

			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				portfolioId={portfolioId}
				portfolioName={portfolioName}
				defaultType={type}
			/>
		</>
	);
}
