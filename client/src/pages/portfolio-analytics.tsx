import { useNavigate } from "@tanstack/react-router";
import {
	Activity,
	ArrowLeft,
	BarChart3,
	PieChart,
	TrendingUp,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export default function PortfolioAnalyticsPage() {
	const _navigate = useNavigate();

	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb
							items={portfolioBreadcrumbs.portfolioAnalytics}
						/>
					</div>
				</header>
				<PortfolioAnalyticsContent />
			</SidebarInset>
		</SidebarProvider>
	);
}

function PortfolioAnalyticsContent() {
	const navigate = useNavigate();

	const handleBack = () => {
		navigate({ to: "/portfolios" });
	};

	return (
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			{/* Header Section */}
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBack}
					className="gap-2"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Portfolios
				</Button>
			</div>

			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Portfolio Analytics
					</h1>
					<p className="text-muted-foreground">
						Comprehensive analysis and insights across all your portfolios
					</p>
				</div>

				{/* Analytics Overview Cards */}
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Portfolio Value
							</CardTitle>
							<BarChart3 className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">$124,500</div>
							<p className="text-xs text-muted-foreground">
								+12.5% from last month
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Return
							</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">+$24,500</div>
							<p className="text-xs text-muted-foreground">
								+24.5% overall return
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Asset Allocation
							</CardTitle>
							<PieChart className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">5 Types</div>
							<p className="text-xs text-muted-foreground">
								Across 3 portfolios
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Risk Score</CardTitle>
							<Activity className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">7.2</div>
							<p className="text-xs text-muted-foreground">
								Moderate risk level
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Placeholder for Analytics Components */}
				<div className="grid gap-6 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Performance Over Time</CardTitle>
							<CardDescription>
								Portfolio value and performance trends
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
								<p className="text-muted-foreground">
									Performance chart will be implemented
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Asset Allocation</CardTitle>
							<CardDescription>
								Distribution of assets across categories
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
								<p className="text-muted-foreground">
									Allocation chart will be implemented
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Top Performers</CardTitle>
							<CardDescription>
								Best performing assets in your portfolios
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
								<p className="text-muted-foreground">
									Top performers list will be implemented
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Risk Analysis</CardTitle>
							<CardDescription>
								Portfolio risk metrics and recommendations
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
								<p className="text-muted-foreground">
									Risk analysis will be implemented
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
