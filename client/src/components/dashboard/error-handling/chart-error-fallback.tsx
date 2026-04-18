import {
	AlertTriangle,
	BarChart3,
	PieChart,
	RefreshCw,
	TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartErrorFallbackProps {
	error: Error;
	onRetry?: () => void;
	chartType?: "line" | "pie" | "bar" | "candlestick" | "area" | "generic";
	title?: string;
	height?: number;
	showFallbackData?: boolean;
	className?: string;
}

export function ChartErrorFallback({
	error,
	onRetry,
	chartType = "generic",
	title,
	height = 300,
	showFallbackData = false,
	className,
}: ChartErrorFallbackProps) {
	const getChartIcon = () => {
		switch (chartType) {
			case "line":
			case "area":
				return <TrendingUp className="h-8 w-8 text-muted-foreground" />;
			case "pie":
				return <PieChart className="h-8 w-8 text-muted-foreground" />;
			case "bar":
			case "candlestick":
				return <BarChart3 className="h-8 w-8 text-muted-foreground" />;
			default:
				return <BarChart3 className="h-8 w-8 text-muted-foreground" />;
		}
	};

	const getErrorMessage = () => {
		if (error.message.toLowerCase().includes("network")) {
			return "Unable to load chart data due to network issues.";
		}
		if (error.message.toLowerCase().includes("data")) {
			return "Chart data is temporarily unavailable.";
		}
		return "Chart could not be rendered.";
	};

	const getFallbackContent = () => {
		if (!showFallbackData) return null;

		switch (chartType) {
			case "line":
			case "area":
				return <LineChartFallback height={height - 100} />;
			case "pie":
				return <PieChartFallback />;
			case "bar":
				return <BarChartFallback height={height - 100} />;
			default:
				return <GenericChartFallback height={height - 100} />;
		}
	};

	return (
		<Card className={cn("border-orange-200", className)}>
			{title && (
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2">
						{getChartIcon()}
						{title}
					</CardTitle>
				</CardHeader>
			)}
			<CardContent
				className="flex flex-col items-center justify-center text-center"
				style={{ minHeight: height }}
			>
				{showFallbackData ? (
					<div className="w-full space-y-4">
						<div className="flex items-center justify-center gap-2 text-orange-600 mb-4">
							<AlertTriangle className="h-5 w-5" />
							<span className="text-sm font-medium">Using cached data</span>
						</div>
						{getFallbackContent()}
						<div className="text-xs text-muted-foreground">
							{getErrorMessage()} Showing last available data.
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex flex-col items-center gap-3">
							<AlertTriangle className="h-12 w-12 text-orange-500" />
							<div>
								<h3 className="font-semibold text-orange-700 mb-1">
									Chart Unavailable
								</h3>
								<p className="text-sm text-muted-foreground max-w-sm">
									{getErrorMessage()}
								</p>
							</div>
						</div>

						{onRetry && (
							<Button
								onClick={onRetry}
								variant="outline"
								size="sm"
								className="gap-2"
							>
								<RefreshCw className="h-4 w-4" />
								Retry
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// Fallback chart components for cached data display
function LineChartFallback({ height }: { height: number }) {
	return (
		<div className="w-full" style={{ height }}>
			<svg width="100%" height="100%" className="text-muted-foreground">
				<title>Chart</title>
				<defs>
					<pattern
						id="grid"
						width="20"
						height="20"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 20 0 L 0 0 0 20"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
							opacity="0.3"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid)" />
				<path
					d="M 10 80 Q 50 60 100 70 T 200 65 T 300 75 T 400 60"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					opacity="0.6"
					strokeDasharray="5,5"
				/>
				<circle cx="100" cy="70" r="3" fill="currentColor" opacity="0.6" />
				<circle cx="200" cy="65" r="3" fill="currentColor" opacity="0.6" />
				<circle cx="300" cy="75" r="3" fill="currentColor" opacity="0.6" />
			</svg>
		</div>
	);
}

function PieChartFallback() {
	return (
		<div className="flex items-center justify-center w-full h-48">
			<svg width="160" height="160" className="text-muted-foreground">
				<title>Chart</title>
				<circle
					cx="80"
					cy="80"
					r="60"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeDasharray="5,5"
					opacity="0.6"
				/>
				<path
					d="M 80 20 A 60 60 0 0 1 120 140 L 80 80 Z"
					fill="currentColor"
					opacity="0.3"
				/>
				<path
					d="M 120 140 A 60 60 0 0 1 40 140 L 80 80 Z"
					fill="currentColor"
					opacity="0.2"
				/>
				<path
					d="M 40 140 A 60 60 0 0 1 80 20 L 80 80 Z"
					fill="currentColor"
					opacity="0.1"
				/>
			</svg>
		</div>
	);
}

function BarChartFallback({ height }: { height: number }) {
	return (
		<div
			className="w-full flex items-end justify-center gap-2 px-4"
			style={{ height }}
		>
			{[60, 80, 45, 90, 70, 55, 85].map((barHeight, index) => (
				<div
					key={index}
					className="bg-muted-foreground opacity-40 rounded-t"
					style={{
						width: "12%",
						height: `${(barHeight / 100) * height}px`,
					}}
				/>
			))}
		</div>
	);
}

function GenericChartFallback({ height }: { height: number }) {
	return (
		<div className="w-full space-y-3" style={{ height }}>
			<Skeleton className="w-full h-8" />
			<Skeleton className="w-full h-12" />
			<Skeleton className="w-3/4 h-8" />
			<Skeleton className="w-full h-10" />
			<Skeleton className="w-5/6 h-6" />
		</div>
	);
}

export default ChartErrorFallback;
