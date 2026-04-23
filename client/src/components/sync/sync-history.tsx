"use client";

import { format } from "date-fns";
import { CheckCircle, XCircle } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export interface SyncHistoryEntry {
	id: string;
	timestamp: Date;
	assetType: string;
	recordCount: number;
	status: "success" | "error";
	errorMessage?: string;
}

interface SyncHistoryProps {
	entries: SyncHistoryEntry[];
}

export function SyncHistory({ entries }: SyncHistoryProps) {
	if (entries.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				<p className="text-sm">No sync history yet</p>
				<p className="text-xs mt-1">Sync history will appear here after your first sync</p>
			</div>
		);
	}

	return (
		<Accordion type="single" collapsible className="w-full">
			<AccordionItem value="sync-history">
				<AccordionTrigger className="text-sm font-medium">
					Sync History ({entries.length} entries)
				</AccordionTrigger>
				<AccordionContent>
					<div className="space-y-2">
						{entries.map((entry) => (
							<div
								key={entry.id}
								className="flex items-center justify-between p-3 rounded-lg border bg-card"
							>
								<div className="flex items-center gap-3">
									{entry.status === "success" ? (
										<CheckCircle className="h-4 w-4 text-green-500" />
									) : (
										<XCircle className="h-4 w-4 text-destructive" />
									)}
									<div>
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium capitalize">{entry.assetType}</span>
											<Badge variant={entry.status === "success" ? "outline" : "destructive"}>
												{entry.status === "success"
													? `${entry.recordCount.toLocaleString()} records`
													: "Failed"}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground">
											{format(entry.timestamp, "MMM d, yyyy 'at' h:mm a")}
										</p>
										{entry.errorMessage && (
											<p className="text-xs text-destructive mt-1">{entry.errorMessage}</p>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
