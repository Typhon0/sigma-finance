import { Link } from "@tanstack/react-router";
import { ChevronRight, Folder, Home } from "lucide-react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbItem {
	label?: string;
	title?: string; // Support both label and title for compatibility
	href?: string;
	icon?: React.ReactNode;
	onClick?: () => void;
}

interface PortfolioBreadcrumbProps {
	items?: BreadcrumbItem[];
}

export function PortfolioBreadcrumb({ items }: PortfolioBreadcrumbProps) {
	// Handle undefined or empty items array
	if (!items || items.length === 0) {
		// Return a default breadcrumb if no items provided
		return (
			<Breadcrumb>
				<BreadcrumbList className="flex-wrap">
					<BreadcrumbItem>
						<BreadcrumbPage className="flex items-center gap-1">
							<Home className="h-4 w-4" />
							<span className="text-sm sm:text-base">Dashboard</span>
						</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
		);
	}

	return (
		<Breadcrumb>
			<BreadcrumbList className="flex-wrap">
				{items.map((item, index) => {
					const displayText = item.title || item.label || "";

					return (
						<div key={index} className="flex items-center">
							<BreadcrumbItem>
								{item.onClick ? (
									<BreadcrumbLink asChild>
										<button
											type="button"
											onClick={item.onClick}
											className="flex items-center gap-1 touch-manipulation hover:underline"
										>
											<span className="hidden sm:inline">{item.icon}</span>
											<span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
												{displayText}
											</span>
										</button>
									</BreadcrumbLink>
								) : item.href ? (
									<BreadcrumbLink asChild>
										<Link
											to={item.href}
											className="flex items-center gap-1 touch-manipulation"
										>
											<span className="hidden sm:inline">{item.icon}</span>
											<span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
												{displayText}
											</span>
										</Link>
									</BreadcrumbLink>
								) : (
									<BreadcrumbPage className="flex items-center gap-1">
										<span className="hidden sm:inline">{item.icon}</span>
										<span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
											{displayText}
										</span>
									</BreadcrumbPage>
								)}
							</BreadcrumbItem>
							{index < items.length - 1 && (
								<BreadcrumbSeparator>
									<ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
								</BreadcrumbSeparator>
							)}
						</div>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

// Utility functions for common breadcrumb patterns
export const portfolioBreadcrumbs = {
	dashboard: [
		{
			label: "Dashboard",
			icon: <Home className="h-4 w-4" />,
		},
	],

	portfolioAnalytics: [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: <Home className="h-4 w-4" />,
		},
		{
			label: "Analytics",
			icon: <Folder className="h-4 w-4" />,
		},
	],

	portfolioList: () => [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: <Home className="h-4 w-4" />,
		},
		{
			label: "Portfolios",
			icon: <Folder className="h-4 w-4" />,
		},
	],

	portfolioDetail: (portfolioName?: string) => [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: <Home className="h-4 w-4" />,
		},
		{
			label: "Portfolios",
			href: "/portfolios",
			icon: <Folder className="h-4 w-4" />,
		},
		{
			label: portfolioName || "Portfolio Details",
		},
	],

	portfolioEdit: (portfolioName?: string, portfolioId?: string) => [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: <Home className="h-4 w-4" />,
		},
		{
			label: "Portfolios",
			href: "/portfolios",
			icon: <Folder className="h-4 w-4" />,
		},
		{
			label: portfolioName || "Portfolio",
			href: portfolioId ? `/portfolios/${portfolioId}` : undefined,
		},
		{
			label: "Edit",
		},
	],

	portfolioCreate: [
		{
			label: "Dashboard",
			href: "/dashboard",
			icon: <Home className="h-4 w-4" />,
		},
		{
			label: "Portfolios",
			href: "/portfolios",
			icon: <Folder className="h-4 w-4" />,
		},
		{
			label: "Create Portfolio",
		},
	],
};
