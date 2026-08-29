import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
	Activity,
	ArrowUpDown,
	BarChart3,
	Bitcoin,
	Calendar,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Eye,
	Gem,
	Globe,
	Home,
	Layers,
	LayoutDashboard,
	LineChart,
	LogOut,
	PiggyBank,
	Plus,
	Settings,
	Shield,
	Wallet,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { PortfolioSwitcher } from "@/components/layout/PortfolioSwitcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

type NavItem = {
	id: string;
	label: string;
	url: string;
	search?: Record<string, string | undefined>;
	icon: React.ElementType;
	count?: number;
};

const NAV_ITEMS: { group: string; items: NavItem[] }[] = [
	{
		group: "Overview",
		items: [
			{
				id: "overview",
				label: "Command Center",
				url: "/dashboard/overview",
				icon: LayoutDashboard,
			},
			{
				id: "analytics",
				label: "Analytics & Reports",
				url: "/dashboard/analytics",
				icon: BarChart3,
			},
			{
				id: "transactions",
				label: "Ledger",
				url: "/dashboard/transactions",
				icon: ArrowUpDown,
			},
		],
	},
	{
		group: "Markets",
		items: [
			{
				id: "stock-market",
				label: "Stock Market",
				url: "/dashboard/stock-market-overview",
				icon: Globe,
			},
			{
				id: "crypto-market",
				label: "Crypto Market",
				url: "/dashboard/crypto-market-overview",
				icon: Activity,
			},
			{
				id: "heatmaps",
				label: "Heatmaps",
				url: "/dashboard/market-heatmaps",
				icon: Layers,
			},
			{
				id: "calendar",
				label: "Calendar",
				url: "/dashboard/market-calendar",
				icon: Calendar,
			},
		],
	},
	{
		group: "Assets",
		items: [
			{
				id: "all-assets",
				label: "All Assets",
				url: "/dashboard",
				search: { view: "legacy-overview" },
				icon: Layers,
				count: 30,
			},
			{
				id: "stocks",
				label: "Stocks & Funds",
				url: "/assets/stocks",
				icon: LineChart,
				count: 5,
			},
			{
				id: "crypto",
				label: "Crypto",
				url: "/assets/crypto",
				icon: Bitcoin,
				count: 3,
			},
			{
				id: "real-estate",
				label: "Real Estate",
				url: "/assets/real-estate",
				icon: Home,
				count: 2,
			},
			{
				id: "accounts",
				label: "Accounts",
				url: "/assets/accounts",
				icon: Wallet,
				count: 4,
			},
			{
				id: "savings",
				label: "Savings",
				url: "/assets/savings",
				icon: PiggyBank,
				count: 5,
			},
			{
				id: "loans",
				label: "Loans",
				url: "/assets/loans",
				icon: CreditCard,
				count: 2,
			},
			{
				id: "insurance",
				label: "Insurance",
				url: "/assets/insurance",
				icon: Shield,
				count: 1,
			},
			{
				id: "collectibles",
				label: "Collectibles",
				url: "/assets/collectibles",
				icon: Gem,
				count: 13,
			},
		],
	},
	{
		group: "Tools",
		items: [
			{
				id: "watchlist",
				label: "Watchlist",
				url: "/dashboard/watchlist",
				icon: Eye,
			},
			{
				id: "settings",
				label: "Settings",
				url: "/settings",
				icon: Settings,
			},
		],
	},
	{
		group: "Portfolios",
		items: [
			{
				id: "portfolios",
				label: "All Assets",
				url: "/portfolios",
				icon: Layers,
			},
			{
				id: "portfolio-create",
				label: "Create Portfolio",
				url: "/portfolios/create",
				icon: Plus,
			},
		],
	},
];

// Sidebar group: use CSS :hover for expand, data-pinned for click-toggle.
// No React re-renders on hover — content is always rendered, visibility is CSS-only.
const SIDEBAR_GROUP = "group/sb";
// Show text labels on hover/pinned
const SB_SHOW = `opacity-0 w-0 overflow-hidden group-hover/sb:opacity-100 group-hover/sb:w-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:w-auto`;
// Spacer between icon and label
const SB_LABEL_ML = `group-hover/sb:ml-2.5 group-data-[pinned]/sb:ml-2.5`;
// Push count to the right
const SB_COUNT = `opacity-0 w-0 overflow-hidden ml-auto group-hover/sb:opacity-100 group-hover/sb:w-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:w-auto`;

