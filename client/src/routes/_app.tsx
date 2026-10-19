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
	Menu,
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
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

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
// Keyboard users get the same expansion via :has(:focus-visible) — hover alone
// left the labels unreachable by Tab. No React re-renders on hover — content
// is always rendered, visibility is CSS-only.
const SIDEBAR_GROUP = "group/sb"; // Show text labels on hover/pinned/focus-visible
const SB_SHOW = `opacity-0 w-0 overflow-hidden group-hover/sb:opacity-100 group-hover/sb:w-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:w-auto group-has-[:focus-visible]/sb:opacity-100 group-has-[:focus-visible]/sb:w-auto`;
// Spacer between icon and label
const SB_LABEL_ML = `group-hover/sb:ml-2.5 group-data-[pinned]/sb:ml-2.5 group-has-[:focus-visible]/sb:ml-2.5`;
// Push count to the right
const SB_COUNT = `opacity-0 w-0 overflow-hidden ml-auto group-hover/sb:opacity-100 group-hover/sb:w-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:w-auto group-has-[:focus-visible]/sb:opacity-100 group-has-[:focus-visible]/sb:w-auto`;

// Mobile (<768px) quick destinations for the 60px bottom bar. Everything
// else lives in the full-nav bottom sheet behind the menu button — the
// five destinations cover daily use without scrolling.
const MOBILE_QUICK_ITEM_IDS = ["overview", "stocks", "crypto", "portfolios"] as const;

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
		// Absolute so an expanded rail floats over the content instead of
		// shrinking it: the width transition used to reflow the page (chart
		// included) on every hover.
		<aside
			className={`${SIDEBAR_GROUP} hidden md:flex absolute inset-y-0 left-0 flex-col w-[60px] hover:w-[240px] has-[:focus-visible]:w-[240px] data-[pinned]:w-[240px] border-r bg-card/50 backdrop-blur-xl z-40 transition-[width,box-shadow] duration-200 ease-out will-change-[width] hover:shadow-lg data-[pinned]:shadow-lg has-[:focus-visible]:shadow-lg`}
			data-pinned={isPinned ? "" : undefined}
		>
			{/* Header */}
			<div className="flex h-14 items-center border-b px-4 justify-center group-hover/sb:justify-between group-data-[pinned]/sb:justify-between group-has-[:focus-visible]/sb:justify-between">
				{/* Logo: always render both, toggle via CSS */}
				<div className="flex items-center overflow-hidden">
					<span className="font-bold text-xl tracking-tighter group-hover/sb:hidden group-data-[pinned]/sb:hidden group-has-[:focus-visible]/sb:hidden">
						SF
					</span>
					<div className="hidden group-hover/sb:block group-data-[pinned]/sb:block group-has-[:focus-visible]/sb:block">
						<Logo size="sm" showText={true} />
					</div>
				</div>
				<div className="hidden group-hover/sb:block group-data-[pinned]/sb:block group-has-[:focus-visible]/sb:block">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground"
						onClick={() => setIsCollapsed(!isCollapsed)}
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						aria-expanded={!isCollapsed}
					>
						{isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
					</Button>
				</div>
			</div>

			{/* Portfolio Switcher — hidden when collapsed, shown on hover/pinned */}
			<div className="border-b hidden group-hover/sb:block group-hover/sb:py-2 group-data-[pinned]/sb:block group-data-[pinned]/sb:py-2 group-has-[:focus-visible]/sb:block group-has-[:focus-visible]/sb:py-2">
				<PortfolioSwitcher isCollapsed={false} onInteractingChange={setIsInteracting} />
			</div>

			{/* Nav */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
				<nav className="space-y-6 px-2">
					{NAV_ITEMS.map((group) => (
						<div key={group.group}>
							<h4 className="mb-2 px-2 text-micro font-bold uppercase tracking-widest text-muted-foreground opacity-0 h-0 overflow-hidden group-hover/sb:opacity-100 group-hover/sb:h-auto group-data-[pinned]/sb:opacity-100 group-data-[pinned]/sb:h-auto group-has-[:focus-visible]/sb:opacity-100 group-has-[:focus-visible]/sb:h-auto">
								{group.group}
							</h4>
							<div className="space-y-0.5">
								{group.items.map((item) => (
									<Button
										key={item.id}
										variant={activeItem === item.id ? "secondary" : "ghost"}
										className={`w-full h-9 px-0 justify-center touch-target group-hover/sb:justify-start group-hover/sb:px-2.5 group-data-[pinned]/sb:justify-start group-data-[pinned]/sb:px-2.5 group-has-[:focus-visible]/sb:justify-start group-has-[:focus-visible]/sb:px-2.5 transition-[background-color,color,box-shadow] duration-150 ease-out ${activeItem === item.id ? "bg-secondary/80 font-medium text-foreground shadow-sm ring-1 ring-border" : ""}`}
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
							className="w-full h-12 px-0 justify-center group-hover/sb:justify-start group-hover/sb:px-2.5 group-data-[pinned]/sb:justify-start group-data-[pinned]/sb:px-2.5 group-has-[:focus-visible]/sb:justify-start group-has-[:focus-visible]/sb:px-2.5"
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
								<span className="text-muted-foreground text-micro leading-tight">
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
						<DropdownMenuItem
							onClick={logout}
							className="text-destructive focus:text-destructive focus:bg-destructive/10"
						>
							<LogOut className="mr-2 h-4 w-4" /> Logout
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
}

function AppSidebarMobile() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	const [open, setOpen] = useState(false);

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

	const navigateItem = (item: NavItem) => {
		navigate({ to: item.url, search: item.search });
		setOpen(false);
	};

	return (
		<>
			{/* 60px bottom bar: the rail's touch equivalent below md. All targets
			    are ≥44px (touch-target); safe-area inset keeps it clear of the
			    home indicator. Desktop keeps the hover rail from AppSidebar. */}
			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] items-stretch justify-around border-t border-border bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
			>
				{NAV_ITEMS.flatMap((group) => group.items)
					.filter((item) => (MOBILE_QUICK_ITEM_IDS as readonly string[]).includes(item.id))
					.map((item) => (
						<Button
							key={item.id}
							variant="ghost"
							size="icon"
							aria-current={activeItem === item.id ? "page" : undefined}
							className={cn(
								"touch-target h-10 w-10 self-center rounded-lg",
								activeItem === item.id
									? "bg-secondary/80 text-primary shadow-sm"
									: "text-muted-foreground",
							)}
							onClick={() => navigateItem(item)}
						>
							<item.icon className="h-5 w-5" strokeWidth={1.75} />
							<span className="sr-only">{item.label}</span>
						</Button>
					))}
				<Button
					variant="ghost"
					size="icon"
					className="touch-target h-10 w-10 self-center rounded-lg text-muted-foreground"
					onClick={() => setOpen(true)}
					aria-expanded={open}
				>
					<Menu className="h-5 w-5" strokeWidth={1.75} />
					<span className="sr-only">All sections</span>
				</Button>
			</nav>

			{/* Full navigation as a bottom sheet (true mobile pattern): portfolio
			    switcher, every nav group, and the account actions. */}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent
					side="bottom"
					showCloseButton={false}
					className="flex max-h-[85dvh] flex-col rounded-t-2xl p-0"
				>
					{/* Grip + identity row */}
					<div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
						<span className="text-muted-foreground select-none" aria-hidden="true">
							ΞF
						</span>
						<Logo size="sm" showText={true} />
					</div>

					{/* Portfolio switcher */}
					<div className="shrink-0 border-b border-border px-2 py-2">
						<PortfolioSwitcher isCollapsed={false} />
					</div>

					<div className="flex-1 overflow-y-auto px-2 py-2">
						{NAV_ITEMS.map((group) => (
							<div key={group.group} className="py-3">
								<h2 className="mb-2 px-2 text-micro font-bold uppercase tracking-widest text-muted-foreground">
									{group.group}
								</h2>
								<div className="space-y-0.5">
									{group.items.map((item) => (
										<Button
											key={item.id}
											variant={activeItem === item.id ? "secondary" : "ghost"}
											className={cn(
												"h-11 w-full justify-start px-2.5 touch-target",
												activeItem === item.id
													? "bg-secondary/80 font-medium text-foreground shadow-sm ring-1 ring-border"
													: "",
											)}
											onClick={() => navigateItem(item)}
										>
											<item.icon
												className={cn(
													"h-4 w-4 shrink-0",
													activeItem === item.id ? "text-primary" : "text-muted-foreground",
												)}
												strokeWidth={1.75}
											/>
											<span className="ml-2.5 truncate text-sm">{item.label}</span>
											{item.count && (
												<span className="ml-auto text-xs text-muted-foreground">{item.count}</span>
											)}
										</Button>
									))}
								</div>
							</div>
						))}
					</div>

					{/* Account row */}
					<div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-3">
						<Avatar className="h-8 w-8 rounded-lg border border-border">
							<AvatarFallback className="bg-primary/5 text-xs font-medium">
								{user?.name?.[0] || "U"}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 truncate">
							<p className="truncate text-sm font-semibold text-foreground leading-tight">
								{user?.name}
							</p>
							<p className="truncate text-micro text-muted-foreground leading-tight">
								{user?.email}
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="touch-target h-10 w-10 text-destructive"
							onClick={logout}
						>
							<LogOut className="h-4 w-4" />
							<span className="sr-only">Log out</span>
						</Button>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
}

function AppLayout() {
	return (
		<div className="relative flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
			<AppSidebar />
			<AppSidebarMobile />
			{/* The rail is absolute; the content column keeps its 60px column on
			    desktop. Mobile drops the rail and reserves room for the 60px
			    bottom bar + safe area. */}
			<main className="ml-0 md:ml-[60px] flex-1 overflow-auto p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});
