import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppSidebar } from "@/components/app-sidebar";
import { PortfolioListPage } from "@/components/portfolio/portfolio-list-page";
import {
	PortfolioBreadcrumb,
	portfolioBreadcrumbs,
} from "@/components/portfolio/portfolio-breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

function PortfoliosPageWithSidebar() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
					<div className="flex items-center gap-2 px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<PortfolioBreadcrumb items={portfolioBreadcrumbs.portfolioList()} />
					</div>
				</header>
				<main className="flex-1">
					<PortfolioListPage />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

export const Route = createFileRoute("/portfolios")({
	component: () => (
		<ProtectedRoute>
			<PortfoliosPageWithSidebar />
		</ProtectedRoute>
	),
});
