import {
	AlertTriangle,
	Bell,
	Edit,
	Plus,
	Target,
	Trash2,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters";

export interface PerformanceAlert {
	id: string;
	name: string;
	type: "price" | "percentage" | "portfolio_value" | "allocation" | "performance";
	condition: "above" | "below" | "increase_by" | "decrease_by";
	threshold: number;
	targetAsset?: string;
	targetPortfolio?: string;
	isActive: boolean;
	frequency: "immediate" | "daily" | "weekly";
	lastTriggered?: Date;
	createdAt: Date;
	description?: string;
	notificationMethods: ("email" | "push" | "sms")[];
}

export interface AlertFormData {
	name: string;
	type: PerformanceAlert["type"];
	condition: PerformanceAlert["condition"];
	threshold: number;
	targetAsset?: string;
	targetPortfolio?: string;
	frequency: PerformanceAlert["frequency"];
	description?: string;
	notificationMethods: PerformanceAlert["notificationMethods"];
}

export interface PerformanceAlertsProps {
	alerts: PerformanceAlert[];
	portfolios?: Array<{ id: string; name: string }>;
	assets?: Array<{ id: string; name: string; symbol?: string }>;
	isLoading?: boolean;
	className?: string;
	compact?: boolean;
	onCreateAlert?: (alert: AlertFormData) => Promise<void>;
	onUpdateAlert?: (id: string, alert: Partial<AlertFormData>) => Promise<void>;
	onDeleteAlert?: (id: string) => Promise<void>;
	onToggleAlert?: (id: string, isActive: boolean) => Promise<void>;
}

const alertTypes = [
	{
		value: "price",
		label: "Asset Price",
		description: "Alert when asset price reaches threshold",
	},
	{
		value: "percentage",
		label: "Price Change %",
		description: "Alert on percentage price change",
	},
	{
		value: "portfolio_value",
		label: "Portfolio Value",
		description: "Alert when portfolio value changes",
	},
	{
		value: "allocation",
		label: "Asset Allocation",
		description: "Alert when allocation exceeds limits",
	},
	{
		value: "performance",
		label: "Performance",
		description: "Alert on performance metrics",
	},
];

const conditions = [
	{
		value: "above",
		label: "Above",
		description: "Trigger when value goes above threshold",
	},
	{
		value: "below",
		label: "Below",
		description: "Trigger when value goes below threshold",
	},
	{
		value: "increase_by",
		label: "Increases By",
		description: "Trigger when value increases by amount",
	},
	{
		value: "decrease_by",
		label: "Decreases By",
		description: "Trigger when value decreases by amount",
	},
];

const frequencies = [
	{
		value: "immediate",
		label: "Immediate",
		description: "Alert immediately when condition is met",
	},
	{ value: "daily", label: "Daily", description: "Check once per day" },
	{ value: "weekly", label: "Weekly", description: "Check once per week" },
];

const getAlertIcon = (type: PerformanceAlert["type"]) => {
	switch (type) {
		case "price":
			return <TrendingUp className="h-4 w-4" />;
		case "percentage":
			return <TrendingDown className="h-4 w-4" />;
		case "portfolio_value":
			return <Target className="h-4 w-4" />;
		case "allocation":
			return <AlertTriangle className="h-4 w-4" />;
		case "performance":
			return <TrendingUp className="h-4 w-4" />;
		default:
			return <Bell className="h-4 w-4" />;
	}
};

const getAlertStatusColor = (alert: PerformanceAlert) => {
	if (!alert.isActive) return "secondary";
	if (alert.lastTriggered && Date.now() - alert.lastTriggered.getTime() < 24 * 60 * 60 * 1000) {
		return "destructive";
	}
	return "default";
};

const formatThreshold = (threshold: number, type: PerformanceAlert["type"]) => {
	switch (type) {
		case "price":
		case "portfolio_value":
			return formatCurrency(threshold);
		case "percentage":
		case "allocation":
		case "performance":
			return formatPercentage(threshold);
		default:
			return threshold.toString();
	}
};

const AlertForm: React.FC<{
	alert?: PerformanceAlert;
	portfolios?: Array<{ id: string; name: string }>;
	assets?: Array<{ id: string; name: string; symbol?: string }>;
	onSubmit: (data: AlertFormData) => Promise<void>;
	onCancel: () => void;
}> = ({ alert, portfolios = [], assets = [], onSubmit, onCancel }) => {
	const [formData, setFormData] = useState<AlertFormData>({
		name: alert?.name || "",
		type: alert?.type || "price",
		condition: alert?.condition || "above",
		threshold: alert?.threshold || 0,
		targetAsset: alert?.targetAsset || "",
		targetPortfolio: alert?.targetPortfolio || "",
		frequency: alert?.frequency || "immediate",
		description: alert?.description || "",
		notificationMethods: alert?.notificationMethods || ["email"],
	});

	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await onSubmit(formData);
			onCancel();
		} finally {
			setIsSubmitting(false);
		}
	};

	const needsAssetTarget = ["price", "percentage"].includes(formData.type);
	const needsPortfolioTarget = ["portfolio_value", "allocation", "performance"].includes(
		formData.type,
	);

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<Label htmlFor="name">Alert Name</Label>
				<Input
					id="name"
					value={formData.name}
					onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
					placeholder="Enter alert name..."
					required
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<Label htmlFor="type">Alert Type</Label>
					<Select
						value={formData.type}
						onValueChange={(value: PerformanceAlert["type"]) =>
							setFormData((prev) => ({ ...prev, type: value }))
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{alertTypes.map((type) => (
								<SelectItem key={type.value} value={type.value}>
									<div>
										<div className="font-medium">{type.label}</div>
										<div className="text-xs text-muted-foreground">{type.description}</div>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div>
					<Label htmlFor="condition">Condition</Label>
					<Select
						value={formData.condition}
						onValueChange={(value: PerformanceAlert["condition"]) =>
							setFormData((prev) => ({ ...prev, condition: value }))
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{conditions.map((condition) => (
								<SelectItem key={condition.value} value={condition.value}>
									{condition.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div>
				<Label htmlFor="threshold">Threshold</Label>
				<Input
					id="threshold"
					type="number"
					step="0.01"
					value={formData.threshold}
					onChange={(e) =>
						setFormData((prev) => ({
							...prev,
							threshold: parseFloat(e.target.value) || 0,
						}))
					}
					placeholder="Enter threshold value..."
					required
				/>
			</div>

			{needsAssetTarget && (
				<div>
					<Label htmlFor="targetAsset">Target Asset</Label>
					<Select
						value={formData.targetAsset}
						onValueChange={(value) => setFormData((prev) => ({ ...prev, targetAsset: value }))}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select asset..." />
						</SelectTrigger>
						<SelectContent>
							{assets.map((asset) => (
								<SelectItem key={asset.id} value={asset.id}>
									{asset.name} {asset.symbol && `(${asset.symbol})`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			{needsPortfolioTarget && (
				<div>
					<Label htmlFor="targetPortfolio">Target Portfolio</Label>
					<Select
						value={formData.targetPortfolio}
						onValueChange={(value) => setFormData((prev) => ({ ...prev, targetPortfolio: value }))}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select portfolio..." />
						</SelectTrigger>
						<SelectContent>
							{portfolios.map((portfolio) => (
								<SelectItem key={portfolio.id} value={portfolio.id}>
									{portfolio.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			)}

			<div>
				<Label htmlFor="frequency">Check Frequency</Label>
				<Select
					value={formData.frequency}
					onValueChange={(value: PerformanceAlert["frequency"]) =>
						setFormData((prev) => ({ ...prev, frequency: value }))
					}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{frequencies.map((freq) => (
							<SelectItem key={freq.value} value={freq.value}>
								<div>
									<div className="font-medium">{freq.label}</div>
									<div className="text-xs text-muted-foreground">{freq.description}</div>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div>
				<Label>Notification Methods</Label>
				<div className="flex gap-4 mt-2">
					{(["email", "push", "sms"] as const).map((method) => (
						<label key={method} className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={formData.notificationMethods.includes(method)}
								onChange={(e) => {
									if (e.target.checked) {
										setFormData((prev) => ({
											...prev,
											notificationMethods: [...prev.notificationMethods, method],
										}));
									} else {
										setFormData((prev) => ({
											...prev,
											notificationMethods: prev.notificationMethods.filter((m) => m !== method),
										}));
									}
								}}
							/>
							<span className="text-sm capitalize">{method}</span>
						</label>
					))}
				</div>
			</div>

			<div>
				<Label htmlFor="description">Description (Optional)</Label>
				<Textarea
					id="description"
					value={formData.description}
					onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
					placeholder="Add notes about this alert..."
					rows={3}
				/>
			</div>

			<div className="flex gap-2 pt-4">
				<Button type="submit" disabled={isSubmitting} className="flex-1">
					{isSubmitting ? "Saving..." : alert ? "Update Alert" : "Create Alert"}
				</Button>
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</form>
	);
};

const AlertCard: React.FC<{
	alert: PerformanceAlert;
	compact?: boolean;
	onEdit?: () => void;
	onDelete?: () => void;
	onToggle?: (isActive: boolean) => void;
}> = ({ alert, compact = false, onEdit, onDelete, onToggle }) => {
	const statusColor = getAlertStatusColor(alert);
	const typeInfo = alertTypes.find((t) => t.value === alert.type);
	const conditionInfo = conditions.find((c) => c.value === alert.condition);

	return (
		<Card className={cn("transition-all duration-200", !alert.isActive && "opacity-60")}>
			<CardContent className={cn("p-4", compact && "p-3")}>
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-3 flex-1">
						<div className={cn("p-2 rounded-lg bg-muted", compact && "p-1.5")}>
							{getAlertIcon(alert.type)}
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<h4 className={cn("font-semibold truncate", compact && "text-sm")}>{alert.name}</h4>
								<Badge variant={statusColor} className="text-xs">
									{alert.isActive ? "Active" : "Inactive"}
								</Badge>
							</div>
							<p className={cn("text-sm text-muted-foreground mb-2", compact && "text-xs")}>
								{typeInfo?.label} {conditionInfo?.label.toLowerCase()}{" "}
								{formatThreshold(alert.threshold, alert.type)}
							</p>
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<span>Frequency: {alert.frequency}</span>
								{alert.lastTriggered && (
									<span>Last: {alert.lastTriggered.toLocaleDateString()}</span>
								)}
								<span>{alert.notificationMethods.join(", ")}</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Switch
							checked={alert.isActive}
							onCheckedChange={onToggle}
							className="data-[state=checked]:bg-green-500"
						/>
						{onEdit && (
							<Button size="sm" variant="ghost" onClick={onEdit} className="h-6 w-6 p-0">
								<Edit className="h-3 w-3" />
							</Button>
						)}
						{onDelete && (
							<Button size="sm" variant="ghost" onClick={onDelete} className="h-6 w-6 p-0">
								<Trash2 className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export const PerformanceAlerts: React.FC<PerformanceAlertsProps> = ({
	alerts,
	portfolios = [],
	assets = [],
	isLoading = false,
	className,
	compact = false,
	onCreateAlert,
	onUpdateAlert,
	onDeleteAlert,
	onToggleAlert,
}) => {
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editingAlert, setEditingAlert] = useState<PerformanceAlert | null>(null);

	const alertStats = useMemo(() => {
		const active = alerts.filter((a) => a.isActive).length;
		const triggered = alerts.filter(
			(a) => a.lastTriggered && Date.now() - a.lastTriggered.getTime() < 24 * 60 * 60 * 1000,
		).length;

		return { total: alerts.length, active, triggered };
	}, [alerts]);

	const handleCreateAlert = async (data: AlertFormData) => {
		await onCreateAlert?.(data);
		setIsCreateDialogOpen(false);
	};

	const handleUpdateAlert = async (data: AlertFormData) => {
		if (editingAlert) {
			await onUpdateAlert?.(editingAlert.id, data);
			setEditingAlert(null);
		}
	};

	const handleDeleteAlert = async (id: string) => {
		if (confirm("Are you sure you want to delete this alert?")) {
			await onDeleteAlert?.(id);
		}
	};

	if (isLoading) {
		return (
			<Card className={className}>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent className="space-y-4">
					{Array.from({ length: 3 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: unavoidable
						<Skeleton key={i} className="h-20 w-full" />
					))}
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Bell className="h-5 w-5" />
						Performance Alerts
					</CardTitle>
					<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
						<DialogTrigger asChild>
							<Button size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Add Alert
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-lg">
							<DialogHeader>
								<DialogTitle>Create Performance Alert</DialogTitle>
							</DialogHeader>
							<AlertForm
								portfolios={portfolios}
								assets={assets}
								onSubmit={handleCreateAlert}
								onCancel={() => setIsCreateDialogOpen(false)}
							/>
						</DialogContent>
					</Dialog>
				</div>

				{/* Alert Statistics */}
				<div className="flex gap-4 text-sm">
					<div className="flex items-center gap-1">
						<Badge variant="outline">{alertStats.total}</Badge>
						<span className="text-muted-foreground">Total</span>
					</div>
					<div className="flex items-center gap-1">
						<Badge variant="default">{alertStats.active}</Badge>
						<span className="text-muted-foreground">Active</span>
					</div>
					<div className="flex items-center gap-1">
						<Badge variant="destructive">{alertStats.triggered}</Badge>
						<span className="text-muted-foreground">Recently Triggered</span>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{alerts.length === 0 ? (
					<div className="text-center py-8">
						<Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-lg font-semibold mb-2">No Alerts Set</h3>
						<p className="text-muted-foreground mb-4">
							Create alerts to monitor your portfolio performance and get notified of important
							changes.
						</p>
						<Button onClick={() => setIsCreateDialogOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Create Your First Alert
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{alerts.map((alert) => (
							<AlertCard
								key={alert.id}
								alert={alert}
								compact={compact}
								onEdit={() => setEditingAlert(alert)}
								onDelete={() => handleDeleteAlert(alert.id)}
								onToggle={(isActive) => onToggleAlert?.(alert.id, isActive)}
							/>
						))}
					</div>
				)}

				{/* Edit Alert Dialog */}
				<Dialog open={!!editingAlert} onOpenChange={() => setEditingAlert(null)}>
					<DialogContent className="max-w-lg">
						<DialogHeader>
							<DialogTitle>Edit Performance Alert</DialogTitle>
						</DialogHeader>
						{editingAlert && (
							<AlertForm
								alert={editingAlert}
								portfolios={portfolios}
								assets={assets}
								onSubmit={handleUpdateAlert}
								onCancel={() => setEditingAlert(null)}
							/>
						)}
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
};

export default PerformanceAlerts;
