import type { ApolloCache, ApolloError, Reference } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { Grid, List, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SortablePortfolioItem } from "@/components/portfolio/sortable-portfolio-item";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import type {
	DuplicatePortfolioInput,
	GetPortfoliosWithAnalyticsQuery,
} from "@/gql/graphql";
import { useAuth } from "@/lib/auth-context";
import {
	DELETE_PORTFOLIO,
	DUPLICATE_PORTFOLIO,
} from "@/graphql/mutations";
import { GET_PORTFOLIOS_WITH_ANALYTICS } from "@/graphql/queries";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";

type Portfolio = GetPortfoliosWithAnalyticsQuery["portfolios"][0];

export default function PortfoliosPage() {
	const { toast } = useToast();
	const { user } = useAuth();
	const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
	const [showDeleteConfirmation, setShowDeleteConfirmation] =
		useState<Portfolio | null>(null);

	const { data, loading, error } = useQuery<GetPortfoliosWithAnalyticsQuery>(
		GET_PORTFOLIOS_WITH_ANALYTICS,
		{
			variables: { userID: user?.id ?? "" },
			skip: !user,
		},
	);
	const [deletePortfolio, { loading: deleteLoading }] =
		useMutation(DELETE_PORTFOLIO);
	const [duplicatePortfolio, { loading: duplicateLoading }] =
		useMutation(DUPLICATE_PORTFOLIO);

	const portfolios = useMemo(
		() => (data?.portfolios as Portfolio[]) ?? [],
		[data],
	);
	const [sortedPortfolios, setSortedPortfolios] = useState(portfolios);

	useEffect(() => {
		setSortedPortfolios(portfolios);
	}, [portfolios]);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			setSortedPortfolios((items) => {
				const oldIndex = items.findIndex((item) => item.id === active.id);
				const newIndex = items.findIndex((item) => item.id === over.id);
				return arrayMove(items, oldIndex, newIndex);
			});
			// Here you would typically also make a mutation to save the new order
		}
	};

	const handleDelete = async () => {
		if (!showDeleteConfirmation) return;

		try {
			await deletePortfolio({
				variables: { id: showDeleteConfirmation.id },
				update(cache: ApolloCache<any>) {
					cache.modify({
						fields: {
							portfolios(
								existingPortfolios: readonly Reference[] = [],
								{ readField },
							) {
								return existingPortfolios.filter(
									(p) => readField("id", p) !== showDeleteConfirmation.id,
								);
							},
						},
					});
				},
			});
			toast.success("Portfolio Deleted", {
				description: `"${showDeleteConfirmation.name}" has been successfully deleted.`,
			});
		} catch (e) {
			const apolloError = e as ApolloError;
			toast.error("Error Deleting Portfolio", {
				description: apolloError.message,
			});
		} finally {
			setShowDeleteConfirmation(null);
		}
	};

	const handleDuplicate = async (portfolio: Portfolio) => {
		try {
			const input: DuplicatePortfolioInput = {
				sourcePortfolioID: portfolio.id,
				newName: `${portfolio.name} (Copy)`,
				copyAssets: true, // or based on user input
			};
			await duplicatePortfolio({
				variables: { input },
				refetchQueries: [
					{
						query: GET_PORTFOLIOS_WITH_ANALYTICS,
						variables: { userID: user?.id },
					},
				],
			});
			toast.success("Portfolio Duplicated", {
				description: `A copy of "${portfolio.name}" has been created.`,
			});
		} catch (e) {
			const apolloError = e as ApolloError;
			toast.error("Error Duplicating Portfolio", {
				description: apolloError.message,
			});
		}
	};

	if (loading) {
		return <PortfolioSkeleton />;
	}

	if (error) {
		return <ErrorDisplay title="Error Loading Portfolios" error={error} />;
	}

	return (
		<div className="container mx-auto p-4 md:p-6">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl md:text-3xl font-bold">Your Portfolios</h1>
				<div className="flex items-center gap-2">
					<Button
						variant={viewMode === "list" ? "secondary" : "outline"}
						size="icon"
						onClick={() => setViewMode("list")}
					>
						<List className="h-4 w-4" />
					</Button>
					<Button
						variant={viewMode === "grid" ? "secondary" : "outline"}
						size="icon"
						onClick={() => setViewMode("grid")}
					>
						<Grid className="h-4 w-4" />
					</Button>
					<CreatePortfolioDialog>
						<Button>
							<PlusCircle className="mr-2 h-4 w-4" />
							New Portfolio
						</Button>
					</CreatePortfolioDialog>
				</div>
			</div>

			{sortedPortfolios.length === 0 ? (
				<Card className="text-center py-12">
					<CardHeader>
						<CardTitle>No Portfolios Yet</CardTitle>
						<CardDescription>
							Get started by creating your first portfolio.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<CreatePortfolioDialog>
							<Button size="lg">
								<PlusCircle className="mr-2 h-5 w-5" />
								Create Portfolio
							</Button>
						</CreatePortfolioDialog>
					</CardContent>
				</Card>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sortedPortfolios.map((p) => p.id)}
						strategy={verticalListSortingStrategy}
					>
						<div
							className={
								viewMode === "grid"
									? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
									: "space-y-4"
							}
						>
							{sortedPortfolios.map((portfolio) => (
								<SortablePortfolioItem
									key={portfolio.id}
									portfolio={portfolio}
									viewMode={viewMode}
									onDelete={() => setShowDeleteConfirmation(portfolio)}
									onDuplicate={() => handleDuplicate(portfolio)}
									isDeleting={
										deleteLoading && showDeleteConfirmation?.id === portfolio.id
									}
									isDuplicating={duplicateLoading}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			)}

			<AlertDialog
				open={!!showDeleteConfirmation}
				onOpenChange={(open) => !open && setShowDeleteConfirmation(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the "
							{showDeleteConfirmation?.name}" portfolio and all its associated
							data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} disabled={deleteLoading}>
							{deleteLoading ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function PortfolioSkeleton() {
	return (
		<div className="container mx-auto p-4 md:p-6">
			<div className="flex items-center justify-between mb-6">
				<Skeleton className="h-8 w-48" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-10 w-36" />
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{[...Array(3)].map((_, i) => (
					<Card key={i}>
						<CardHeader>
							<Skeleton className="h-6 w-3/4" />
							<Skeleton className="h-4 w-1/2" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-24 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}
