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
	label: string;
	href?: string;
	icon?: React.ReactNode;
}

interface PortfolioBreadcrumbProps {
	items: BreadcrumbItem[];
}

export function PortfolioBreadcrumb({ items }: PortfolioBreadcrumbProps) {
	return (
		<Breadcrumb>
			<BreadcrumbList className="flex-wrap">
				{items.map((item, index) => (
					<div key={index} className="flex items-center">
						<BreadcrumbItem>
							{item.href ? (
								<BreadcrumbLink asChild>
									<Link
										to={item.href}
										className="flex items-center gap-1 touch-manipulation"
									>
										<span className="hidden sm:inline">{item.icon}</span>
										<span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
											{item.label}
										</span>
									</Link>
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage className="flex items-center gap-1">
									<span className="hidden sm:inline">{item.icon}</span>
									<span className="text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
										{item.label}
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
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

// Utility functions for common breadcrumb patterns
export const portfolioBreadcrumbs = {
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

	portfolioDetail: (portfolioName: string) => [
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
			label: portfolioName,
		},
	],

	portfolioEdit: (portfolioName: string) => [
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
			label: portfolioName,
			href: `/portfolios/${portfolioName}`, // This would need the actual ID
		},
		{
			label: "Edit",
		},
	],

	portfolioCreate: () => [
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
