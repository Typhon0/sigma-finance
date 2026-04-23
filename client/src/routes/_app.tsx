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
	icon: any;
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

function AppSidebar() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	const [isCollapsed, setIsCollapsed] = useState(true);
	const [isHovered, setIsHovered] = useState(false);
	const [isInteracting, setIsInteracting] = useState(false);
	const isExpanded = !isCollapsed || isHovered || isInteracting;

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
			className="relative flex flex-col border-r bg-card/50 backdrop-blur-xl transition-all duration-300 ease-in-out z-40"
			style={{ width: isExpanded ? 240 : 60 }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div
				className="flex h-14 items-center border-b px-4 transition-all"
				style={{ justifyContent: isExpanded ? "space-between" : "center" }}
			>
				{isExpanded && <Logo size="sm" showText={true} />}
				{!isExpanded && <span className="font-bold text-xl tracking-tighter">SF</span>}
				{isExpanded && (
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 text-muted-foreground"
						onClick={() => setIsCollapsed(!isCollapsed)}
					>
						{isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
					</Button>
				)}
			</div>

			{isExpanded && (
				<div className="border-b py-2">
					<PortfolioSwitcher isCollapsed={false} onInteractingChange={setIsInteracting} />
				</div>
			)}

			<div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
				<nav className="space-y-6 px-2">
					{NAV_ITEMS.map((group) => (
						<div key={group.group}>
							{isExpanded && (
								<h4 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
									{group.group}
								</h4>
							)}
							<div className="space-y-0.5">
								{group.items.map((item) => (
									<Button
										key={item.id}
										variant={activeItem === item.id ? "secondary" : "ghost"}
										className={`w-full justify-start transition-all duration-200 h-9 ${!isExpanded ? "px-0 justify-center" : "px-3"} ${activeItem === item.id ? "bg-secondary/80 font-medium text-foreground shadow-sm ring-1 ring-border" : ""}`}
										onClick={() => navigate({ to: item.url, search: item.search })}
										title={!isExpanded ? item.label : undefined}
									>
										<item.icon
											className={`h-4 w-4 shrink-0 ${activeItem === item.id ? "text-primary" : "text-muted-foreground"} ${isExpanded ? "mr-3" : ""}`}
										/>
										{isExpanded && (
											<>
												<span className="truncate text-sm">{item.label}</span>
												{item.count && (
													<span className="ml-auto text-xs text-muted-foreground">
														{item.count}
													</span>
												)}
											</>
										)}
									</Button>
								))}
							</div>
						</div>
					))}
				</nav>
			</div>

			<div className="border-t p-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							className={`w-full h-12 ${!isExpanded ? "px-0 justify-center" : "justify-start px-2"}`}
						>
							<Avatar className="h-8 w-8 rounded-lg border border-border">
								<AvatarFallback className="bg-primary/5 text-xs font-medium">
									{user?.name?.[0] || "U"}
								</AvatarFallback>
							</Avatar>
							{isExpanded && (
								<div className="ml-3 flex flex-col items-start truncate text-xs animate-in fade-in duration-300">
									<span className="font-semibold text-foreground">{user?.name}</span>
									<span className="text-muted-foreground text-[10px]">{user?.email}</span>
								</div>
							)}
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
			<main className="flex-1 overflow-auto">
				<Outlet />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});
