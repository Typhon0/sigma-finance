import { Link } from "@tanstack/react-router";
import { Slash } from "lucide-react";
import React from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface BreadcrumbItemProps {
	label: string;
	href?: string;
	isActive?: boolean;
}

interface PortfolioBreadcrumbProps {
	items: BreadcrumbItemProps[];
}

export function PortfolioBreadcrumb({ items }: PortfolioBreadcrumbProps) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{items.map((item, index) => (
					<React.Fragment key={item.href || index}>
						<BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
							{item.isActive ? (
								<BreadcrumbPage>{item.label}</BreadcrumbPage>
							) : (
								<BreadcrumbLink asChild>
									<Link to={item.href}>{item.label}</Link>
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
						{index < items.length - 1 && (
							<BreadcrumbSeparator>
								<Slash />
							</BreadcrumbSeparator>
						)}
					</React.Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}

// Predefined breadcrumb configurations for common portfolio pages
export const portfolioBreadcrumbs = {
	dashboard: [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Dashboard", isActive: true },
	],

	portfolios: [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Portfolios", isActive: true },
	],

	portfolioDetail: (portfolioName: string) => [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Portfolios", href: "/portfolios" },
		{ label: portfolioName, isActive: true },
	],

	portfolioEdit: (portfolioName: string) => [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Portfolios", href: "/portfolios" },
		{
			label: portfolioName,
			href: `/portfolios/${portfolioName.toLowerCase().replace(/\s+/g, "-")}`,
		},
		{ label: "Edit", isActive: true },
	],

	portfolioCreate: [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Portfolios", href: "/portfolios" },
		{ label: "Create Portfolio", isActive: true },
	],

	portfolioAnalytics: [
		{ label: "Portfolio Tracker", href: "/dashboard" },
		{ label: "Portfolios", href: "/portfolios" },
		{ label: "Analytics", isActive: true },
	],
};
