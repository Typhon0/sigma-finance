import { zodResolver } from "@hookform/resolvers/zod";
import {
	Bell,
	DollarSign,
	Mail,
	MessageSquare,
	Percent,
	TrendingDown,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { Separator } from "@/components/ui/separator";
import type { AlertQuickSetupData, Asset, Portfolio } from "./types";

const quickSetupSchema = z
	.object({
		assetId: z.string().optional(),
		portfolioId: z.string().optional(),
		alertType: z.enum(["PRICE", "PERCENTAGE_CHANGE", "PORTFOLIO_VALUE", "ALLOCATION"]),
		thresholdValue: z.number().positive().optional(),
		thresholdPercentage: z.number().min(0).max(100).optional(),
		notificationMethods: z
			.array(z.enum(["EMAIL", "PUSH", "SMS"]))
			.min(1, "Select at least one notification method"),
	})
	.refine(
		(data) => {
			// Require asset or portfolio based on alert type
			if (data.alertType === "PRICE" || data.alertType === "PERCENTAGE_CHANGE") {
				return data.assetId !== undefined;
			}
			if (data.alertType === "PORTFOLIO_VALUE" || data.alertType === "ALLOCATION") {
				return data.portfolioId !== undefined;
			}
			return true;
		},
		{
			message:
				"Asset is required for price/percentage alerts, portfolio is required for portfolio/allocation alerts",
			path: ["assetId"],
		},
	)
	.refine(
		(data) => {
			// Require appropriate threshold based on alert type
			if (data.alertType === "PRICE" || data.alertType === "PORTFOLIO_VALUE") {
				return data.thresholdValue !== undefined && data.thresholdValue > 0;
			}
			if (data.alertType === "PERCENTAGE_CHANGE" || data.alertType === "ALLOCATION") {
				return data.thresholdPercentage !== undefined && data.thresholdPercentage >= 0;
			}
			return true;
		},
		{
			message: "Threshold value is required",
			path: ["thresholdValue"],
		},
	);

interface AlertQuickSetupProps {
	portfolios: Portfolio[];
	assets: Asset[];
	preselectedAssetId?: string;
	preselectedPortfolioId?: string;
	onSubmit: (data: AlertQuickSetupData) => Promise<void>;
	className?: string;
}

export function AlertQuickSetup({
	portfolios,
	assets,
	preselectedAssetId,
	preselectedPortfolioId,
	onSubmit,
	className,
}: AlertQuickSetupProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<AlertQuickSetupData>({
		resolver: zodResolver(quickSetupSchema),
		defaultValues: {
			assetId: preselectedAssetId || "",
			portfolioId: preselectedPortfolioId || "",
			alertType: "PRICE",
			notificationMethods: ["EMAIL"],
		},
	});

	const watchedAlertType = watch("alertType");
	const watchedNotificationMethods = watch("notificationMethods");
	const watchedAssetId = watch("assetId");
	const watchedPortfolioId = watch("portfolioId");

	// Quick setup templates
	const templates = [
		{
			id: "price-above",
			name: "Price Above",
			description: "Alert when asset price goes above a threshold",
			icon: <TrendingUp className="h-5 w-5" />,
			alertType: "PRICE" as const,
			requiresAsset: true,
			suggestedThreshold: (asset: Asset) => (asset.currentPrice ? asset.currentPrice * 1.1 : 100),
		},
		{
			id: "price-below",
			name: "Price Below",
			description: "Alert when asset price drops below a threshold",
			icon: <TrendingDown className="h-5 w-5" />,
			alertType: "PRICE" as const,
			requiresAsset: true,
			suggestedThreshold: (asset: Asset) => (asset.currentPrice ? asset.currentPrice * 0.9 : 50),
		},
		{
			id: "percentage-gain",
			name: "Percentage Gain",
			description: "Alert when asset gains a certain percentage",
			icon: <Percent className="h-5 w-5" />,
			alertType: "PERCENTAGE_CHANGE" as const,
			requiresAsset: true,
			suggestedPercentage: 10,
		},
		{
			id: "percentage-loss",
			name: "Percentage Loss",
			description: "Alert when asset loses a certain percentage",
			icon: <Percent className="h-5 w-5" />,
			alertType: "PERCENTAGE_CHANGE" as const,
			requiresAsset: true,
			suggestedPercentage: 5,
		},
		{
			id: "portfolio-milestone",
			name: "Portfolio Milestone",
			description: "Alert when portfolio reaches a value milestone",
			icon: <DollarSign className="h-5 w-5" />,
			alertType: "PORTFOLIO_VALUE" as const,
			requiresPortfolio: true,
			suggestedThreshold: () => 100000,
		},
	];

	const handleTemplateSelect = (template: (typeof templates)[0]) => {
		setSelectedTemplate(template.id);
		setValue("alertType", template.alertType);

		if (template.requiresAsset && watchedAssetId) {
			const asset = assets.find((a) => a.id === watchedAssetId);
			if (asset && template.suggestedThreshold) {
				setValue("thresholdValue", template.suggestedThreshold(asset));
			}
			if (template.suggestedPercentage) {
				setValue("thresholdPercentage", template.suggestedPercentage);
			}
		}

		if (template.requiresPortfolio && template.suggestedThreshold) {
			setValue("thresholdValue", template.suggestedThreshold());
		}
	};

	const handleFormSubmit = async (data: AlertQuickSetupData) => {
		try {
			await onSubmit(data);
			setIsOpen(false);
			reset();
			setSelectedTemplate(null);
		} catch (_error) {}
	};

	const toggleNotificationMethod = (method: "EMAIL" | "PUSH" | "SMS") => {
		const current = watchedNotificationMethods || [];
		const updated = current.includes(method)
			? current.filter((m) => m !== method)
			: [...current, method];
		setValue("notificationMethods", updated);
	};

	const requiresAsset = watchedAlertType === "PRICE" || watchedAlertType === "PERCENTAGE_CHANGE";
	const requiresPortfolio =
		watchedAlertType === "PORTFOLIO_VALUE" || watchedAlertType === "ALLOCATION";
	const requiresValue = watchedAlertType === "PRICE" || watchedAlertType === "PORTFOLIO_VALUE";
	const requiresPercentage =
		watchedAlertType === "PERCENTAGE_CHANGE" || watchedAlertType === "ALLOCATION";

	const selectedAsset = assets.find((a) => a.id === watchedAssetId);
	const _selectedPortfolio = portfolios.find((p) => p.id === watchedPortfolioId);

	return (
		<div className={className}>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" className="gap-2">
						<Zap className="h-4 w-4" />
						Quick Alert Setup
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5" />
							Quick Alert Setup
						</DialogTitle>
						<DialogDescription>
							Create an alert quickly using predefined templates or custom settings.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
						{/* Template Selection */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium">Choose a Template</h3>
							<div className="grid gap-3 grid-cols-1 md:grid-cols-2">
								{templates.map((template) => (
									<Card
										key={template.id}
										className={`cursor-pointer transition-colors ${
											selectedTemplate === template.id
												? "ring-2 ring-primary bg-primary/5"
												: "hover:bg-muted/50"
										}`}
										onClick={() => handleTemplateSelect(template)}
									>
										<CardContent className="p-4">
											<div className="flex items-start gap-3">
												<div className="p-2 rounded-lg bg-primary/10">{template.icon}</div>
												<div className="flex-1 min-w-0">
													<h4 className="font-medium">{template.name}</h4>
													<p className="text-sm text-muted-foreground">{template.description}</p>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>

						<Separator />

						{/* Target Selection */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium">Select Target</h3>

							<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
								{requiresAsset && (
									<div className="space-y-2">
										<Label htmlFor="assetId">Asset *</Label>
										<Select
											value={watchedAssetId || ""}
											onValueChange={(value) => setValue("assetId", value)}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select asset" />
											</SelectTrigger>
											<SelectContent>
												{assets.map((asset) => (
													<SelectItem key={asset.id} value={asset.id}>
														<div className="flex items-center gap-2">
															<span>{asset.name}</span>
															{asset.symbol && (
																<Badge variant="outline" className="text-xs">
																	{asset.symbol}
																</Badge>
															)}
															{asset.currentPrice && (
																<span className="text-xs text-muted-foreground">
																	${asset.currentPrice.toFixed(2)}
																</span>
															)}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{errors.assetId && (
											<p className="text-sm text-destructive">{errors.assetId.message}</p>
										)}
									</div>
								)}

								{requiresPortfolio && (
									<div className="space-y-2">
										<Label htmlFor="portfolioId">Portfolio *</Label>
										<Select
											value={watchedPortfolioId || ""}
											onValueChange={(value) => setValue("portfolioId", value)}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select portfolio" />
											</SelectTrigger>
											<SelectContent>
												{portfolios.map((portfolio) => (
													<SelectItem key={portfolio.id} value={portfolio.id}>
														{portfolio.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{errors.portfolioId && (
											<p className="text-sm text-destructive">{errors.portfolioId.message}</p>
										)}
									</div>
								)}
							</div>

							{/* Current Value Display */}
							{selectedAsset?.currentPrice && (
								<div className="p-3 bg-muted/50 rounded-lg">
									<p className="text-sm text-muted-foreground">
										Current price of {selectedAsset.name}:
										<span className="font-medium ml-1">
											${selectedAsset.currentPrice.toFixed(2)}
										</span>
									</p>
								</div>
							)}
						</div>

						{/* Threshold Configuration */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium">Set Threshold</h3>

							<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
								{requiresValue && (
									<div className="space-y-2">
										<Label htmlFor="thresholdValue">Threshold Value *</Label>
										<div className="relative">
											<DollarSign className="pointer-events-none absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												id="thresholdValue"
												type="number"
												step="0.01"
												min="0"
												placeholder="0.00"
												style={{ paddingLeft: "2.5rem" }}
												{...register("thresholdValue", { valueAsNumber: true })}
											/>
										</div>
										{errors.thresholdValue && (
											<p className="text-sm text-destructive">{errors.thresholdValue.message}</p>
										)}
									</div>
								)}

								{requiresPercentage && (
									<div className="space-y-2">
										<Label htmlFor="thresholdPercentage">Threshold Percentage *</Label>
										<div className="relative">
											<Percent className="pointer-events-none absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												id="thresholdPercentage"
												type="number"
												step="0.1"
												min="0"
												max="100"
												placeholder="0.0"
												style={{ paddingLeft: "2.5rem" }}
												{...register("thresholdPercentage", {
													valueAsNumber: true,
												})}
											/>
										</div>
										{errors.thresholdPercentage && (
											<p className="text-sm text-destructive">
												{errors.thresholdPercentage.message}
											</p>
										)}
									</div>
								)}
							</div>
						</div>

						{/* Notification Methods */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium">Notification Methods</h3>
							<div className="flex gap-4">
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable */}
								{/* biome-ignore lint/a11y/noStaticElementInteractions: unavoidable */}
								<div
									className="flex items-center space-x-2 cursor-pointer"
									onClick={() => toggleNotificationMethod("EMAIL")}
								>
									<Checkbox
										checked={watchedNotificationMethods?.includes("EMAIL") || false}
										onChange={() => toggleNotificationMethod("EMAIL")}
									/>
									<Mail className="h-4 w-4" />
									<Label className="cursor-pointer">Email</Label>
								</div>

								{/* biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable */}
								{/* biome-ignore lint/a11y/noStaticElementInteractions: unavoidable */}
								<div
									className="flex items-center space-x-2 cursor-pointer"
									onClick={() => toggleNotificationMethod("PUSH")}
								>
									<Checkbox
										checked={watchedNotificationMethods?.includes("PUSH") || false}
										onChange={() => toggleNotificationMethod("PUSH")}
									/>
									<Bell className="h-4 w-4" />
									<Label className="cursor-pointer">Push</Label>
								</div>

								{/* biome-ignore lint/a11y/noStaticElementInteractions: unavoidable */}
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: unavoidable */}
								<div
									className="flex items-center space-x-2 cursor-pointer"
									onClick={() => toggleNotificationMethod("SMS")}
								>
									<Checkbox
										checked={watchedNotificationMethods?.includes("SMS") || false}
										onChange={() => toggleNotificationMethod("SMS")}
									/>
									<MessageSquare className="h-4 w-4" />
									<Label className="cursor-pointer">SMS</Label>
								</div>
							</div>
							{errors.notificationMethods && (
								<p className="text-sm text-destructive">{errors.notificationMethods.message}</p>
							)}
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setIsOpen(false);
									reset();
									setSelectedTemplate(null);
								}}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Creating..." : "Create Alert"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
