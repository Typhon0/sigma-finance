import { Bell, Search } from "lucide-react";
import { DensityDashboard } from "@/components/dashboard/DensityGrid";
import { DashboardTransition } from "@/components/dashboard/dashboard-transitions";
import {
	DashboardErrorBoundary,
	DashboardErrorManagerProvider,
} from "@/components/dashboard/error-handling";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function DashboardHomePage() {
	const { user } = useAuth();

	if (!user) {
		return <div className="flex h-screen items-center justify-center">Loading...</div>;
	}

	return (
		<DashboardErrorManagerProvider>
			<div className="flex flex-1 flex-col h-full overflow-hidden">
				{/* Top Bar matching ProShell header design */}
				<header className="flex h-14 items-center gap-4 border-b bg-background/50 backdrop-blur-md px-6 z-30 justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="outline"
							size="sm"
							className="hidden w-64 justify-start text-muted-foreground md:flex bg-secondary/30 border-dashed hover:bg-secondary/50 h-9"
						>
							<Search className="mr-2 h-4 w-4" />
							<span className="text-xs">Search...</span>
							<kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
								<span className="text-xs">⌘</span>K
							</kbd>
						</Button>
					</div>

					<div className="flex items-center gap-3">
						<div className="hidden lg:flex items-center gap-6 mr-4 text-xs font-mono">
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground font-semibold">SPX</span>
								<span className="text-emerald-500 font-medium">+1.24%</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground font-semibold">BTC</span>
								<span className="text-rose-500 font-medium">-0.82%</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground font-semibold">VIX</span>
								<span className="text-emerald-500 font-medium">13.45</span>
							</div>
						</div>

						<div className="h-4 w-px bg-border hidden lg:block" />

						<Button
							variant="ghost"
							size="icon"
							className="text-muted-foreground hover:text-foreground"
						>
							<Bell size={18} />
						</Button>
					</div>
				</header>

				{/* Page Content */}
				<main className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/5 scrollbar-hide">
					<div className="mx-auto max-w-[1800px] space-y-6">
						<DashboardErrorBoundary context="overview" componentName="DashboardHomePage">
							<DashboardTransition viewMode="overview">
								<DensityDashboard />
							</DashboardTransition>
						</DashboardErrorBoundary>
					</div>
				</main>
			</div>
		</DashboardErrorManagerProvider>
	);
}
