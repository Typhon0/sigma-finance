import { Link } from "@tanstack/react-router";
import { CloudDownload, Database, Key, NotebookPen, Palette, ScrollText, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SettingsSection =
	| "account"
	| "market-data"
	| "historical-data-jobs"
	| "display"
	| "finance-database"
	| "manual-instruments"
	| "data"
	| "logs";

interface SettingsLayoutProps {
	children: React.ReactNode;
	activeSection: SettingsSection;
	fullWidth?: boolean;
}

const sections: {
	id: SettingsSection;
	label: string;
	icon: typeof User;
	href: string;
}[] = [
	{
		id: "account",
		label: "Account & Profile",
		icon: User,
		href: "/settings/account",
	},
	{
		id: "market-data",
		label: "Market Data",
		icon: Key,
		href: "/settings/market-data",
	},
	{
		id: "historical-data-jobs",
		label: "Historical Data Jobs",
		icon: CloudDownload,
		href: "/settings/historical-data-jobs",
	},
	{
		id: "display",
		label: "Display & Theme",
		icon: Palette,
		href: "/settings/display",
	},
	{
		id: "finance-database",
		label: "Catalog Source",
		icon: CloudDownload,
		href: "/settings/finance-database",
	},
	{
		id: "manual-instruments",
		label: "Manual Instruments",
		icon: NotebookPen,
		href: "/settings/manual-instruments",
	},
	{
		id: "data",
		label: "Data & Privacy",
		icon: Database,
		href: "/settings/data",
	},
	{
		id: "logs",
		label: "System Logs",
		icon: ScrollText,
		href: "/settings/logs",
	},
];

export function SettingsLayout({ children, activeSection, fullWidth }: SettingsLayoutProps) {
	return (
		<div className="flex h-full w-full">
			<aside className="w-64 border-r bg-card/50 flex flex-col shrink-0">
				<div className="p-4">
					<h2 className="text-lg font-semibold">Settings</h2>
					<p className="text-sm text-muted-foreground">Manage your preferences</p>
				</div>
				<Separator />
				<ScrollArea className="flex-1">
					<nav className="p-2 space-y-1">
						{sections.map((section) => {
							const Icon = section.icon;
							return (
								<Link
									key={section.id}
									to={section.href}
									className={cn(
										"flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
										activeSection === section.id
											? "bg-secondary text-foreground font-medium"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
								>
									<Icon className="h-4 w-4" />
									{section.label}
								</Link>
							);
						})}
					</nav>
				</ScrollArea>
			</aside>
			<div className="flex-1 min-w-0 flex flex-col h-full bg-background">
				<ScrollArea className="flex-1 p-6">
					<div className={cn("mx-auto w-full", fullWidth ? "max-w-full" : "max-w-4xl")}>
						{children}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
