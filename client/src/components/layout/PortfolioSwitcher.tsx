import { Plus } from "lucide-react";
import { useState } from "react";
import { usePortfolio } from "@/components/PortfolioProvider";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { Textarea } from "../ui/textarea";

interface PortfolioSwitcherProps {
	isCollapsed?: boolean;
	onInteractingChange?: (interacting: boolean) => void;
}

export function PortfolioSwitcher({
	isCollapsed = false,
	onInteractingChange,
}: PortfolioSwitcherProps) {
	const {
		portfolios,
		loading,
		authLoading,
		currentPortfolio,
		setCurrentPortfolio,
		createPortfolio,
	} = usePortfolio();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPortfolio, setNewPortfolio] = useState({
		name: "",
		description: "",
	});

	const handleCreatePortfolio = async () => {
		if (newPortfolio.name.trim()) {
			const portfolio = await createPortfolio({
				name: newPortfolio.name,
				description: newPortfolio.description || null,
			});
			if (portfolio?.id) {
				setCurrentPortfolio(portfolio.id);
			}
			setNewPortfolio({ name: "", description: "" });
			setIsCreateOpen(false);
			onInteractingChange?.(false);
		}
	};

	if (isCollapsed) {
		return null;
	}

	// Show loading state while auth is initializing or portfolios are loading
	const isLoading = authLoading || loading;
	if (isLoading) {
		return (
			<div className="px-2 space-y-2">
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-7 w-full" />
			</div>
		);
	}

	return (
		<div className="px-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
			<Select
				value={currentPortfolio}
				onValueChange={setCurrentPortfolio}
				onOpenChange={(open) => onInteractingChange?.(open)}
			>
				<SelectTrigger className="h-9 text-xs border-dashed bg-secondary/30">
					<SelectValue placeholder="Select portfolio" />
				</SelectTrigger>
				<SelectContent>
					{portfolios.length === 0 ? (
						<div className="px-2 py-1.5 text-xs text-muted-foreground">No portfolios yet</div>
					) : (
						portfolios.map((portfolio) => (
							<SelectItem key={portfolio.id} value={portfolio.id} className="text-xs">
								{portfolio.name}
							</SelectItem>
						))
					)}
				</SelectContent>
			</Select>

			<Dialog
				open={isCreateOpen}
				onOpenChange={(open) => {
					setIsCreateOpen(open);
					onInteractingChange?.(open);
				}}
			>
				<DialogTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="w-full h-7 text-[10px] text-muted-foreground hover:text-primary"
					>
						<Plus className="h-3 w-3 mr-1.5" />
						New Portfolio
					</Button>
				</DialogTrigger>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>Create New Portfolio</DialogTitle>
						<DialogDescription>Add a new portfolio to organize your investments.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="name" className="text-right">
								Name
							</Label>
							<Input
								id="name"
								value={newPortfolio.name}
								onChange={(e) => setNewPortfolio({ ...newPortfolio, name: e.target.value })}
								className="col-span-3"
								placeholder="e.g., Retirement Fund"
							/>
						</div>
						<div className="grid grid-cols-4 items-center gap-4">
							<Label htmlFor="description" className="text-right">
								Description
							</Label>
							<Textarea
								id="description"
								value={newPortfolio.description}
								onChange={(e) =>
									setNewPortfolio({
										...newPortfolio,
										description: e.target.value,
									})
								}
								className="col-span-3"
								placeholder="Optional description..."
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsCreateOpen(false);
								onInteractingChange?.(false);
							}}
						>
							Cancel
						</Button>
						<Button onClick={handleCreatePortfolio}>Create Portfolio</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
