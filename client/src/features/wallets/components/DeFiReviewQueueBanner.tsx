import { useMutation, useQuery } from "@apollo/client";
import { AlertCircle, Check, HelpCircle, Layers, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RESOLVE_WALLET_REVIEW } from "@/graphql/mutations/wallets";
import { GET_PENDING_WALLET_REVIEWS, GET_WALLET_ACCOUNTS } from "@/graphql/queries/wallets";

interface DeFiReviewQueueBannerProps {
	portfolioId: string;
}

export function DeFiReviewQueueBanner({ portfolioId }: DeFiReviewQueueBannerProps) {
	const { data, loading, refetch } = useQuery(GET_PENDING_WALLET_REVIEWS, {
		variables: { portfolioId },
		skip: !portfolioId,
		pollInterval: 20000,
	});

	const [resolveReview, { loading: resolving }] = useMutation(RESOLVE_WALLET_REVIEW, {
		refetchQueries: [
			{ query: GET_PENDING_WALLET_REVIEWS, variables: { portfolioId } },
			{ query: GET_WALLET_ACCOUNTS, variables: { portfolioId } },
		],
		onError: (err) => {
			toast.error(`Failed to update review status: ${err.message}`);
		},
	});

	const handleResolve = async (reviewId: string, action: "APPROVE" | "DISMISS") => {
		try {
			await resolveReview({ variables: { reviewId, action } });
			if (action === "APPROVE") {
				toast.success("Transaction movement approved and categorized");
			} else {
				toast.info("Transaction movement dismissed from review");
			}
		} catch {
			// Handled by onError
		}
	};

	const reviews = data?.pendingWalletReviews || [];
	if (!reviews.length) {
		return null;
	}

	return (
		<Card className="border-amber-500/30 bg-amber-500/5">
			<CardContent className="p-4 space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Layers className="h-4 w-4 text-amber-600" />
						<span className="font-semibold text-sm text-foreground">
							DeFi Activity Review Queue
						</span>
						<Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 bg-amber-500/10">
							{reviews.length} Pending
						</Badge>
					</div>
					<span className="text-xs text-muted-foreground">
						Complex multi-token transactions staged for your confirmation
					</span>
				</div>

				<div className="space-y-2">
					{reviews.map((rev: { id: string; walletActivityId: string; suggestedType: string; notes?: string | null }) => (
						<div
							key={rev.id}
							className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-background/80 border text-xs"
						>
							<div className="flex items-center gap-2 max-w-xl">
								<Badge variant="secondary" className="font-mono text-[10px]">
									{rev.suggestedType}
								</Badge>
								<span className="text-muted-foreground truncate">{rev.notes || "Multi-asset interaction"}</span>
							</div>

							<div className="flex items-center gap-1.5 ml-auto">
								<Button
									variant="outline"
									size="sm"
									className="h-7 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
									onClick={() => handleResolve(rev.id, "APPROVE")}
									disabled={resolving}
								>
									<Check className="h-3 w-3 mr-1" /> Approve
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="h-7 text-xs text-muted-foreground hover:text-destructive"
									onClick={() => handleResolve(rev.id, "DISMISS")}
									disabled={resolving}
								>
									<X className="h-3 w-3 mr-1" /> Dismiss
								</Button>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
