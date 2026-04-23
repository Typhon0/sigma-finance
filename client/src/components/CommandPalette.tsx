import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
	ArrowUpDown,
	BarChart3,
	CreditCard,
	FileText,
	Gem,
	Home,
	Palette,
	PieChart,
	Plus,
	Search,
	Wallet,
	Watch,
} from "lucide-react";
import { useEffect } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { cn } from "@/lib/utils";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "./ui/command";

interface CommandPaletteProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onNavigate: (view: string) => void;
	onAction: (action: string) => void;
}

export function CommandPalette({ open, onOpenChange, onNavigate, onAction }: CommandPaletteProps) {
	const { assets } = usePortfolio();

	// Keyboard shortcut handler
	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChange(!open);
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [onOpenChange, open]);

	const handleSelect = (callback: () => void) => {
		onOpenChange(false);
		callback();
	};

	// Filter for specific collections
	const watchCollection = assets.filter((a) => a.type === "watch");
	const artCollection = assets.filter((a) => a.type === "art");

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
				<DialogPrimitive.Content
					className={cn(
						"fixed top-[20%] left-[50%] z-[100] grid w-full max-w-2xl translate-x-[-50%] gap-4 border bg-background p-0 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-xl border-border/50",
					)}
				>
					<Command className="rounded-xl border-0 shadow-none h-[400px]">
						<div className="flex items-center border-b px-3">
							<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
							<CommandInput
								placeholder="Type a command or search assets..."
								className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</div>
						<CommandList className="max-h-[340px] overflow-y-auto p-2">
							<CommandEmpty>No results found.</CommandEmpty>

							{/* Navigation */}
							<CommandGroup heading="Go to">
								<CommandItem onSelect={() => handleSelect(() => onNavigate("overview"))}>
									<PieChart className="mr-2 h-4 w-4" />
									<span>Command Center</span>
									<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										⌘1
									</kbd>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("assets"))}>
									<Wallet className="mr-2 h-4 w-4" />
									<span>Assets Overview</span>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("transactions"))}>
									<ArrowUpDown className="mr-2 h-4 w-4" />
									<span>Ledger</span>
									<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										⌘T
									</kbd>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("analytics"))}>
									<BarChart3 className="mr-2 h-4 w-4" />
									<span>Analytics & Reports</span>
									<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
										⌘2
									</kbd>
								</CommandItem>
							</CommandGroup>

							<CommandSeparator className="my-2" />

							{/* Collections Shortcuts */}
							<CommandGroup heading="Collections">
								<CommandItem onSelect={() => handleSelect(() => onNavigate("collectibles"))}>
									<Watch className="mr-2 h-4 w-4" />
									<span>View Rolex Collection</span>
									<span className="ml-auto text-xs text-muted-foreground">
										{watchCollection.length} items
									</span>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("collectibles"))}>
									<Palette className="mr-2 h-4 w-4" />
									<span>View Art Collection</span>
									<span className="ml-auto text-xs text-muted-foreground">
										{artCollection.length} items
									</span>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("real-estate"))}>
									<Home className="mr-2 h-4 w-4" />
									<span>Real Estate Portfolio</span>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onNavigate("loans"))}>
									<CreditCard className="mr-2 h-4 w-4" />
									<span>Liabilities Manager</span>
								</CommandItem>
							</CommandGroup>

							<CommandSeparator className="my-2" />

							{/* Quick Actions */}
							<CommandGroup heading="Actions">
								<CommandItem onSelect={() => handleSelect(() => onAction("add-asset"))}>
									<Plus className="mr-2 h-4 w-4" />
									<span>Add New Asset</span>
									<kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
										N
									</kbd>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onAction("add-transaction"))}>
									<ArrowUpDown className="mr-2 h-4 w-4" />
									<span>Add Transaction</span>
								</CommandItem>
								<CommandItem onSelect={() => handleSelect(() => onAction("export-data"))}>
									<FileText className="mr-2 h-4 w-4" />
									<span>Export Report</span>
								</CommandItem>
							</CommandGroup>

							{/* Recent Assets */}
							{assets && assets.length > 0 && (
								<>
									<CommandSeparator className="my-2" />
									<CommandGroup heading="Search Assets">
										{assets.map((asset) => (
											<CommandItem
												key={asset.id}
												value={`${asset.name} ${asset.symbol || ""} ${asset.type}`}
												onSelect={() => handleSelect(() => onNavigate("assets"))}
											>
												<Gem className="mr-2 h-4 w-4 opacity-70" />
												<span>{asset.name}</span>
												{asset.symbol && (
													<span className="ml-2 text-muted-foreground font-mono text-xs">
														{asset.symbol}
													</span>
												)}
												<span className="ml-auto text-xs text-muted-foreground capitalize">
													{asset.type.replace("_", " ")}
												</span>
											</CommandItem>
										))}
									</CommandGroup>
								</>
							)}
						</CommandList>
					</Command>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
