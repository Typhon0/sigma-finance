import { Link } from "@tanstack/react-router";
import { CloudDownload, Database, Key, NotebookPen, Palette, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type SettingsSection =
	| "account"
	| "market-data"
	| "display"
	| "finance-database"
	| "manual-instruments"
	| "data";

interface SettingsLayoutProps {
	children: React.ReactNode;
	activeSection: SettingsSection;
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
];

export function SettingsLayout({ children, activeSection }: SettingsLayoutProps) {
	return (
		<div className="flex h-full">
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
			<ScrollArea className="flex-1 p-6">
				<div className="max-w-4xl mx-auto">{children}</div>
			</ScrollArea>
		</div>
	);
}
