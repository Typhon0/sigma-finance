import {
	AlertCircle,
	Bell,
	Check,
	CheckCircle,
	Clock,
	DollarSign,
	Percent,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import type { AlertNotificationData } from "./types";

interface AlertNotificationsProps {
	notifications: AlertNotificationData[];
	onAcknowledge?: (id: string) => Promise<void>;
	className?: string;
}

export function AlertNotifications({
	notifications,
	onAcknowledge,
	className,
}: AlertNotificationsProps) {
	const [acknowledgingIds, setAcknowledgingIds] = useState<Set<string>>(new Set());

	const handleAcknowledge = async (id: string) => {
		if (onAcknowledge) {
			setAcknowledgingIds((prev) => new Set(prev).add(id));
			try {
				await onAcknowledge(id);
			} finally {
				setAcknowledgingIds((prev) => {
					const newSet = new Set(prev);
					newSet.delete(id);
					return newSet;
				});
			}
		}
	};

	const handleAcknowledgeAll = async () => {
		const unacknowledged = notifications.filter((n) => !n.acknowledged);
		if (onAcknowledge && unacknowledged.length > 0) {
			for (const notification of unacknowledged) {
				await handleAcknowledge(notification.id);
			}
		}
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

	const getPriorityColor = (type: string) => {
		switch (type) {
			case "PRICE":
				return "text-blue-600 bg-blue-50 border-blue-200";
			case "PERCENTAGE_CHANGE":
				return "text-orange-600 bg-orange-50 border-orange-200";
			case "PORTFOLIO_VALUE":
				return "text-green-600 bg-green-50 border-green-200";
			case "ALLOCATION":
				return "text-purple-600 bg-purple-50 border-purple-200";
			default:
				return "text-gray-600 bg-gray-50 border-gray-200";
		}
	};

	const formatTimeAgo = (date: Date) => {
		const now = new Date();
		const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

		if (diffInMinutes < 1) return "Just now";
		if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) return `${diffInHours}h ago`;

		const diffInDays = Math.floor(diffInHours / 24);
		if (diffInDays < 7) return `${diffInDays}d ago`;

		return date.toLocaleDateString();
	};

	const formatValue = (value: number | undefined, type: string) => {
		if (value === undefined) return "N/A";

		if (type === "PERCENTAGE_CHANGE" || type === "ALLOCATION") {
			return formatPercentage(value / 100);
		}

		return formatCurrency(value);
	};

	const unacknowledgedNotifications = notifications.filter((n) => !n.acknowledged);
	const acknowledgedNotifications = notifications.filter((n) => n.acknowledged);

	if (notifications.length === 0) {
		return (
			<div className={`text-center py-8 ${className}`}>
				<Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
				<h3 className="text-lg font-medium text-muted-foreground mb-2">No Notifications</h3>
				<p className="text-sm text-muted-foreground">
					You'll see alert notifications here when they're triggered.
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-6 ${className}`}>
			{/* Header with Actions */}
			{unacknowledgedNotifications.length > 0 && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-orange-500" />
						<span className="font-medium">
							{unacknowledgedNotifications.length} unacknowledged notification
							{unacknowledgedNotifications.length !== 1 ? "s" : ""}
						</span>
					</div>

					{onAcknowledge && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="outline" size="sm">
									<CheckCircle className="h-4 w-4 mr-2" />
									Acknowledge All
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Acknowledge All Notifications</AlertDialogTitle>
									<AlertDialogDescription>
										This will mark all {unacknowledgedNotifications.length} unacknowledged
										notifications as read.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={handleAcknowledgeAll}>
										Acknowledge All
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			)}

			{/* Unacknowledged Notifications */}
			{unacknowledgedNotifications.length > 0 && (
				<div className="space-y-3">
					<h3 className="text-lg font-medium flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-orange-500" />
						New Notifications
					</h3>

					{unacknowledgedNotifications.map((notification) => (
						<Card
							key={notification.id}
							className={`border-l-4 ${getPriorityColor(notification.alertType)}`}
						>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-2">
											{getAlertTypeIcon(notification.alertType)}
											<Badge variant="outline">{getAlertTypeLabel(notification.alertType)}</Badge>
											<div className="flex items-center gap-1 text-sm text-muted-foreground">
												<Clock className="h-3 w-3" />
												{formatTimeAgo(notification.triggeredAt)}
											</div>
										</div>

										<div className="space-y-2">
											<p className="font-medium">{notification.message}</p>

											<div className="flex items-center gap-4 text-sm text-muted-foreground">
												{notification.assetName && <span>Asset: {notification.assetName}</span>}
												{notification.portfolioName && (
													<span>Portfolio: {notification.portfolioName}</span>
												)}
											</div>

											{(notification.currentValue !== undefined ||
												notification.thresholdValue !== undefined) && (
												<div className="flex items-center gap-4 text-sm">
													{notification.currentValue !== undefined && (
														<span>
															Current:{" "}
															<span className="font-medium">
																{formatValue(notification.currentValue, notification.alertType)}
															</span>
														</span>
													)}
													{notification.thresholdValue !== undefined && (
														<span>
															Threshold:{" "}
															<span className="font-medium">
																{formatValue(notification.thresholdValue, notification.alertType)}
															</span>
														</span>
													)}
												</div>
											)}
										</div>
									</div>

									{onAcknowledge && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleAcknowledge(notification.id)}
											disabled={acknowledgingIds.has(notification.id)}
											className="ml-4"
										>
											{acknowledgingIds.has(notification.id) ? (
												<>
													<Clock className="h-4 w-4 mr-2 animate-spin" />
													Acknowledging...
												</>
											) : (
												<>
													<Check className="h-4 w-4 mr-2" />
													Acknowledge
												</>
											)}
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Separator */}
			{unacknowledgedNotifications.length > 0 && acknowledgedNotifications.length > 0 && (
				<Separator />
			)}

			{/* Acknowledged Notifications */}
			{acknowledgedNotifications.length > 0 && (
				<div className="space-y-3">
					<h3 className="text-lg font-medium flex items-center gap-2">
						<CheckCircle className="h-5 w-5 text-green-500" />
						Acknowledged Notifications
					</h3>

					{acknowledgedNotifications.map((notification) => (
						<Card key={notification.id} className="opacity-60">
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-3 mb-2">
											{getAlertTypeIcon(notification.alertType)}
											<Badge variant="outline">{getAlertTypeLabel(notification.alertType)}</Badge>
											<div className="flex items-center gap-1 text-sm text-muted-foreground">
												<Clock className="h-3 w-3" />
												{formatTimeAgo(notification.triggeredAt)}
											</div>
											<Badge variant="secondary" className="text-green-600">
												<CheckCircle className="h-3 w-3 mr-1" />
												Acknowledged
											</Badge>
										</div>

										<div className="space-y-2">
											<p className="font-medium">{notification.message}</p>

											<div className="flex items-center gap-4 text-sm text-muted-foreground">
												{notification.assetName && <span>Asset: {notification.assetName}</span>}
												{notification.portfolioName && (
													<span>Portfolio: {notification.portfolioName}</span>
												)}
											</div>

											{(notification.currentValue !== undefined ||
												notification.thresholdValue !== undefined) && (
												<div className="flex items-center gap-4 text-sm">
													{notification.currentValue !== undefined && (
														<span>
															Current:{" "}
															<span className="font-medium">
																{formatValue(notification.currentValue, notification.alertType)}
															</span>
														</span>
													)}
													{notification.thresholdValue !== undefined && (
														<span>
															Threshold:{" "}
															<span className="font-medium">
																{formatValue(notification.thresholdValue, notification.alertType)}
															</span>
														</span>
													)}
												</div>
											)}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
