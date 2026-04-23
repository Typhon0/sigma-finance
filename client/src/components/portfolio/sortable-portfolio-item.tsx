import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GetPortfoliosWithAnalyticsQuery } from "@/gql/graphql";

type Portfolio = GetPortfoliosWithAnalyticsQuery["portfolios"][0];

interface SortablePortfolioItemProps {
	portfolio: Portfolio;
	viewMode: "list" | "grid";
	onDelete: () => void;
	onDuplicate: () => void;
	isDeleting: boolean;
	isDuplicating: boolean;
}

export function SortablePortfolioItem({
	portfolio,
	viewMode: _viewMode,
	onDelete,
	onDuplicate,
	isDeleting: _isDeleting,
	isDuplicating: _isDuplicating,
}: SortablePortfolioItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
		id: portfolio.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div ref={setNodeRef} style={style} {...attributes}>
			<Card>
				<CardContent className="p-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div {...listeners} className="cursor-grab touch-none p-2">
							<GripVertical className="h-5 w-5 text-muted-foreground" />
						</div>
						<Link
							to="/portfolios/$portfolioId"
							params={{ portfolioId: portfolio.id }}
							className="font-medium hover:underline"
						>
							{portfolio.name}
						</Link>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" onClick={onDuplicate}>
							<Copy className="h-4 w-4" />
							<span className="sr-only">Duplicate</span>
						</Button>
						<Button variant="ghost" size="icon" onClick={onDelete}>
							<Trash2 className="h-4 w-4" />
							<span className="sr-only">Delete</span>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
