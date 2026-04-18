"use client";

import {
	Activity,
	ArrowUpDown,
	BarChart3,
	Bitcoin,
	Calendar,
	CreditCard,
	Eye,
	Gem,
	Globe,
	Home,
	Layers,
	LayoutDashboard,
	LineChart,
	PiggyBank,
	Settings,
	Shield,
	Wallet,
} from "lucide-react";
import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { Logo } from "./Logo";

const data = {
	navMain: [
		{
			title: "Overview",
			url: "/dashboard",
			icon: LayoutDashboard,
			isActive: true,
			items: [
				{
					title: "Command Center",
					url: "/dashboard?view=overview",
					icon: LayoutDashboard,
				},
				{
					title: "Analytics & Reports",
					url: "/dashboard?view=analytics",
					icon: BarChart3,
				},
				{
					title: "Ledger",
					url: "/dashboard?view=transactions",
					icon: ArrowUpDown,
				},
			],
		},
		{
			title: "Markets",
			url: "/dashboard?view=stock-market-overview",
			icon: Globe,
			items: [
				{
					title: "Stock Market",
					url: "/dashboard?view=stock-market-overview",
					icon: Globe,
				},
				{
					title: "Crypto Market",
					url: "/dashboard?view=crypto-market-overview",
					icon: Activity,
				},
				{
					title: "Heatmaps",
					url: "/dashboard?view=market-heatmaps",
					icon: Layers,
				},
				{
					title: "Calendar",
					url: "/dashboard?view=market-calendar",
					icon: Calendar,
				},
			],
		},
		{
			title: "Assets",
			url: "/dashboard?view=legacy-overview",
			icon: Layers,
			items: [
				{
					title: "All Assets",
					url: "/dashboard?view=legacy-overview",
					icon: Layers,
				},
				{
					title: "Stocks & Funds",
					url: "/assets/stocks",
					icon: LineChart,
				},
				{
					title: "Crypto",
					url: "/assets/crypto",
					icon: Bitcoin,
				},
				{
					title: "Real Estate",
					url: "/assets/real-estate",
					icon: Home,
				},
				{
					title: "Accounts",
					url: "/assets/accounts",
					icon: Wallet,
				},
				{
					title: "Savings",
					url: "/assets/savings",
					icon: PiggyBank,
				},
				{
					title: "Loans",
					url: "/assets/loans",
					icon: CreditCard,
				},
				{
					title: "Insurance",
					url: "/assets/insurance",
					icon: Shield,
				},
				{
					title: "Collectibles",
					url: "/assets/collectibles",
					icon: Gem,
				},
			],
		},
		{
			title: "Tools",
			url: "/dashboard?view=watchlist",
			icon: Settings,
			items: [
				{
					title: "Watchlist",
					url: "/dashboard?view=watchlist",
					icon: Eye,
				},
				{
					title: "Market Data Settings",
					url: "/settings/market-data",
					icon: Settings,
				},
			],
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar
			collapsible="icon"
			{...props}
			className="border-r bg-card/50 backdrop-blur-xl transition-all duration-300 ease-in-out z-40"
		>
			<SidebarHeader className="flex h-14 items-center group-data-[collapsible=icon]:justify-center justify-between border-b px-4">
				<div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:hidden">
					<Logo size="sm" showText={true} />
				</div>
				<div className="hidden group-data-[collapsible=icon]:flex items-center justify-center font-bold text-xl tracking-tighter">
					SF
				</div>
			</SidebarHeader>
			<SidebarContent className="scrollbar-hide py-4">
				<NavMain items={data.navMain} />
			</SidebarContent>
			<SidebarFooter className="border-t">
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
