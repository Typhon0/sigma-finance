import { Plus, RotateCcw, Scale, Settings2, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RebalancingData } from "./types";

export const DEFAULT_TARGET_WEIGHTS: Record<string, number> = {
	Technology: 35,
	Financials: 20,
	Healthcare: 15,
	"Consumer Discretionary": 15,
	Other: 15,
};

interface RebalancingCardProps {
	cardId: string;
	rebalancingData: RebalancingData | null;
	isRecommended: boolean;
	setActiveTab: (tab: string) => void;
	targetWeights?: Record<string, number>;
	onUpdateTargetWeights?: (weights: Record<string, number>) => void;
}

export const RebalancingCard = memo(function RebalancingCard({
	cardId,
	rebalancingData,
	isRecommended,
	setActiveTab: _setActiveTab,
	targetWeights = DEFAULT_TARGET_WEIGHTS,
	onUpdateTargetWeights,
}: RebalancingCardProps) {
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [tempWeights, setTempWeights] = useState<Record<string, number>>(targetWeights);
	const [newSectorName, setNewSectorName] = useState("");

	const handleOpenEditor = () => {
		setTempWeights({ ...targetWeights });
		setIsEditorOpen(true);
	};

	const handleWeightChange = (sector: string, valStr: string) => {
		const val = Number.parseFloat(valStr);
		setTempWeights((prev) => ({
			...prev,
			[sector]: Number.isNaN(val) ? 0 : Math.max(0, Math.min(100, val)),
		}));
	};

	const handleRemoveSector = (sector: string) => {
		setTempWeights((prev) => {
			const next = { ...prev };
			delete next[sector];
			return next;
		});
	};

	const handleAddSector = () => {
		const trimmed = newSectorName.trim();
		if (!trimmed || tempWeights[trimmed] !== undefined) return;
		setTempWeights((prev) => ({
			...prev,
			[trimmed]: 0,
		}));
		setNewSectorName("");
	};

	const totalTempWeight = Object.values(tempWeights).reduce((sum, w) => sum + w, 0);

	const handleSave = () => {
		onUpdateTargetWeights?.(tempWeights);
		setIsEditorOpen(false);
	};

	const handleResetDefaults = () => {
		setTempWeights({ ...DEFAULT_TARGET_WEIGHTS });
	};

	return (
		<>
			<Card
				key={cardId}
				className="relative overflow-hidden border border-border/40 bg-card/25 p-5 min-h-[220px] flex flex-col justify-between hover:border-primary/30 hover:bg-card/75 transition-all duration-300 ease-in-out group/card animate-in fade-in duration-300"
			>
				<div>
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-1.5">
							<span className="text-micro font-bold uppercase tracking-widest text-muted-foreground">
								Rebalancing
							</span>
							<button
								type="button"
								onClick={handleOpenEditor}
								className="opacity-0 group-hover/card:opacity-100 text-muted-foreground hover:text-foreground transition-opacity cursor-pointer p-0.5"
								title="Edit sector allocation targets"
							>
								<Settings2 className="h-3 w-3" />
							</button>
						</div>

						{isRecommended && (
							<span className="bg-primary/5 text-primary border border-primary/15 px-2 py-0.5 rounded text-micro font-extrabold uppercase tracking-wider select-none">
								Recommended
							</span>
						)}
					</div>

					{rebalancingData ? (
						<div className="space-y-3.5">
							<div className="flex items-baseline gap-1.5">
								<span
									className={cn(
										"text-2xl font-bold font-mono",
										rebalancingData.needsAttentionCount > 0 ? "text-warning" : "text-gain",
									)}
								>
									{rebalancingData.needsAttentionCount > 0
										? `${rebalancingData.needsAttentionCount} alerts`
										: "Balanced"}
								</span>
								<span className="text-xs text-muted-foreground">sector targets</span>
							</div>

							<div className="space-y-2 mt-1">
								<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
									<span className="text-muted-foreground font-medium">Largest drift</span>
									<span className="font-semibold text-foreground flex items-center gap-1">
										<span>{rebalancingData.maxVarianceSector}</span>
										<span
											className={cn(
												"font-mono font-semibold text-micro",
												rebalancingData.maxVariance >= 0 ? "text-gain" : "text-loss",
											)}
										>
											{rebalancingData.maxVariance >= 0 ? "+" : ""}
											{rebalancingData.maxVariance.toFixed(1)}%
										</span>
									</span>
								</div>
								<div className="flex justify-between items-center text-xs pb-1.5 border-b border-border/30">
									<span className="text-muted-foreground font-medium">Total deviation</span>
									<span className="font-mono font-semibold text-foreground">
										{rebalancingData.totalVariance.toFixed(1)}%
									</span>
								</div>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center justify-center text-center h-[130px] gap-1.5 py-4">
							<Scale className="h-6 w-6 text-muted-foreground/40 shrink-0" />
							<p className="text-xs font-semibold text-foreground/90">No targets configured</p>
							<p className="text-micro text-muted-foreground max-w-[200px] leading-normal">
								Define model allocation targets to monitor portfolio drift.
							</p>
						</div>
					)}
				</div>

				<div className="flex justify-end mt-2 z-10">
					<button
						type="button"
						onClick={handleOpenEditor}
						className="text-micro text-primary hover:text-primary/80 font-semibold flex items-center gap-0.5 cursor-pointer transition-colors"
					>
						Configure targets →
					</button>
				</div>
			</Card>

			{/* Target Allocations Editor Dialog */}
			<Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
				<DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border/50">
					<DialogHeader>
						<DialogTitle className="text-base font-bold flex items-center gap-2">
							<Scale className="h-4 w-4 text-primary" />
							Model Portfolio Targets
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Define your desired target weighting percentage per sector to track allocation drift.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="max-h-60 overflow-y-auto pr-1 space-y-2.5">
							{Object.entries(tempWeights).map(([sector, weight]) => (
								<div
									key={sector}
									className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/20 border border-border/30"
								>
									<span className="text-xs font-medium text-foreground truncate max-w-[180px]">
										{sector}
									</span>
									<div className="flex items-center gap-2">
										<div className="relative w-20">
											<Input
												type="number"
												min="0"
												max="100"
												step="1"
												value={weight}
												onChange={(e) => handleWeightChange(sector, e.target.value)}
												className="h-7 text-xs text-right pr-6 font-mono"
											/>
											<span className="absolute right-2 top-1.5 text-micro text-muted-foreground pointer-events-none">
												%
											</span>
										</div>
										<button
											type="button"
											onClick={() => handleRemoveSector(sector)}
											className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer p-1"
											title="Remove sector"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								</div>
							))}
						</div>

						{/* Add Custom Sector */}
						<div className="flex items-center gap-2 pt-1">
							<Input
								placeholder="Add custom sector (e.g. Energy)..."
								value={newSectorName}
								onChange={(e) => setNewSectorName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
								className="h-8 text-xs bg-background/50"
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-8 text-xs cursor-pointer shrink-0 gap-1"
								onClick={handleAddSector}
								disabled={!newSectorName.trim()}
							>
								<Plus className="h-3.5 w-3.5" />
								Add
							</Button>
						</div>

						{/* Allocation Sum indicator */}
						<div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs">
							<span className="text-muted-foreground font-medium">Total Target Allocation:</span>
							<span
								className={cn(
									"font-mono font-bold text-xs px-2 py-0.5 rounded",
									Math.round(totalTempWeight) === 100
										? "text-gain bg-gain/10"
										: "text-warning bg-warning/10",
								)}
							>
								{totalTempWeight.toFixed(1)}% {Math.round(totalTempWeight) === 100 ? "✓" : "(!)"}
							</span>
						</div>
					</div>

					<DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t border-border/20">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleResetDefaults}
							className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
						>
							<RotateCcw className="h-3 w-3" />
							Reset Defaults
						</Button>

						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setIsEditorOpen(false)}
								className="h-8 text-xs cursor-pointer"
							>
								Cancel
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={handleSave}
								className="h-8 text-xs font-semibold cursor-pointer"
							>
								Save Targets
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
});
