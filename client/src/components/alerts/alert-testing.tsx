import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertTriangle,
	Bell,
	CheckCircle,
	DollarSign,
	Loader2,
	Percent,
	Play,
	TestTube,
	TrendingDown,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { AlertTestData, Alert as AlertType } from "./types";

const testSchema = z.object({
	alertId: z.string().min(1, "Please select an alert to test"),
	testType: z.enum(["CONDITION", "NOTIFICATION"]),
	mockValue: z.number().optional(),
	mockPercentage: z.number().min(0).max(100).optional(),
});

interface AlertTestingProps {
	alerts: AlertType[];
	onTest?: (data: AlertTestData) => Promise<void>;
	className?: string;
}

interface TestResult {
	success: boolean;
	message: string;
	details?: string;
	timestamp: Date;
}

export function AlertTesting({ alerts, onTest, className }: AlertTestingProps) {
	const [testResults, setTestResults] = useState<Record<string, TestResult>>(
		{},
	);
	const [isRunningTest, setIsRunningTest] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		_reset,
		formState: { errors, isSubmitting },
	} = useForm<AlertTestData>({
		resolver: zodResolver(testSchema),
		defaultValues: {
			testType: "CONDITION",
		},
	});

	const watchedAlertId = watch("alertId");
	const watchedTestType = watch("testType");

	const selectedAlert = alerts.find((alert) => alert.id === watchedAlertId);

	const handleTest = async (data: AlertTestData) => {
		if (!onTest || !selectedAlert) return;

		setIsRunningTest(data.alertId);

		try {
			await onTest(data);

			// Simulate test result (in real app, this would come from the API)
			const result: TestResult = {
				success: Math.random() > 0.2, // 80% success rate for demo
				message:
					data.testType === "CONDITION"
						? "Alert condition evaluation completed"
						: "Notification delivery test completed",
				details:
					data.testType === "CONDITION"
						? `Tested with ${data.mockValue ? `value: ${formatCurrency(data.mockValue)}` : `percentage: ${formatPercentage((data.mockPercentage || 0) / 100)}`}`
						: "Test notification sent to all configured channels",
				timestamp: new Date(),
			};

			setTestResults((prev) => ({
				...prev,
				[data.alertId]: result,
			}));
		} catch (error) {
			setTestResults((prev) => ({
				...prev,
				[data.alertId]: {
					success: false,
					message: "Test failed",
					details:
						error instanceof Error ? error.message : "Unknown error occurred",
					timestamp: new Date(),
				},
			}));
		} finally {
			setIsRunningTest(null);
		}
	};

	const runQuickTest = async (
		alert: AlertType,
		testType: "CONDITION" | "NOTIFICATION",
	) => {
		if (!onTest) return;

		const testData: AlertTestData = {
			alertId: alert.id,
			testType,
		};

		// Set mock values based on alert type
		if (testType === "CONDITION") {
			if (
				alert.alertType === "PRICE" ||
				alert.alertType === "PORTFOLIO_VALUE"
			) {
				testData.mockValue = alert.thresholdValue
					? alert.thresholdValue * 1.1
					: 100;
			} else if (
				alert.alertType === "PERCENTAGE_CHANGE" ||
				alert.alertType === "ALLOCATION"
			) {
				testData.mockPercentage = alert.thresholdPercentage
					? alert.thresholdPercentage + 5
					: 10;
			}
		}

		await handleTest(testData);
	};

	const getAlertTypeIcon = (type: string) => {
		switch (type) {
			case "PRICE":
				return <DollarSign className="h-4 w-4" />;
			case "PERCENTAGE_CHANGE":
				return <Percent className="h-4 w-4" />;
			case "PORTFOLIO_VALUE":
				return <TrendingUp className="h-4 w-4" />;
			case "ALLOCATION":
				return <TrendingDown className="h-4 w-4" />;
			default:
				return <Bell className="h-4 w-4" />;
		}
	};

	const getAlertTypeLabel = (type: string) => {
		switch (type) {
			case "PRICE":
				return "Price Alert";
			case "PERCENTAGE_CHANGE":
				return "Percentage Change";
			case "PORTFOLIO_VALUE":
				return "Portfolio Value";
			case "ALLOCATION":
				return "Allocation Alert";
			default:
				return type;
		}
	};

	const formatThreshold = (alert: AlertType) => {
		if (alert.thresholdValue !== undefined) {
			return formatCurrency(alert.thresholdValue);
		}
		if (alert.thresholdPercentage !== undefined) {
			return formatPercentage(alert.thresholdPercentage / 100);
		}
		return "N/A";
	};

	const getTargetName = (alert: AlertType) => {
		if (alert.asset) {
			return alert.asset.symbol || alert.asset.name;
		}
		if (alert.portfolio) {
			return alert.portfolio.name;
		}
		return "Unknown";
	};

	if (alerts.length === 0) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<TestTube className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<h3 className="text-lg font-medium text-muted-foreground mb-2">
					No Active Alerts
				</h3>
				<p className="text-sm text-muted-foreground">
					Create some alerts first to test their functionality.
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Testing Instructions */}
			<Alert>
				<AlertTriangle className="h-4 w-4" />
				<AlertDescription>
					Use this testing interface to validate your alert configurations and
					notification delivery. Tests will simulate alert conditions without
					affecting your actual alerts.
				</AlertDescription>
			</Alert>

			{/* Manual Test Form */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TestTube className="h-5 w-5" />
						Manual Alert Testing
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit(handleTest)} className="space-y-4">
						<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="alertId">Select Alert *</Label>
								<Select
									value={watchedAlertId || ""}
									onValueChange={(value) => setValue("alertId", value)}
								>
									<SelectTrigger>
										<SelectValue placeholder="Choose an alert to test" />
									</SelectTrigger>
									<SelectContent>
										{alerts.map((alert) => (
											<SelectItem key={alert.id} value={alert.id}>
												<div className="flex items-center gap-2">
													{getAlertTypeIcon(alert.alertType)}
													<span>
														{alert.name ||
															`${getAlertTypeLabel(alert.alertType)} - ${getTargetName(alert)}`}
													</span>
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{errors.alertId && (
									<p className="text-sm text-destructive">
										{errors.alertId.message}
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="testType">Test Type *</Label>
								<Select
									value={watchedTestType}
									onValueChange={(value) => setValue("testType", value as any)}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="CONDITION">
											<div className="flex items-center gap-2">
												<TestTube className="h-4 w-4" />
												Condition Test
											</div>
										</SelectItem>
										<SelectItem value="NOTIFICATION">
											<div className="flex items-center gap-2">
												<Bell className="h-4 w-4" />
												Notification Test
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Alert Details */}
						{selectedAlert && (
							<div className="p-4 bg-muted/50 rounded-lg space-y-2">
								<div className="flex items-center gap-3">
									{getAlertTypeIcon(selectedAlert.alertType)}
									<Badge variant="outline">
										{getAlertTypeLabel(selectedAlert.alertType)}
									</Badge>
									<span className="font-medium">{selectedAlert.name}</span>
								</div>
								<div className="text-sm text-muted-foreground">
									Target: {getTargetName(selectedAlert)} | Threshold:{" "}
									{formatThreshold(selectedAlert)}
								</div>
								<div className="flex gap-2">
									{selectedAlert.notificationMethods.map((method) => (
										<Badge key={method} variant="outline" className="text-xs">
											{method}
										</Badge>
									))}
								</div>
							</div>
						)}

						{/* Mock Values for Condition Testing */}
						{watchedTestType === "CONDITION" && selectedAlert && (
							<div className="grid gap-4 grid-cols-1 md:grid-cols-2">
								{(selectedAlert.alertType === "PRICE" ||
									selectedAlert.alertType === "PORTFOLIO_VALUE") && (
									<div className="space-y-2">
										<Label htmlFor="mockValue">Mock Value</Label>
										<div className="relative">
											<DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												id="mockValue"
												type="number"
												step="0.01"
												min="0"
												placeholder={
													selectedAlert.thresholdValue?.toString() || "0.00"
												}
												className="pl-10"
												{...register("mockValue", { valueAsNumber: true })}
											/>
										</div>
										<p className="text-xs text-muted-foreground">
											Leave empty to use a value that would trigger the alert
										</p>
									</div>
								)}

								{(selectedAlert.alertType === "PERCENTAGE_CHANGE" ||
									selectedAlert.alertType === "ALLOCATION") && (
									<div className="space-y-2">
										<Label htmlFor="mockPercentage">Mock Percentage</Label>
										<div className="relative">
											<Percent className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
											<Input
												id="mockPercentage"
												type="number"
												step="0.1"
												min="0"
												max="100"
												placeholder={
													selectedAlert.thresholdPercentage?.toString() || "0.0"
												}
												className="pl-10"
												{...register("mockPercentage", { valueAsNumber: true })}
											/>
										</div>
										<p className="text-xs text-muted-foreground">
											Leave empty to use a percentage that would trigger the
											alert
										</p>
									</div>
								)}
							</div>
						)}

						<div className="flex justify-end">
							<Button
								type="submit"
								disabled={isSubmitting || isRunningTest === watchedAlertId}
								className="gap-2"
							>
								{isSubmitting || isRunningTest === watchedAlertId ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Running Test...
									</>
								) : (
									<>
										<Play className="h-4 w-4" />
										Run Test
									</>
								)}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			<Separator />

			{/* Quick Test Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Test Actions</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{alerts.map((alert) => (
							<div
								key={alert.id}
								className="flex items-center justify-between p-4 border rounded-lg"
							>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-3 mb-2">
										{getAlertTypeIcon(alert.alertType)}
										<Badge variant="outline">
											{getAlertTypeLabel(alert.alertType)}
										</Badge>
										<span className="font-medium truncate">{alert.name}</span>
									</div>
									<div className="text-sm text-muted-foreground">
										{getTargetName(alert)} | {formatThreshold(alert)}
									</div>
								</div>

								<div className="flex items-center gap-2 ml-4">
									<Button
										variant="outline"
										size="sm"
										onClick={() => runQuickTest(alert, "CONDITION")}
										disabled={isRunningTest === alert.id}
										className="gap-2"
									>
										{isRunningTest === alert.id ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											<TestTube className="h-3 w-3" />
										)}
										Test Condition
									</Button>

									<Button
										variant="outline"
										size="sm"
										onClick={() => runQuickTest(alert, "NOTIFICATION")}
										disabled={isRunningTest === alert.id}
										className="gap-2"
									>
										{isRunningTest === alert.id ? (
											<Loader2 className="h-3 w-3 animate-spin" />
										) : (
											<Bell className="h-3 w-3" />
										)}
										Test Notification
									</Button>
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Test Results */}
			{Object.keys(testResults).length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Test Results</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{Object.entries(testResults)
								.sort(
									([, a], [, b]) =>
										b.timestamp.getTime() - a.timestamp.getTime(),
								)
								.map(([alertId, result]) => {
									const alert = alerts.find((a) => a.id === alertId);
									if (!alert) return null;

									return (
										<div
											key={alertId}
											className="flex items-start gap-3 p-3 border rounded-lg"
										>
											<div className="mt-1">
												{result.success ? (
													<CheckCircle className="h-5 w-5 text-green-500" />
												) : (
													<XCircle className="h-5 w-5 text-red-500" />
												)}
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<span className="font-medium">{alert.name}</span>
													<Badge
														variant={result.success ? "default" : "destructive"}
													>
														{result.success ? "Passed" : "Failed"}
													</Badge>
												</div>

												<p className="text-sm text-muted-foreground mb-1">
													{result.message}
												</p>

												{result.details && (
													<p className="text-xs text-muted-foreground">
														{result.details}
													</p>
												)}

												<p className="text-xs text-muted-foreground mt-2">
													{result.timestamp.toLocaleString()}
												</p>
											</div>
										</div>
									);
								})}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