function AppSidebar() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	// isCollapsed: click toggle. isInteracting: PortfolioSwitcher dropdown open.
	// Hover expand is handled purely by CSS :hover on <aside> — no state change.
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isInteracting, setIsInteracting] = useState(false);
	const isPinned = !isCollapsed || isInteracting;

	const currentPath = window.location.pathname;
	const currentSearch = window.location.search;

	const getActiveItem = () => {
		const fullPath = `${currentPath}${currentSearch}`;
		for (const group of NAV_ITEMS) {
			for (const item of group.items) {
				if (item.url === fullPath || fullPath.startsWith(item.url.split("?")[0])) {
					return item.id;
				}
			}
		}
		return "overview";
	};

	const activeItem = getActiveItem();

	return (
		<aside
			className={`${SIDEBAR_GROUP} relative flex flex-col w-[60px] hover:w-[240px] data-[pinned]:w-[240px] border-r bg-card/50 backdrop-blur-xl z-40 transition-[width] duration-200 ease-out will-change-[width]`}
			data-pinned={isPinned ? "" : undefined}
		>
			{/* Header */}
			<div className="flex h-14 items-center border-b px-4 justify-center group-hover/sb:justify-between group-data-[pinned]/sb:justify-between">
				{/* Logo: always render both, toggle via CSS */}
				<div className="flex items-center overflow-hidden">
					<span className="font-bold text-xl tracking-tighter group-hover/sb:hidden group-data-[pinned]/sb:hidden">
						SF
					</span>
					<div className="hidden group-hover/sb:block group-data-[pinned]/sb:block">
						<Logo size="sm" showText={true} />
					</div>
				</div>
				<div className="hidden group-hover/sb:block group-data-[pinned]/sb:block">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground"
						onClick={() => setIsCollapsed(!isCollapsed)}
					>
						{isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
					</Button>
				</div>
			</div>

			{/* Portfolio Switcher — hidden when collapsed, shown on hover/pinned */}
			<div className="border-b hidden group-hover/sb:block group-hover/sb:py-2 group-data-[pinned]/sb:block group-data-[pinned]/sb:py-2">
				<PortfolioSwitcher isCollapsed={false} onInteractingChange={setIsInteracting} />
			</div>

			{/* Nav */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
				<nav className="space-y-6 px-2">
					{NAV_ITEMS.map((group) => (
						<div key={group.group}>
							<h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 opacity-0 h-0 overflow-hidden group-hover/sb:opacity-100 group-hover/sb:h-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:h-auto">
								{group.group}
							</h4>
							<div className="space-y-0.5">
								{group.items.map((item) => (
									<Button
										key={item.id}
										variant={activeItem === item.id ? "secondary" : "ghost"}
										className={`w-full h-9 px-0 justify-center group-hover/sb:justify-start group-hover/sb:px-2.5 group-data-[pinned]/sb:justify-start group-data-[pinned]/sb:px-2.5 transition-[background-color,color,box-shadow] duration-150 ease-out ${activeItem === item.id ? "bg-secondary/80 font-medium text-foreground shadow-sm ring-1 ring-border" : ""}`}
										onClick={() => navigate({ to: item.url, search: item.search })}
									>
										<item.icon
											className={`h-4 w-4 shrink-0 transition-colors duration-150 ease-out ${activeItem === item.id ? "text-primary" : "text-muted-foreground"}`}
											strokeWidth={1.75}
										/>
										<span
											className={`truncate text-sm ${SB_SHOW} ${SB_LABEL_ML} transition-opacity duration-150`}
										>
											{item.label}
										</span>
										{item.count && (
											<span
												className={`text-xs text-muted-foreground ${SB_COUNT} transition-opacity duration-150`}
											>
												{item.count}
											</span>
										)}
									</Button>
								))}
							</div>
						</div>
					))}
				</nav>
			</div>

			{/* User footer */}
			<div className="border-t p-1.5">
				<DropdownMenu>
					{" "}
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className="w-full h-12 px-0 justify-center group-hover/sb:justify-start group-hover/sb:px-2.5 group-data-[pinned]/sb:justify-start group-data-[pinned]/sb:px-2.5"
						>
							<Avatar className="h-8 w-8 rounded-lg border border-border">
								<AvatarFallback className="bg-primary/5 text-xs font-medium">
									{user?.name?.[0] || "U"}
								</AvatarFallback>
							</Avatar>
							<div
								className={`flex flex-col items-start truncate text-xs ${SB_SHOW} ${SB_LABEL_ML} transition-opacity duration-150`}
							>
								<span className="font-semibold text-foreground leading-tight">{user?.name}</span>
								<span className="text-muted-foreground text-[10px] leading-tight">
									{user?.email}
								</span>
							</div>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-56" sideOffset={8}>
						<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
							My Account
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() =>
								navigate({
									to: "/settings/account",
									search: { portfolioId: undefined, view: undefined },
								})
							}
						>
							<Settings className="mr-2 h-4 w-4" /> Settings
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500">
							<LogOut className="mr-2 h-4 w-4" /> Logout
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
}

function AppLayout() {
	return (
		<div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
			<AppSidebar />
			<main className="flex-1 overflow-auto p-6">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});
